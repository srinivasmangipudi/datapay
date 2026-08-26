import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { CreateOrganizationDto, CreateQuestionDto } from "@datapay/shared";
import * as bcrypt from "bcryptjs";
import { Pool, PoolClient } from "pg";
import { PG_POOL } from "../db/db.module";
import { withTransaction } from "../db/tx.util";

const PASSWORD_SALT_ROUNDS = 10;

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export interface OrgTokenPayload {
  organizationId: string;
  type: "org";
}

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly jwt: JwtService
  ) {}

  // Ops-only — same unauthenticated-at-the-API-layer posture as every other
  // v1/admin/* route today (portal's shared password is the only gate).
  async create(dto: CreateOrganizationDto): Promise<{ id: string; slug: string }> {
    const slug = dto.slug?.trim() || slugify(dto.name);
    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_SALT_ROUNDS);
    const { rows } = await this.pool.query<{ id: string; slug: string }>(
      `INSERT INTO organizations (slug, name, email, password_hash) VALUES ($1, $2, $3, $4)
       RETURNING id, slug`,
      [slug, dto.name, dto.email.toLowerCase(), passwordHash]
    );
    return rows[0];
  }

  async list() {
    const { rows } = await this.pool.query(
      `SELECT id, slug, name, email, active, created_at FROM organizations ORDER BY created_at DESC`
    );
    return rows;
  }

  async login(email: string, password: string): Promise<{ token: string; name: string }> {
    const { rows } = await this.pool.query<{
      id: string;
      name: string;
      password_hash: string;
      active: boolean;
    }>(`SELECT id, name, password_hash, active FROM organizations WHERE email = $1`, [
      email.toLowerCase(),
    ]);
    const org = rows[0];
    // Same generic error for "no such org" and "wrong password" — never
    // reveal which email addresses are registered.
    if (!org || !org.active || !(await bcrypt.compare(password, org.password_hash))) {
      throw new UnauthorizedException("Incorrect email or password");
    }
    const payload: OrgTokenPayload = { organizationId: org.id, type: "org" };
    const token = await this.jwt.signAsync(payload, { expiresIn: "30d" });
    return { token, name: org.name };
  }

  /**
   * An organization submitting a question of its own — unlike
   * createDirectQuestion (admin_authored, immediately 'approved'), this
   * always lands as 'draft' with source='org_submitted': typing it in is
   * NOT the review, ops still has to approve it in the existing review
   * queue before it can ever reach a member (SPEC.md §14).
   */
  async createOrgQuestion(
    organizationId: string,
    dto: CreateQuestionDto
  ): Promise<{ id: number }> {
    const options =
      dto.type === "intent_window"
        ? [
            { labelEn: "Yes", labelKn: "ಹೌದು" },
            { labelEn: "Maybe", labelKn: "ಬಹುಶಃ" },
            { labelEn: "No", labelKn: "ಇಲ್ಲ" },
          ]
        : (dto.options ?? []);

    return withTransaction(this.pool, async (client: PoolClient) => {
      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO questions
           (category_id, type, text_en, reward_tokens, source, review_state, intent_window,
            zone_id, allow_photo, allow_voice, organization_id)
         VALUES ($1, $2, $3, $4, 'org_submitted', 'draft', $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          dto.categoryId,
          dto.type,
          dto.textEn,
          dto.rewardTokens,
          dto.type === "intent_window" ? dto.intentWindow : null,
          dto.zoneId ?? null,
          dto.allowPhoto,
          dto.allowVoice,
          organizationId,
        ]
      );
      const questionId = rows[0].id;

      for (const [i, opt] of options.entries()) {
        await client.query(
          `INSERT INTO question_options (question_id, label_en, label_kn, sort) VALUES ($1, $2, $3, $4)`,
          [questionId, opt.labelEn, opt.labelKn ?? null, i]
        );
      }

      for (const t of dto.translations ?? []) {
        await client.query(
          `INSERT INTO question_translations (question_id, language_code, text) VALUES ($1, $2, $3)`,
          [questionId, t.languageCode, t.text]
        );
      }

      return { id: questionId };
    });
  }

  async listOwnQuestions(organizationId: string) {
    const { rows } = await this.pool.query(
      `SELECT id, category_id, type, text_en, reward_tokens, review_state, active_from
       FROM questions WHERE organization_id = $1 ORDER BY id DESC`,
      [organizationId]
    );
    return rows;
  }
}
