"use client";

import { useState } from "react";
import { DataPayMark } from "../components/DataPayLogo";
import { deliveryLogin, listMyDeliveries, type DeliveryJob } from "./core-api";

/**
 * The delivery person's surface.
 *
 * Built for a phone held in one hand at a doorstep, not a desk: big targets,
 * short lines, no navigation to get lost in. They are not ops and never see the
 * ops portal — a separate token type enforces that server-side, and this page
 * shows no route into it.
 *
 * Identity-blind like every other view of an order: a relay token and what to
 * carry, never a member's name or alias. The address is resolved separately.
 *
 * The session lives in component state, not a cookie: a shared phone at a PACS
 * counter should not stay signed in after the person walks away.
 */
export function DeliveryApp(): JSX.Element {
  const [token, setToken] = useState<string | null>(null);
  const [agent, setAgent] = useState<{ name: string; zoneName: string } | null>(null);
  const [jobs, setJobs] = useState<DeliveryJob[] | null>(null);

  const [phone, setPhone] = useState("");
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await deliveryLogin(phone, passcode);
      setToken(res.token);
      setAgent({ name: res.name, zoneName: res.zoneName });
      setJobs(await listMyDeliveries(res.token));
      setPasscode("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    if (!token) return;
    setBusy(true);
    try {
      setJobs(await listMyDeliveries(token));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!token || !agent) {
    return (
      <main className="dWrap">
        <div className="dCard">
          <DataPayMark size={40} />
          <h1 className="dTitle">Delivery sign-in</h1>
          <p className="dSub">Use the number and passcode DataPay gave you.</p>

          {error && <div className="dError">{error}</div>}

          <form onSubmit={signIn} className="dForm">
            <label className="dField">
              <span>Mobile number</span>
              <input
                id="deliveryPhone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="numeric"
                autoComplete="tel"
                placeholder="98765 43210"
                required
              />
            </label>
            <label className="dField">
              <span>Passcode</span>
              <input
                id="deliveryPasscode"
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <button type="submit" className="dBtn" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="dWrap dWrapList">
      <header className="dHeader">
        <div>
          <p className="dHello">{agent.name}</p>
          <p className="dZone">{agent.zoneName}</p>
        </div>
        <button type="button" className="dRefresh" onClick={refresh} disabled={busy}>
          {busy ? "…" : "Refresh"}
        </button>
      </header>

      {error && <div className="dError">{error}</div>}

      <h2 className="dCount">
        {jobs === null ? "Loading…" : jobs.length === 0 ? "Nothing to deliver" : `${jobs.length} to deliver`}
      </h2>

      {jobs?.length === 0 && (
        <p className="dEmpty">New orders in your area will appear here.</p>
      )}

      {jobs?.map((job) => (
        <article key={job.id} className="dJob">
          <p className="dJobName">
            {job.name_en}
            {job.unit_spec ? <span className="dJobUnit"> · {job.unit_spec}</span> : null}
          </p>
          <p className="dJobMeta">
            {job.quantity} × · {job.organization_name}
          </p>
          {/* The relay token is the only handle on the delivery. It means
              nothing on its own — the address resolves through Vault — so it is
              safe to show, and it is what ops will ask for on the phone. */}
          <p className="dJobToken">
            <span className="dJobTokenLabel">Order code</span>
            <code>{job.relay_token.slice(0, 8).toUpperCase()}</code>
          </p>
        </article>
      ))}

      <p className="dFootnote">
        Call the DataPay ops number for the delivery address. It is never shown here — members stay
        anonymous until the doorstep.
      </p>
    </main>
  );
}
