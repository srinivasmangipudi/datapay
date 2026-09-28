export const shorthands = undefined;

// Both economics rates become per-product, defaulting to the platform-wide 2%.
//
// Stored as basis points (200 bps = 2.00%) rather than a float: rates get
// multiplied by paise amounts and rounded, and integer bps keeps that exact.
// A percentage stored as 0.02 in a float column is the kind of thing that
// silently pays someone 19 tokens instead of 20.
//
// NULL means "use the platform default" rather than 0 — so changing the
// default later moves every product that never set one, instead of leaving
// them frozen at whatever the default happened to be at insert time.
export const up = (pgm) => {
  pgm.addColumns("org_products", {
    // What the BUYER earns back as tokens on a purchase.
    token_reward_bps: { type: "integer" },
    // What the SUPPLIER pays the platform, which builds the reward pool.
    platform_fee_bps: { type: "integer" },
  });
  pgm.addConstraint("org_products", "org_products_token_reward_bps_range", {
    check: "token_reward_bps IS NULL OR (token_reward_bps >= 0 AND token_reward_bps <= 10000)",
  });
  pgm.addConstraint("org_products", "org_products_platform_fee_bps_range", {
    check: "platform_fee_bps IS NULL OR (platform_fee_bps >= 0 AND platform_fee_bps <= 10000)",
  });
};

export const down = (pgm) => {
  pgm.dropConstraint("org_products", "org_products_platform_fee_bps_range");
  pgm.dropConstraint("org_products", "org_products_token_reward_bps_range");
  pgm.dropColumns("org_products", ["token_reward_bps", "platform_fee_bps"]);
};
