export const shorthands = undefined;

// token_reward_bps (a percentage of spend) becomes purchase_reward_tokens (a
// flat count per order).
//
// A reward proportional to spend means more money in gets more tokens out, and
// tokens determine a share of the reward pool — which is the structure of an
// investment return, the exact thing DataPay's copy is careful not to be. A
// flat count rewards the ACT of buying through the platform, on the same scale
// as answering a question, and says nothing about how much anyone spent.
//
// platform_fee_bps deliberately STAYS in basis points: it is what a supplier
// pays DataPay on a sale, ordinary B2B revenue, and is not a member reward. A
// percentage is the right shape there and carries none of the same risk.
//
// Safe as a drop-and-add: org_products had no rows with a rate set (the column
// shipped hours earlier and ops had not used it yet), so there is nothing to
// convert.
export const up = (pgm) => {
  pgm.dropConstraint("org_products", "org_products_token_reward_bps_range");
  pgm.dropColumn("org_products", "token_reward_bps");
  pgm.addColumn("org_products", {
    // NULL means "use the platform default"; 0 means "explicitly no reward".
    purchase_reward_tokens: { type: "integer" },
  });
  pgm.addConstraint("org_products", "org_products_purchase_reward_range", {
    check: "purchase_reward_tokens IS NULL OR (purchase_reward_tokens >= 0 AND purchase_reward_tokens <= 1000)",
  });
};

export const down = (pgm) => {
  pgm.dropConstraint("org_products", "org_products_purchase_reward_range");
  pgm.dropColumn("org_products", "purchase_reward_tokens");
  pgm.addColumn("org_products", { token_reward_bps: { type: "integer" } });
  pgm.addConstraint("org_products", "org_products_token_reward_bps_range", {
    check: "token_reward_bps IS NULL OR (token_reward_bps >= 0 AND token_reward_bps <= 10000)",
  });
};
