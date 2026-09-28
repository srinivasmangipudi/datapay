export const shorthands = undefined;

// product_orders was the one member-initiated write with no idempotency key.
// responses and snaps both carry a UNIQUE client_msg_id (§15C) precisely
// because a rural connection drops responses, not requests: the server commits,
// the reply never arrives, the member taps again. For an answer that would have
// double-credited tokens. For an order it double-decrements stock and creates a
// second delivery — worse, and on exactly the connectivity the pilot targets.
//
// Nullable rather than notNull: product_orders has zero rows today, but a
// nullable column keeps this migration safe if any land between writing and
// running it, and the API rejects a missing key at the DTO layer anyway.
export const up = (pgm) => {
  pgm.addColumn("product_orders", { client_msg_id: { type: "uuid" } });
  pgm.addConstraint("product_orders", "product_orders_client_msg_unique", {
    unique: ["client_msg_id"],
  });
};

export const down = (pgm) => {
  pgm.dropConstraint("product_orders", "product_orders_client_msg_unique");
  pgm.dropColumn("product_orders", "client_msg_id");
};
