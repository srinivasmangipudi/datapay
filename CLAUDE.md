# Working in this repo

## Verifying UI changes

Written after shipping a marketing section whose cards sat jammed against the
band above them. It typechecked, it built, it had zero horizontal overflow, the
two cards measured identically — and it looked broken. The verification was the
problem, not the taste.

**Screenshot the viewport, never the element.** The bug that session was a
missing `padding-top`, and the artefact used to check the work was
`locator(".theBlock").screenshot()` — which crops exactly at the element's
bounding box. The defect and the crop line were the same edge, so the one image
looked at could not possibly have shown it.

**Capture the seam, not the section.** Spacing problems live *between* blocks.
A screenshot of a block in isolation has no information about whether it sits
correctly against its neighbours. Scroll so the boundary above and below is in
frame.

**Take vertical rhythm from the existing token.** This repo has `--section-y`
and `--gutter`. A hand-rolled `padding: 0 var(--gutter) 64px` is how a block
ends up with no top padding at all while every sibling has 130px. If a new
block genuinely needs different spacing, derive it from the token and say why
in a comment.

**Judge a new block against the ones above and below it.** "Does this look
fine?" is the wrong question. "Does this look like it belongs between those
two?" is the one that catches real problems.

**Measurement is not looking.** `overflow === 0`, equal widths and equal heights
all pass on a layout that reads as broken. Measurement answers *is it broken*;
only looking answers *does it breathe*. Run both, and describe what is wrong
with the image before claiming the change is done.

**Check 1920 / 1440 / 1280 / 400.** Bugs in this repo have hidden at 1920 (a
grid that only overflows when there is room to spare) and at 400 (a fixed
`min-width` wider than the screen). Testing one width is testing nothing.

## Claims must match code

SPEC.md §11: every user-facing claim maps to a tested code path. This has broken
twice by the same mechanism — a number hardcoded in copy that silently became
false when config changed. The k-anonymity floor is the live example: it is read
from the API and substituted into the copy, never written as a literal. If copy
states a threshold, a rate or a guarantee, it reads the real value.

## The two-plane boundary

LAW 1 (SPEC.md §2) is not a convention, it is enforced: separate databases,
separate credentials, a portal DB role without SELECT on member tables.

The test for where something belongs: **is this how to reach or pay a person?**
Phone numbers, delivery addresses, UPI IDs and push tokens all are, so all live
in Vault. Core decides *who* (only Core knows who has pending questions or is
owed a payout); Vault resolves *how to reach them*, in batch. Follow
`PayoutService.resolvePayoutBatch` — it is the reference shape.

A payment reference once sat in Core next to an alias_id. Not PII on its face,
but a join key into records that do identify someone. It moved.

## Money paths

- **Ledger writes are idempotent by constraint**, not convention —
  `UNIQUE(ref_type, ref_id)`. A retried credit hits a violation instead of
  paying twice.
- **Member-initiated writes carry a `client_msg_id`.** Rural connectivity drops
  responses, not requests: the server commits, the reply never lands, the member
  taps again. `product_orders` shipped without one and could double-order.
- **Token rewards are flat, never proportional to spend.** More money in
  producing more tokens out is an investment return however the copy words it.
  See `purchaseTokenReward` in `@datapay/shared`.
- **Tokens never expire.** A product commitment with a test enforcing it
  (`no-token-expiry.spec.ts`).

## Tests

Integration tests share one database and run `--runInBand`. Several have failed
by asserting a **global** property that a sibling suite legitimately violates —
"realisedSalesVelocity is 0" really meant "no other test ran first". Assert the
invariant under test, not the state of the whole database.

The Vault process tests spawn is `apps/vault/dist/main.js`, the **built**
output. Editing Vault source without rebuilding means tests run against stale
code, and the failure looks like a logic bug.

## Deploys

Services do not auto-deploy from `mainbranch`; `railway up --service X --detach`
is explicit. Order matters when a migration and code depend on each other:
Vault migration → deploy Vault → Core migration → deploy API → deploy portal.
Run production migrations with `infra/migrate-prod.mjs`, which takes its URL
only from Railway and refuses to touch localhost.
