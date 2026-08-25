# Token Economy Redesign — Design Notes (2026-07-28)

**Status: the "settled mechanism" section below is now implemented and tested — see SPEC.md §41.**
This document still captures the full design conversation, including the parts that are
deliberately NOT built yet (see "still genuinely open" below — dividend distribution, the legal
entity, per-zone vs. platform-wide corpus, trust_score). Read SPEC.md §41 for what's actually live;
read this file for why, and for what's intentionally still just an idea.

## Why §40 needed replacing

The original model tried to make a token's "realised" state mean something real (backed by an
actual reserved rupee, tied to a specific delivered offer), but every attempt to make that precise
broke down: two disconnected numbers both claimed to be "what a token is worth" (the published
`token_rate` vs. a fixed per-offer `token_value_paise`), the "reserve" was bookkeeping with no real
money behind it, and self-reported delivery confirmation was the only verification for anything.
Chasing precision here kept producing dodgy logic, not soundness.

## The actual goal, restated

This isn't "how do we optimize a rewards program." The founding motivation is: today, the value in
personal data and collective purchasing power gets captured by companies (ad-tech, data brokers, AI
labs training on people's work, even ordinary market research panels) while the people who actually
generated that value get little or nothing back. DataPay should be the opposite of that — a real
institution, owned in spirit by its members, that captures value collectively and returns it
honestly. The rural local-trade angle (rice, farmers, PACS) is the proving ground for the trust
infrastructure this needs (identity/data separation, consent, k-anonymity) — not the ceiling of the
ambition.

Real-world precedents that grounded this conversation, so they don't get lost:
- **Pinduoduo, Groupon, Amul** — proof that "aggregate demand → real bargaining power → a supplier
  pays for guaranteed volume" is a proven, bankable model, not a hypothetical one.
- **Premise Data, Streetbees** — proof that companies really do pay real money for specific,
  consented data-collection tasks (surveys, photos) at commercial scale.
- **The Alaska Permanent Fund** — proof that "invest the corpus permanently, distribute only the
  yield, forever" builds real, decades-long trust at a societal scale.
- **Indian cooperative societies** (dairy cooperatives, PACS) — the legal and cultural precedent for
  patronage-based dividends from a collectively-owned, invested corpus. Not a novel legal structure —
  a well-trodden one.
- Data-trust/data-union models (MIDATA, Driver's Seat Cooperative, Web3 data unions) were considered
  and found to have a **weak** commercial track record — the value was never in raw data alone, only
  in a real transaction or a real, consented, structured task behind it. This is why the model below
  anchors to real purchases and real fees, not to "selling data" as an abstract product.

## The settled mechanism

1. **Answering a question earns tokens.** Default reward is 1 token per question (down from the
   current default of 4), but this stays a per-question configurable field exactly as it is today
   (`CreateQuestionDtoSchema.rewardTokens`) — a photo question, for example, might still be set to 2.

2. **Buying a product through the platform also earns tokens** — worth 2% of the amount spent. This
   is a new, second way to earn the same kind of token, not a mechanism that "unlocks" or
   "actualises" previously-earned tokens. There is no attempt to trace which past question answers
   "led to" a given purchase — that causal chain was tried and explicitly rejected as dodgy logic
   (unprovable, gameable, and resting on a category-matching or intent-linking scheme that was never
   going to be fair or precise). A purchase is just another token-earning event.

3. **Every token is equal, always.** There is no issued/realised/actualised state distinction
   anymore. A token earned from answering a question and a token earned from a purchase are the
   same thing, and both count toward the same thing: your share of the dividend pool.

4. **The supplier pays 2% of the sale price into a corpus fund — and gets no tokens for it.** This
   is the platform's real revenue mechanism, a transaction fee, the same shape as any real
   marketplace commission (and a conservative one — Amazon's referral fees run 8-15%, Groupon
   historically took up to 50%). Suppliers were deliberately considered and rejected as
   token/dividend recipients: the dividend pool exists *for members*, and a supplier's transaction
   volume can dwarf what any individual member ever spends — giving suppliers tokens on the same
   basis would let them dominate the token supply and dilute members out of their own fund. Suppliers
   already get two real things from participating (access to demand, a margin on the sale); a claim
   on the members' dividend pool would be a third, paid for by diluting the first two groups it's
   meant to serve. If supplier loyalty/repeat-business ever needs its own incentive, it should be a
   separate mechanism (priority placement, a lower fee tier for repeat good-faith suppliers) — never
   a shared claim on the same corpus.

5. **The corpus fund is never spent down.** Implemented: `corpus_fund_ledger` only ever accrues
   (append-only, same as every other real-money ledger in this codebase). **Not yet implemented:**
   actually investing it (the working example discussed was a fixed deposit) — right now it just
   accumulates in the ledger, not in a real bank/FD account. Only the **returns/interest** on the
   corpus are meant to get distributed as dividends, on some regular cadence — neither the
   investment nor the distribution exists yet (see open questions).

6. **Your dividend each period is your token count's share of that period's distributable return.**
   Not yet implemented — there's no distributable return to divide until the corpus is actually
   invested. The token balance / total-tokens numbers this would use already exist and are exposed
   via the admin overview endpoint.

7. **The token's "price"** (what gets published as "1 token is worth ₹X") is derived directly from
   this real, auditable number — this period's actual distributed return divided by outstanding
   tokens — not from a speculative formula and never from a freely tradeable market. This was an
   explicit, deliberate choice: tokens can become worth more *in redemption/dividend value* over
   time as the corpus and its returns grow, but must never be resellable/tradeable at a
   speculative price. The moment a token can be bought and sold expecting the price to rise from
   someone else's efforts, it starts to look like an unregistered security (the Howey Test), which is
   exactly the compliance posture (§11) the original design was built to avoid.

## What this replaces

- §40 in full: `reserve_ledger`, `ReserveService`, the "issued vs. realised" distinction on
  `members.token_balance`, and the ◇/◆ hollow/filled diamond UI — all superseded by "every token is
  equal, dividend is by token-share."
- §6C's `token_rate` formula (demand pressure × realised sales velocity × supplier competition) —
  superseded by "price is derived from actual distributed corpus returns," a real number instead of
  a proxy formula.

## What's still genuinely open — do not silently decide these when building

1. **Does §17's existing community Fund (20% of collective-buy savings, spent on member-voted
   projects like streetlight repairs) still exist as a separate thing, or does it merge into this
   corpus?** These serve different purposes — one is a collective *spending* pot for local
   infrastructure, the other is a permanent, *never-spent* investment corpus paying personal
   dividends. They were never explicitly reconciled in this conversation.

2. **Is there one single, platform-wide corpus, or one per zone?** The founding idea was
   *local* trade — buy from around you first. A single national corpus would mean a Melukote
   member's dividend depends on purchases happening anywhere on the platform, not just locally,
   which may or may not match the "local" spirit this started from.

3. **Does trust_score play any role here?** Before the final simplification, weighting rewards by
   `members.trust_score` (which already exists, and already gates producer payouts via a review
   threshold, not a silent multiplier) was discussed as a way to reward data quality, not just
   volume — analogous to Amul paying by milk fat-content, not just litres. The final settled
   mechanism (token count = your share, full stop) doesn't currently account for this. Worth
   deciding explicitly rather than letting it quietly disappear.

4. **What's the distribution cadence** for corpus returns — monthly, quarterly, annually?

5. **What happens to a member who leaves or goes inactive** — does their token count (and thus
   their ongoing dividend claim) persist forever, or expire?

6. **The eventual legal entity.** An institution that genuinely can't just have its corpus "taken
   away" needs to be a real, separate legal entity (a registered cooperative society or trust) that
   legally owns the corpus, distinct from whatever company builds and operates the software — the
   same way a mutual fund's assets are legally separate from its management company. Not a software
   question, but one that eventually has to be answered before real money is actually at stake.

7. **The 2%-of-purchase reward rate and the 1-token-per-question default are both implemented and
   live** (SPEC.md §41) — but whether that balance is actually fair to people who mostly answer
   questions rather than spend money is still unmeasured. Worth revisiting once there's real usage
   data on how token supply actually splits between the two earning paths.
