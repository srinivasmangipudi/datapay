import { listSnaps } from "./core-api";
import { reviewSnapAction } from "./actions";

export const dynamic = "force-dynamic";

const STATES = ["uploaded", "recognized", "member_confirmed", "ops_verified", "rejected"];

export default async function SnapsPage({
  searchParams,
}: {
  searchParams: { state?: string; error?: string };
}): Promise<JSX.Element> {
  const state = searchParams.state ?? "uploaded";
  const snaps = await listSnaps(state === "all" ? undefined : state);

  return (
    <main className="page">
      <p className="eyebrow">DataPay Portal · Ops</p>
      <h1>Snap verification</h1>
      <p className="lede">
        A member snaps what they use as photo evidence for a category. Verifying a snap moves it to{" "}
        <span className="mono small">ops_verified</span> and gives the member a small trust-score
        bump (SPEC.md §6); rejecting closes it out with no penalty. Real image storage isn't wired up
        yet — <span className="mono small">storageKey</span> below is a dev-stub reference, not a
        real photo URL. "AI tags" is Gemini's own guess at what the photo shows (SPEC.md §32) — ops-
        assist only, never a substitute for actually looking at the evidence.
      </p>

      {searchParams.error && (
        <div className="errorBanner">
          <strong>Action failed:</strong> {searchParams.error}
        </div>
      )}

      <form method="GET" className="zonePicker">
        <label htmlFor="state">State</label>
        <select id="state" name="state" defaultValue={state}>
          {STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          <option value="all">all</option>
        </select>
        <button type="submit">Switch</button>
      </form>

      <section className="section">
        <h2>
          {state === "all" ? "All snaps" : `Snaps — ${state}`} ({snaps.length})
        </h2>
        {snaps.length === 0 && <p className="empty">Nothing here right now.</p>}
        {snaps.length > 0 && (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Alias</th>
                  <th>Category</th>
                  <th>AI tags</th>
                  <th>Storage key</th>
                  <th>Captured</th>
                  <th className="num">Reward</th>
                  <th>State</th>
                  {state !== "ops_verified" && state !== "rejected" && <th />}
                </tr>
              </thead>
              <tbody>
                {snaps.map((s) => (
                  <tr key={s.id}>
                    <td className="mono small">{s.id}</td>
                    <td className="mono small">{s.aliasId.slice(0, 12)}…</td>
                    <td>{s.categoryId ?? <span className="muted">—</span>}</td>
                    <td className="small">
                      {s.recognizedTags.length > 0 ? (
                        <>
                          {s.recognizedProductGuess && <div>{s.recognizedProductGuess}</div>}
                          <div className="muted">{s.recognizedTags.join(", ")}</div>
                          {s.recognizedCategoryName && (
                            <div className="muted">→ {s.recognizedCategoryName}</div>
                          )}
                          {s.recognizedConfidence !== null && (
                            <div className="muted">{Math.round(s.recognizedConfidence * 100)}% confident</div>
                          )}
                        </>
                      ) : (
                        <span className="muted">
                          {s.state === "uploaded" ? "Pending…" : "—"}
                        </span>
                      )}
                    </td>
                    <td className="mono small">{s.storageKey}</td>
                    <td className="muted small">{new Date(s.capturedAt).toLocaleString()}</td>
                    <td className="num value">{s.rewardTokens} ◈</td>
                    <td className="small">{s.state}</td>
                    {s.state !== "ops_verified" && s.state !== "rejected" && (
                      <td className="actions">
                        <form action={reviewSnapAction}>
                          <input type="hidden" name="snapId" value={s.id} />
                          <input type="hidden" name="decision" value="verify" />
                          <button type="submit" className="approveBtn">
                            Verify
                          </button>
                        </form>
                        <form action={reviewSnapAction}>
                          <input type="hidden" name="snapId" value={s.id} />
                          <input type="hidden" name="decision" value="reject" />
                          <button type="submit" className="rejectBtn">
                            Reject
                          </button>
                        </form>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
