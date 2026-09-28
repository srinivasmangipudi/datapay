export const shorthands = undefined;

// Two things a real catalog needs.
//
// 1. SKU. A product's identity on re-import was `dedup_key`, a normalized
//    LOWERCASED NAME. So "Sun King Home 40 Plus" and "Sun King Home 40+" were
//    two products, and renaming one in the source sheet silently created a
//    duplicate — stranding the original along with its orders and whatever
//    rates ops had set on it. When the org's sheet carries its own code we now
//    key on that instead, so a rename is a rename.
//
//    Deliberately NOT mandatory: plenty of small sellers have no SKU at all.
//    With no SKU the old name-matching still applies, which means changing the
//    name creates a new product — now the documented behaviour rather than a
//    surprise, and the way an org without SKUs deliberately forks a listing.
//
// 2. Ops delisting. review_state already gates a product ENTERING the
//    marketplace, but nothing could pull an approved one back out. Ops needs
//    the final say over what members see regardless of what the org does with
//    stock or prices, so this is a separate column: re-approving or restocking
//    must not quietly relist something ops pulled.
export const up = (pgm) => {
  pgm.addColumns("org_products", {
    // The organization's own product code, as it appears in their sheet.
    sku: { type: "text" },
    // Ops-only. Non-null means hidden from members, whatever review_state says.
    delisted_at: { type: "timestamptz" },
    delisted_reason: { type: "text" },
  });

  // Scoped per organization — two different sellers may legitimately use the
  // same code. Partial, because most rows will have no SKU and NULLs must not
  // collide with each other.
  pgm.createIndex("org_products", ["organization_id", "sku"], {
    name: "org_products_org_sku_unique",
    unique: true,
    where: "sku IS NOT NULL",
  });

  pgm.createIndex("org_products", "delisted_at", {
    name: "org_products_delisted_idx",
    where: "delisted_at IS NULL",
  });
};

export const down = (pgm) => {
  pgm.dropIndex("org_products", "delisted_at", { name: "org_products_delisted_idx", ifExists: true });
  pgm.dropIndex("org_products", ["organization_id", "sku"], {
    name: "org_products_org_sku_unique",
    ifExists: true,
  });
  pgm.dropColumns("org_products", ["sku", "delisted_at", "delisted_reason"]);
};
