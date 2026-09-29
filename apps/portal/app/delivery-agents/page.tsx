import { getPortalPool } from "../db";
import {
  createDeliveryAgentAction,
  resetDeliveryAgentPasswordAction,
  setDeliveryAgentActiveAction,
} from "./actions";
import { listDeliveryAgents, type DeliveryAgent } from "./core-api";

export const dynamic = "force-dynamic";

interface Zone {
  id: string;
  name: string;
  level: string;
}

// Zones are in the portal role's direct-read grant (§10), so this reads them
// straight rather than through Core API — same as fund/page.tsx.
async function getZones(): Promise<Zone[]> {
  const pool = getPortalPool();
  const { rows } = await pool.query<Zone>(`SELECT id, name, level FROM zones ORDER BY level, name`);
  return rows;
}

function formatPhone(e164: string): string {
  // +919876543210 -> +91 98765 43210, which is how anyone here reads it back.
  const m = e164.match(/^\+91(\d{5})(\d{5})$/);
  return m ? `+91 ${m[1]} ${m[2]}` : e164;
}

export default async function DeliveryAgentsPage({
  searchParams,
}: {
  searchParams: {
    error?: string;
    created?: string;
    passcode?: string;
    deactivated?: string;
    reactivated?: string;
  };
}): Promise<JSX.Element> {
  const [agents, zones] = await Promise.all([listDeliveryAgents(), getZones()]);
  const active = agents.filter((a: DeliveryAgent) => a.active);

  return (
    <main className="page">
      <header className="pageHead">
        <p className="eyebrow">DataPay Portal · Ops</p>
        <h1>Delivery people</h1>
        <p className="lede">
          Onboard someone with their mobile number and the area they cover, then give them the
          passcode. They sign in at <code>/delivery</code> — a separate surface from this portal,
          which they never see. {active.length} active of {agents.length}.
        </p>
      </header>

      {searchParams.error && (
        <div className="errorBanner">
          <strong>Couldn&apos;t save:</strong> {searchParams.error}
        </div>
      )}
      {searchParams.deactivated && (
        <div className="successBanner">Deactivated. They can no longer sign in.</div>
      )}
      {searchParams.reactivated && <div className="successBanner">Reactivated.</div>}
      {searchParams.created && searchParams.passcode && (
        <div className="passcodeBanner">
          <strong>{searchParams.created} can now sign in at /delivery</strong>
          <span className="passcodeRow">
            Passcode: <code className="passcode">{searchParams.passcode}</code>
          </span>
          <span className="passcodeNote">
            Write this down or tell them now — it is stored hashed and cannot be shown again.
            Losing it means issuing a new one.
          </span>
        </div>
      )}

      <section className="section">
        <h2>Onboard a delivery person</h2>
        <form action={createDeliveryAgentAction} className="agentForm">
          <label className="field">
            <span className="fieldLabel">Name</span>
            <input name="name" required maxLength={120} placeholder="Ravi Kumar" />
          </label>
          <label className="field">
            <span className="fieldLabel">Mobile number</span>
            <input
              name="phone"
              required
              inputMode="numeric"
              placeholder="98765 43210"
              aria-describedby="phoneHint"
            />
            <span id="phoneHint" className="fieldHint">
              With or without +91 — it is normalised either way.
            </span>
          </label>
          <label className="field">
            <span className="fieldLabel">Area covered</span>
            <select name="zoneId" required defaultValue="">
              <option value="" disabled>
                Choose a zone…
              </option>
              {zones.map((z: Zone) => (
                <option key={z.id} value={z.id}>
                  {z.name} · {z.level}
                </option>
              ))}
            </select>
            <span className="fieldHint">
              Covers every zone beneath this one, so a taluk needs no row per village.
            </span>
          </label>
          <label className="field">
            <span className="fieldLabel">Passcode</span>
            <input name="password" required minLength={6} maxLength={200} placeholder="At least 6 characters" />
            <span className="fieldHint">You choose it and tell them. Shown once, then hashed.</span>
          </label>
          <button type="submit" className="submitBtn">
            Add delivery person
          </button>
        </form>
      </section>

      <section className="section">
        <h2>Everyone onboarded ({agents.length})</h2>
        {agents.length === 0 && <p className="empty">Nobody onboarded yet.</p>}
        {agents.length > 0 && (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Mobile</th>
                  <th>Area</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {agents.map((a: DeliveryAgent) => (
                  <tr key={a.id}>
                    <td>{a.name}</td>
                    <td className="mono small">{formatPhone(a.phone_e164)}</td>
                    <td className="small">
                      {a.zone_name} <span className="muted">· {a.zone_level}</span>
                    </td>
                    <td>
                      <span className={a.active ? "pillOn" : "pillOff"}>
                        {a.active ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    <td className="actions">
                      <form action={setDeliveryAgentActiveAction}>
                        <input type="hidden" name="agentId" value={a.id} />
                        <input type="hidden" name="active" value={a.active ? "false" : "true"} />
                        <button type="submit" className={a.active ? "rejectBtn" : "approveBtn"}>
                          {a.active ? "Deactivate" : "Reactivate"}
                        </button>
                      </form>
                      <form action={resetDeliveryAgentPasswordAction}>
                        <input type="hidden" name="agentId" value={a.id} />
                        <input type="hidden" name="name" value={a.name} />
                        <input
                          name="password"
                          minLength={6}
                          required
                          placeholder="New passcode"
                          className="resetInput"
                          aria-label={`New passcode for ${a.name}`}
                        />
                        <button type="submit" className="linkBtn">
                          Reset
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

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .agentForm { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 18px; align-items: end; max-width: 1000px; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        .fieldLabel { font-size: 13px; font-weight: 600; color: var(--text-2); }
        .fieldHint { font-size: 12px; color: var(--text-3); line-height: 1.45; }
        .agentForm input, .agentForm select { padding: 10px 12px; border-radius: var(--r-md); border: 1px solid var(--edge-strong); background: var(--surface); font-size: 14px; font-family: inherit; color: var(--text); }
        .agentForm .submitBtn { align-self: end; }

        /* The one moment the passcode exists in readable form. Loud on purpose:
           closing this page without noting it means issuing a new one. */
        .passcodeBanner { display: flex; flex-direction: column; gap: 8px; padding: 18px 20px; border: 1px solid var(--jade); background: var(--jade-soft); border-radius: var(--r-md); margin-bottom: 24px; }
        .passcodeRow { font-size: 14.5px; }
        .passcode { font-family: var(--font-mono); font-size: 17px; font-weight: 700; background: var(--surface); padding: 3px 10px; border-radius: var(--r-sm); border: 1px solid var(--edge-strong); letter-spacing: 0.06em; }
        .passcodeNote { font-size: 12.5px; color: var(--text-2); line-height: 1.5; }

        .pillOn { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; background: var(--jade-soft); color: var(--jade); }
        .pillOff { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; background: var(--danger-soft); color: var(--danger); }
        td.actions { display: table-cell; white-space: nowrap; }
        td.actions form { display: inline-flex; align-items: center; gap: 6px; margin-right: 10px; }
        .resetInput { width: 130px; padding: 6px 8px; font-size: 12.5px; border-radius: var(--r-sm); border: 1px solid var(--edge-strong); background: var(--surface); color: var(--text); font-family: inherit; }
      `,
        }}
      />
    </main>
  );
}
