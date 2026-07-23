import * as SQLite from "expo-sqlite";
import { PulseAnswerInput, PulseAnswerResult, submitPulseAnswers } from "./api";

const db = SQLite.openDatabaseSync("datapay-outbox.db");

db.execSync(`
  CREATE TABLE IF NOT EXISTS pulse_outbox (
    client_msg_id TEXT PRIMARY KEY NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

// Offline-first (SPEC.md §3 Local store): every answer queues locally the
// instant it's given, sync is a best-effort background concern, and
// client_msg_id makes a retried sync free (§15C).
export function enqueueAnswer(answer: PulseAnswerInput): void {
  db.runSync(
    `INSERT OR IGNORE INTO pulse_outbox (client_msg_id, payload, created_at) VALUES (?, ?, ?)`,
    [answer.clientMsgId, JSON.stringify(answer), new Date().toISOString()]
  );
}

export function getPendingCount(): number {
  const row = db.getFirstSync<{ n: number }>(`SELECT COUNT(*) AS n FROM pulse_outbox`);
  return row?.n ?? 0;
}

function getPending(): PulseAnswerInput[] {
  const rows = db.getAllSync<{ payload: string }>(`SELECT payload FROM pulse_outbox`);
  return rows.map((r) => JSON.parse(r.payload) as PulseAnswerInput);
}

function removeFromOutbox(clientMsgId: string): void {
  db.runSync(`DELETE FROM pulse_outbox WHERE client_msg_id = ?`, [clientMsgId]);
}

/**
 * Flushes whatever's queued. Both "credited" and "already_synced" mean the
 * server has it — either is safe to drop locally. Network failures leave the
 * queue untouched for the next flush attempt.
 */
export async function flushOutbox(token: string): Promise<PulseAnswerResult[]> {
  const pending = getPending();
  if (pending.length === 0) return [];

  const { results } = await submitPulseAnswers(token, pending);
  for (const result of results) {
    removeFromOutbox(result.clientMsgId);
  }
  return results;
}
