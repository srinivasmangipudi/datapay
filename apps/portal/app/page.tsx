// §10 boundary: this app, and every route added under it, may only ever query
// demand_aggregates / offers / linkages via the portal's restricted DB role.
// It must have no code path to responses, snaps, members, or Vault.
export default function PortalHome() {
  return (
    <main>
      <h1>DataPay Portal</h1>
      <p>Supplier + ops back office. Screens land in Phase 3.</p>
    </main>
  );
}
