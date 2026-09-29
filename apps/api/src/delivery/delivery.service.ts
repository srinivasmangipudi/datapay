import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";

const PASSWORD_SALT_ROUNDS = 10;

// Same trick organizations.service.ts uses: a real hash to compare against when
// no such agent exists, so "unknown phone", "wrong passcode" and "correct
// passcode, deactivated" all cost the same bcrypt work and reveal nothing by
// timing.
const DUMMY_PASSWORD_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export interface DeliveryTokenPayload {
  agentId: string;
  type: "delivery";
}

/**
 * Normalises an Indian mobile number to E.164.
 *
 * A delivery person will type their number however they think of it — with
 * spaces, with 0 in front, with or without +91. Without this, one person
 * becomes three accounts and none of them can log in reliably.
 */
export function normalisePhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  const local = digits.replace(/^0+/, "").replace(/^91(?=\d{10}$)/, "");
  if (local.length !== 10) {
    throw new BadRequestException("Enter a 10-digit mobile number");
  }
  return `+91${local}`;
}

@Injectable()
export class DeliveryService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly jwt: JwtService
  ) {}

  private async vault<T>(path: string, body: unknown): Promise<T> {
    const url = process.env.VAULT_INTERNAL_URL;
    if (!url) throw new Error("Missing VAULT_INTERNAL_URL");
    const res = await fetch(`${url}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Vault rejected ${path} (HTTP ${res.status})`);
    return (await res.json()) as T;
  }

  /**
   * Ops onboards an agent and hands them the passcode out of band.
   *
   * The number goes to Vault, never to core_db — LAW 1 admits no phone there,
   * and no-phone-in-core.integration.spec.ts greps the migrations to prove it.
   * Core keeps the id, the area and the passcode hash.
   */
  async create(input: { name: string; phone: string; zoneId: string; password: string }) {
    const phone = normalisePhone(input.phone);

    const { taken } = await this.vault<{ taken: boolean }>("delivery-agent-phone/taken", { phone });
    if (taken) {
      throw new BadRequestException("A delivery person with that number already exists");
    }

    const hash = await bcrypt.hash(input.password, PASSWORD_SALT_ROUNDS);
    const { rows } = await this.pool.query<{ id: string }>(
      `INSERT INTO delivery_agents (name, zone_id, password_hash)
       VALUES ($1, $2, $3) RETURNING id`,
      [input.name.trim(), input.zoneId, hash]
    );
    const id = rows[0].id;

    // If Vault won't take the number the agent can never sign in, so the Core
    // row is worse than useless — remove it rather than leave a ghost ops will
    // see in the list and wonder about.
    try {
      await this.vault("delivery-agent-phone", { agentId: id, phone });
    } catch (err) {
      await this.pool.query(`DELETE FROM delivery_agents WHERE id = $1`, [id]);
      throw err;
    }

    return { id, phone };
  }

  /** Ops list. Numbers are resolved from Vault in one batch for display —
      Core never stores them, so this is the only way to show them. */
  async list() {
    const { rows } = await this.pool.query<{
      id: string;
      name: string;
      active: boolean;
      created_at: Date;
      zone_name: string;
      zone_level: string;
    }>(
      `SELECT d.id, d.name, d.active, d.created_at,
              z.name AS zone_name, z.level AS zone_level
         FROM delivery_agents d
         JOIN zones z ON z.id = d.zone_id
        ORDER BY d.active DESC, z.name, d.name`
    );
    if (rows.length === 0) return [];

    const phones = await this.vault<Array<{ agentId: string; phone: string }>>(
      "resolve-delivery-agent-phones",
      { agentIds: rows.map((r) => r.id) }
    );
    const byId = new Map(phones.map((p) => [p.agentId, p.phone]));
    return rows.map((r) => ({ ...r, phone_e164: byId.get(r.id) ?? null }));
  }

  async setActive(agentId: string, active: boolean) {
    const { rows } = await this.pool.query(
      `UPDATE delivery_agents SET active = $1 WHERE id = $2 RETURNING id, name, active`,
      [active, agentId]
    );
    if (!rows[0]) throw new NotFoundException("Delivery person not found");
    return rows[0];
  }

  /** Ops reissues a passcode — the agent forgot it, or it needs rotating. */
  async resetPassword(agentId: string, password: string) {
    const hash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
    const { rows } = await this.pool.query(
      `UPDATE delivery_agents SET password_hash = $1 WHERE id = $2 RETURNING id`,
      [hash, agentId]
    );
    if (!rows[0]) throw new NotFoundException("Delivery person not found");
    return { ok: true as const };
  }

  /**
   * Sign-in is the two halves meeting: Vault answers "whose number is this",
   * Core answers "is that their passcode".
   */
  async login(phone: string, password: string) {
    const normalised = normalisePhone(phone);
    const { agent: found } = await this.vault<{ agent: { agentId: string } | null }>(
      "resolve-delivery-agent-phone",
      { phone: normalised }
    );

    const { rows } = found
      ? await this.pool.query<{
          id: string;
          name: string;
          password_hash: string;
          active: boolean;
          zone_name: string;
        }>(
          `SELECT d.id, d.name, d.password_hash, d.active, z.name AS zone_name
             FROM delivery_agents d JOIN zones z ON z.id = d.zone_id
            WHERE d.id = $1`,
          [found.agentId]
        )
      : { rows: [] };
    const agent = rows[0];

    const matches = await bcrypt.compare(password, agent?.password_hash ?? DUMMY_PASSWORD_HASH);
    if (!agent || !matches) {
      throw new UnauthorizedException("Incorrect number or passcode");
    }
    if (!agent.active) {
      throw new UnauthorizedException("This account has been deactivated — contact DataPay");
    }

    const payload: DeliveryTokenPayload = { agentId: agent.id, type: "delivery" };
    const token = await this.jwt.signAsync(payload, { expiresIn: "30d" });
    return { token, name: agent.name, zoneName: agent.zone_name };
  }

  /**
   * Deliveries in this agent's area. Identity-blind, like every other view of
   * an order: a relay token and what to carry, never a member's alias — the
   * address is resolved separately through Vault at the doorstep.
   */
  async myDeliveries(agentId: string) {
    const { rows } = await this.pool.query(
      `WITH RECURSIVE agent_zone AS (
         SELECT z.id FROM zones z JOIN delivery_agents d ON d.zone_id = z.id WHERE d.id = $1
         UNION ALL
         SELECT z.id FROM zones z JOIN agent_zone a ON z.parent_id = a.id
       )
       SELECT po.id, po.relay_token, po.quantity, po.status, po.created_at,
              op.name_en, op.unit_spec, o.name AS organization_name
         FROM product_orders po
         JOIN org_products op ON op.id = po.org_product_id
         JOIN organizations o ON o.id = op.organization_id
         JOIN members m ON m.alias_id = po.alias_id
        WHERE po.status = 'placed'
          AND m.zone_id IN (SELECT id FROM agent_zone)
        ORDER BY po.created_at`,
      [agentId]
    );
    return rows;
  }
}
