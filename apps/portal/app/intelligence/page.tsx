// §10 boundary, unchanged: the only direct Postgres read here is `zones`,
// already one of this role's original four grants. Everything else on this
// page — sources, documents, understanding, draft questions — goes through
// Core API (core-api.ts), never a new grant on the restricted DB role.
import { getPortalPool } from "../db";
import {
  connectSourceAction,
  refreshUnderstandingAction,
  reviewQuestionAction,
  syncSourceAction,
} from "./actions";
import { getUnderstanding, listDocuments, listDraftQuestions, listSources } from "./core-api";

export const dynamic = "force-dynamic";

interface Zone {
  id: string;
  name: string;
  level: string;
}

async function getZones(): Promise<Zone[]> {
  const pool = getPortalPool();
  const { rows } = await pool.query<Zone>(`SELECT id, name, level FROM zones ORDER BY level, name`);
  return rows;
}

export default async function IntelligencePage({
  searchParams,
}: {
  searchParams: { zoneId?: string; error?: string };
}): Promise<JSX.Element> {
  const zones = await getZones();
  const zoneId = searchParams.zoneId ?? zones[0]?.id;
  const selectedZone = zones.find((z) => z.id === zoneId);

  const [sources, understanding, drafts] = zoneId
    ? await Promise.all([listSources(zoneId), getUnderstanding(zoneId), listDraftQuestions()])
    : [[], null, await listDraftQuestions()];

  const documentsBySource = await Promise.all(
    sources.map((s) => listDocuments(s.id).then((docs) => ({ source: s, docs })))
  );

  return (
    <main className="page">
      <p className="eyebrow">DataPay Portal · Ops</p>
      <h1>Area intelligence</h1>
      <p className="lede">
        Ingest documents about an area, build a per-zone understanding from them, and generate
        candidate Pulse questions grounded in it — every draft still lands in the same review
        queue below before any member ever sees it.
      </p>
      {searchParams.error && (
        <div className="errorBanner">
          <strong>Action failed:</strong> {searchParams.error}
        </div>
      )}

      <form method="GET" className="zonePicker">
        <label htmlFor="zoneId">Zone</label>
        <select id="zoneId" name="zoneId" defaultValue={zoneId}>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name} ({z.level})
            </option>
          ))}
        </select>
        <button type="submit">Switch</button>
      </form>

      {selectedZone && (
        <>
          <section className="section">
            <h2>Intelligence sources — {selectedZone.name}</h2>
            {sources.length === 0 && <p className="empty">No sources connected for this zone yet.</p>}
            {sources.length > 0 && (
              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Folder ID</th>
                      <th>Last synced</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {sources.map((s) => (
                      <tr key={s.id}>
                        <td>{s.display_name}</td>
                        <td className="mono">{s.external_ref}</td>
                        <td className="muted">
                          {s.last_synced_at ? new Date(s.last_synced_at).toLocaleString() : "Never"}
                        </td>
                        <td>
                          <form action={syncSourceAction}>
                            <input type="hidden" name="zoneId" value={zoneId} />
                            <input type="hidden" name="sourceId" value={s.id} />
                            <button type="submit" className="linkBtn">
                              Sync now
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <form action={connectSourceAction} className="connectForm">
              <input type="hidden" name="zoneId" value={zoneId} />
              <input name="displayName" placeholder="Display name, e.g. 'Kikkeri gram panchayat records'" required />
              <input name="externalRef" placeholder="Google Drive folder URL or ID — either works" required />
              <button type="submit">Connect folder</button>
            </form>
            <p className="hint">
              Share the folder with the service account's email (from your
              <code> GOOGLE_SERVICE_ACCOUNT_KEY</code>) before connecting it.
            </p>

            {documentsBySource.some((d) => d.docs.length > 0) && (
              <details className="documents">
                <summary>Ingested documents ({documentsBySource.reduce((n, d) => n + d.docs.length, 0)})</summary>
                <div className="tableWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Source</th>
                        <th>Title</th>
                        <th>Type</th>
                        <th>Fetched</th>
                        <th>Text extracted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documentsBySource.flatMap(({ source, docs }) =>
                        docs.map((d) => (
                          <tr key={d.id}>
                            <td className="muted">{source.display_name}</td>
                            <td>{d.title}</td>
                            <td className="mono small">{d.mime_type}</td>
                            <td className="muted">{new Date(d.fetched_at).toLocaleString()}</td>
                            <td>{d.has_text ? "Yes" : "No — unsupported type"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </section>

          <section className="section">
            <h2>Zone understanding</h2>
            {understanding ? (
              <div className="understanding">
                <p className="summary">{understanding.summaryEn}</p>
                {understanding.summaryKn && <p className="summaryKn">{understanding.summaryKn}</p>}
                <div className="knowledgeGrid">
                  {Object.entries(understanding.knowledgeMap).map(([key, values]) => (
                    <div key={key} className="knowledgeCard">
                      <span className="knowledgeLabel">{key.replace(/([A-Z])/g, " $1")}</span>
                      {values.length === 0 ? (
                        <span className="empty">None found</span>
                      ) : (
                        <ul>
                          {values.map((v: string, i: number) => (
                            <li key={i}>{v}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
                <p className="hint">
                  Generated {new Date(understanding.generatedAt).toLocaleString()} from{" "}
                  {understanding.sourceDocumentIds.length} document(s) — {understanding.modelUsed}
                </p>
              </div>
            ) : (
              <p className="empty">
                No understanding generated yet — sync a source with documents, then refresh.
              </p>
            )}
            <form action={refreshUnderstandingAction}>
              <input type="hidden" name="zoneId" value={zoneId} />
              <button type="submit">Refresh understanding</button>
            </form>
          </section>
        </>
      )}

      <section className="section">
        <h2>Draft questions awaiting review ({drafts.length})</h2>
        {drafts.length === 0 && <p className="empty">Nothing in the queue right now.</p>}
        {drafts.length > 0 && (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Question</th>
                  <th>Type</th>
                  <th>Source</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {drafts.map((q) => (
                  <tr key={q.id}>
                    <td>
                      {q.text_en}
                      {q.translations &&
                        Object.entries(q.translations).map(([lang, text]) => (
                          <div key={lang} className="muted small">
                            {text}
                          </div>
                        ))}
                    </td>
                    <td className="mono small">{q.type}</td>
                    <td className="muted small">{q.source}</td>
                    <td className="actions">
                      <form action={reviewQuestionAction}>
                        <input type="hidden" name="zoneId" value={zoneId ?? ""} />
                        <input type="hidden" name="questionId" value={q.id} />
                        <input type="hidden" name="decision" value="approve" />
                        <button type="submit" className="approveBtn">
                          Approve
                        </button>
                      </form>
                      <form action={reviewQuestionAction}>
                        <input type="hidden" name="zoneId" value={zoneId ?? ""} />
                        <input type="hidden" name="questionId" value={q.id} />
                        <input type="hidden" name="decision" value="reject" />
                        <button type="submit" className="rejectBtn">
                          Reject
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* dangerouslySetInnerHTML — see layout.tsx for why a plain <style>{`...`}</style>
          with a quoted value inside causes a hydration mismatch. Only this page's
          own unique classes live here — everything shared moved to globals.css. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .connectForm { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 20px; }
        .connectForm input { flex: 1; min-width: 180px; padding: 8px 10px; border-radius: 6px; border: 1px solid #d8d7cf; background: #fcfcfb; font-size: 13px; }
        .connectForm button, .understanding + form button { padding: 6px 14px; border-radius: 6px; border: 1px solid #2a78d6; background: #2a78d6; color: #fff; font-size: 13px; cursor: pointer; }
        .documents { margin-top: 20px; font-size: 13px; }
        .documents summary { cursor: pointer; color: #2a78d6; font-weight: 600; margin-bottom: 12px; }
        .understanding { border: 1px solid #e1e0d9; border-radius: 6px; padding: 20px; margin-bottom: 16px; }
        .summary { font-size: 14px; line-height: 1.6; margin: 0 0 8px; }
        .summaryKn { font-size: 13px; color: #52514e; line-height: 1.6; margin: 0 0 20px; }
        .knowledgeGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; }
        .knowledgeCard { background: #f9f9f7; border-radius: 6px; padding: 12px 14px; }
        .knowledgeLabel { display: block; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; color: #898781; font-weight: 700; margin-bottom: 8px; }
        .knowledgeCard ul { margin: 0; padding-left: 16px; font-size: 12.5px; line-height: 1.6; }
        @media (prefers-color-scheme: dark) {
          .summaryKn { color: #c3c2b7; }
          .connectForm input { background: #1a1a19; border-color: #2c2c2a; color: #fff; }
          .understanding { border-color: #2c2c2a; }
          .knowledgeCard { background: #14161b; }
        }
      `,
        }}
      />
    </main>
  );
}
