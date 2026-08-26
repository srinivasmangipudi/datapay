import { listOrganizations } from "./core-api";
import { createOrganizationAction } from "./actions";

export const dynamic = "force-dynamic";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: { error?: string; created?: string };
}): Promise<JSX.Element> {
  const organizations = await listOrganizations();

  return (
    <main className="page">
      <p className="eyebrow">DataPay Portal · Ops</p>
      <h1>Organizations</h1>
      <p className="lede">
        Company accounts that can log in separately, at <code>/org/login</code>, and submit their
        own questions — every one lands in the review queue as a draft, never auto-approved.
      </p>

      {searchParams.error && (
        <div className="errorBanner">
          <strong>Couldn't create organization:</strong> {searchParams.error}
        </div>
      )}
      {searchParams.created && <div className="successBanner">Organization created.</div>}

      <form className="wizard" action={createOrganizationAction}>
        <div className="step">
          <span className="stepLabel">New organization</span>
          <input name="name" placeholder="Company name" required />
          <input name="email" type="email" placeholder="Login email" required />
          <input name="password" type="password" placeholder="Password (min 8 characters)" minLength={8} required />
        </div>
        <button type="submit" className="submitBtn">
          Create organization
        </button>
      </form>

      <section className="section">
        <h2>Existing organizations ({organizations.length})</h2>
        {organizations.length === 0 && <p className="empty">None created yet.</p>}
        {organizations.length > 0 && (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Login email</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((o) => (
                  <tr key={o.id}>
                    <td>{o.name}</td>
                    <td className="mono small">{o.email}</td>
                    <td className="small muted">{formatWhen(o.created_at)}</td>
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
