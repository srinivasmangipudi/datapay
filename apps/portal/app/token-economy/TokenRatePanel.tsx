import { DEFAULT_PLATFORM_FEE_BPS, DEFAULT_TOKEN_REWARD_BPS } from "@datapay/shared";
import type { TokenRateDetail } from "./core-api";

function rupees(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

/**
 * Shows the rate AND its derivation. The point isn't the number — it's that
 * the number is currently pinned to the floor and why, which is invisible if
 * you only publish the rate.
 */
export function TokenRatePanel({ detail }: { detail: TokenRateDetail }): JSX.Element {
  const { current, inputs, floorPaise, ceilingPaise, history } = detail;
  const combined = inputs.demandPressure * inputs.realisedSalesVelocity * inputs.supplierCompetition;
  const projectedPaise = Math.round(floorPaise + combined * (ceilingPaise - floorPaise));
  const atFloor = projectedPaise <= floorPaise;

  const rows: Array<{ name: string; value: number; note: string }> = [
    {
      name: "Demand pressure",
      value: inputs.demandPressure,
      note: "Members who answered in the last 7 days, over total members.",
    },
    {
      name: "Realised sales velocity",
      value: inputs.realisedSalesVelocity,
      note: "Declared intents in the last 30 days that reached a delivered offer.",
    },
    {
      name: "Supplier competition",
      value: inputs.supplierCompetition,
      note: "Hardcoded 0 — requires competing bids per demand, which don't exist yet.",
    },
  ];

  return (
    <section className="section">
      <div className="sectionHead">
        <h2>Token rate</h2>
      </div>

      <p className="lede">
        The engine-set reference rate (SPEC §6C). It is <strong>not</strong> a price anyone can
        redeem at and is never shown to members as a cash value — it exists to price token terms on
        collective offers.
      </p>

      <div className="tiles">
        <div className="tile">
          <span className="tileLabel">Published rate</span>
          <span className="tileValue value">
            {current ? rupees(current.rate_paise) : "—"}
          </span>
        </div>
        <div className="tile">
          <span className="tileLabel">Floor / ceiling</span>
          <span className="tileValue value">
            {rupees(floorPaise)} – {rupees(ceilingPaise)}
          </span>
        </div>
        <div className="tile">
          <span className="tileLabel">Next run would publish</span>
          <span className="tileValue value">{rupees(projectedPaise)}</span>
        </div>
        <div className="tile">
          <span className="tileLabel">Last computed</span>
          <span className="tileValue">
            {current ? new Date(current.computed_at).toLocaleString() : "Never"}
          </span>
        </div>
      </div>

      <h3 className="subhead">How it&apos;s calculated</h3>
      <pre className="formula">
        rate = floor + (demandPressure × realisedSalesVelocity × supplierCompetition) × (ceiling −
        floor)
      </pre>

      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Input</th>
              <th className="num">Current</th>
              <th>What it measures</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td>{r.name}</td>
                <td className="num">{pct(r.value)}</td>
                <td className="muted small">{r.note}</td>
              </tr>
            ))}
            <tr>
              <td>
                <strong>Combined</strong>
              </td>
              <td className="num">
                <strong>{pct(combined)}</strong>
              </td>
              <td className="muted small">The three multiplied together.</td>
            </tr>
          </tbody>
        </table>
      </div>

      {atFloor && (
        <div className="errorBanner">
          <strong>The rate is pinned at the floor.</strong> The three inputs are{" "}
          <em>multiplied</em>, and supplier competition is hardcoded to 0 — so the product is 0 and
          the rate can only ever be {rupees(floorPaise)} until competing supplier bids exist. The
          other two inputs have no effect on the published rate today, however they move.
        </div>
      )}

      <h3 className="subhead">Purchase rates</h3>
      <p className="lede">
        Platform-wide defaults, overridable per product on the org catalog. Stored as basis points
        so the arithmetic stays exact.
      </p>
      <div className="tiles">
        <div className="tile">
          <span className="tileLabel">Buyer token reward</span>
          <span className="tileValue value">{(DEFAULT_TOKEN_REWARD_BPS / 100).toFixed(2)}%</span>
        </div>
        <div className="tile">
          <span className="tileLabel">Supplier platform fee</span>
          <span className="tileValue value">{(DEFAULT_PLATFORM_FEE_BPS / 100).toFixed(2)}%</span>
        </div>
      </div>

      {history.length > 0 && (
        <>
          <h3 className="subhead">History</h3>
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th className="num">Rate</th>
                  <th>Computed</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 20).map((h) => (
                  <tr key={h.computed_at}>
                    <td className="num value">{rupees(h.rate_paise)}</td>
                    <td className="muted">{new Date(h.computed_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
