# DATAPAY — DEVELOPER SPECIFICATION
### For a Claude Code build session · v2.0 · Supersedes the earlier platform build brief

> **How to use this doc in Claude Code:** Read this whole file first. Build strictly phase by phase (§12) — each phase ends in working, tested software before the next begins. Do not scaffold all phases at once. When a phase's acceptance tests pass, commit, then proceed. If any instruction here conflicts with a "make it work fast" shortcut, follow this doc — the guarantees below are the product.

> **ADDENDUM (2026-07-23), checked against the Melukote pitch deck.** Three points confirmed with the founder:
> 1. The profile↔registry link stays **one-way HMAC + an audited write-once lookup table in Vault** — no reversible-encryption key exists anywhere. §2 LAW 1 is unchanged; this is a confirmation, not a design change.
> 2. **Only k-anonymized aggregates (cohort ≥ 50) ever leave Core** — individual demand-registry rows, even pseudonymous ones, are never published to suppliers or anyone else. §2 LAW 3 is unchanged; this is a confirmation, not a design change.
> 3. The Question Engine becomes **admin-pluggable by topic**, with generated questions reviewed before they ever reach a member. This *is* new design — see **§14**.
> 4. `token_ledger` must be built and operated with **payments-infrastructure rigor** — atomic earn transactions, database-enforced immutability, idempotency keyed to the same token as the source row, and lock-based double-spend protection on redemption. This hardens §5B/§6/§12 Phase 2; it does not change what Phase 2 delivers, only how solidly it must be built — see **§15**.

---

## 1. WHAT DATAPAY IS (context for every decision)

DataPay is a demand-aggregation platform for the Melukote constituency (pilot), scaling nationally. Households anonymously contribute what they use and intend to buy; the platform aggregates this into a verified **demand registry**, matches it to suppliers who offer the best value, and returns value to members as **tokens** (redeemed at purchase), to the community as a **fund**, and to local **producers** via direct market linkage.

**The product is the matching engine.** Everything else is input or output.

Three things make it defensible, and the code must protect all three:
1. **Anonymity by architecture** — identity and data physically separated; suppliers never see a person.
2. **Token value backed by real demand** — tokens are earned by contribution, priced by a periodic engine-set rate driven by demand + realised sales + supplier competition, and redeemable *only* when a member fulfils a demand they declared.
3. **Two-entity governance** — a non-profit Trust owns the data; a for-profit Services company runs the matching. The code's data boundaries mirror this legal boundary.

---

## 2. THE THREE ARCHITECTURAL LAWS (never violate)

**LAW 1 — Identity and data never share a store.**
Two physically separate databases with separate credentials:
- **Vault DB** — real PII (name, phone, UPI, delivery address) + the `person ↔ alias` map. Tiny, locked, minimal API.
- **Core DB** — everything else (answers, intents, tokens, offers, produce, fund, votes). Knows members ONLY by opaque `alias_id`. If Core leaks entirely, no human identity is exposed.

**LAW 2 — Tokens convert to value only at a verified, self-declared purchase.**
Tokens accumulate freely from contributions. They are never cash, never transferable, never withdrawable. They become spendable only against an offer fulfilling a demand the member themselves declared. This is what makes the ledger trustworthy to suppliers and keeps DataPay outside prepaid-instrument/wallet licensing.

**LAW 3 — No aggregate leaves the system describing fewer than 50 members (k-anonymity floor = 50).**
Enforced at BOTH the database (CHECK constraint) and API layers. Zone granularity auto-coarsens (village→panchayat→hobli→constituency) until the cohort clears 50.

Additionally, **never collect** health, religion, caste, precise GPS, or political affiliation. Enforce in category seed data and a PR checklist. This is legal survival, not just ethics.

---

## 3. TECH STACK (use these unless a hard blocker appears)

| Layer | Choice | Notes |
|---|---|---|
| Mobile | React Native + Expo (TypeScript) | One codebase → Android + iOS. Android-first: target Android 8+, Hermes engine, keep APK < 30 MB. OTA updates via EAS. |
| Local store | expo-sqlite + an outbox queue | Offline-first is mandatory (rural connectivity). All contributions queue locally and sync when online, idempotent by `client_msg_id`. |
| Backend | Node.js + NestJS (TypeScript) | Module-per-domain maps to this spec. Generate OpenAPI from decorators. |
| Databases | PostgreSQL ×2 — `vault_db`, `core_db` | Separate instances, separate credentials, row-level security on both. |
| Cache/jobs | Redis + BullMQ | Aggregation, token-rate fixing, matching, payout batches, notifications. |
| Auth | Phone OTP → JWT | OTP + phone live in Vault only. Core-facing JWT carries `alias_id`, never phone. |
| Producer payments | UPI (RazorpayX / Cashfree) | Real rupees only for producer payouts + fund disbursement. Vault resolves alias→UPI at execution. NO consumer cash-out (tokens are closed-loop). |
| i18n | i18next; Kannada + English | Kannada is the pilot default. |
| Voice/TTS | Bhashini APIs (primary); AI4Bharat IndicConformer/Whisper (self-host fallback) | ASR + language ID + TTS read-aloud. |
| Vision | On-device pre-processing (EXIF strip + face check) → server-side product recognition | Open-source model or a vision API for product ID. |
| Admin/Supplier portal | Next.js (separate web app) | Suppliers and ops NEVER touch the member app or Core PII paths. |
| Infra | Docker Compose (dev); Indian-region cloud (data residency); KMS for peppers/keys; TLS everywhere | DPDP Act alignment. |
| Monorepo | pnpm workspaces | `apps/mobile`, `apps/api`, `apps/vault`, `apps/portal`, `packages/shared` |

---

## 4. REPO LAYOUT

```
datapay/
  apps/
    mobile/        # React Native + Expo member app
    api/           # NestJS — Core DB services (data plane)
    vault/         # NestJS — Vault DB service (identity plane), separate deploy
    portal/        # Next.js — supplier + ops back office
  packages/
    shared/        # TS types, DTOs, token math, k-anon helpers, zod schemas
  infra/
    docker-compose.yml
    migrations/    # core/ and vault/ SQL migrations kept separate
  SPEC.md          # this document
```

Vault is a **separate deployable service** with its own DB credentials — not just a module in `api`. The physical separation is the security guarantee.

---

## 5. DATA MODEL

### 5A. vault_db (identity plane — keep it tiny)

```sql
users(id PK, phone_e164 UNIQUE, name, created_at, kyc_state)
alias_map(user_id FK UNIQUE, alias_id UNIQUE)                 -- the bridge; write-once
payout_instruments(user_id FK, upi_id_encrypted, verified_at) -- producers only
delivery_addresses(id, user_id FK, address_encrypted, zone_hint)
relay_map(relay_token UNIQUE, delivery_address_id FK, offer_ref, expires_at)
vault_access_log(id, service, purpose, alias_or_token, at)    -- every resolution logged
```

Vault exposes EXACTLY these internal endpoints (no general "get user"):
`POST /register` · `POST /verify-otp` · `POST /resolve-payout` (batch, producers) · `POST /resolve-relay` (token→address, at dispatch)

**Alias generation:** `alias_id = HMAC-SHA256(user_id, ALIAS_PEPPER)` → 64-hex opaque string. `ALIAS_PEPPER` lives only in Vault's KMS. Core can never reverse it. Also generate a friendly **display alias** once: `<local river> <bird> <number>` (e.g. "KAVERI HERON 47"), unique.

### 5B. core_db (data plane — members exist only as alias_id)

```sql
-- GEOGRAPHY
zones(id, parent_id, level ENUM('constituency','hobli','panchayat','village'), name, name_kn)

-- MEMBERS (pseudonymous; no PII, no device id linkable to phone)
members(alias_id PK, display_alias UNIQUE, zone_id FK, household_size_band,
        locale, joined_at, status, trust_score NUMERIC DEFAULT 1.0)

-- CONSENT (DPDP; per-category, revocable, immutable trail)
consents(id, alias_id FK, category_id FK, granted BOOL, updated_at)
consent_events(id, alias_id, category_id, action, at)

-- QUESTION ENGINE
categories(id, slug, name, name_kn, sensitivity ENUM('standard','none'))
   -- seed EXCLUDES health/religion/caste/political. Enforce in seed + PR review.
questions(id, category_id FK, type ENUM('single','multi','yesno','intent_window','numeric'),
          text_en, text_kn, reward_tokens INT, active_from, active_to, max_audience, frequency_rule,
          source ENUM('admin_authored','plugin_generated') DEFAULT 'admin_authored',
          generator_topic_id FK NULL, generation_run_id FK NULL,
          review_state ENUM('draft','approved','rejected') DEFAULT 'approved')
          -- admin-authored rows default straight to 'approved' (an admin typing IS the review).
          -- plugin-generated rows default to 'draft' — see §14.
question_options(id, question_id FK, product_code NULL, label_en, label_kn, sort)
question_topics(id, slug, name, generator_kind ENUM('template','llm_assisted'), config JSONB,
       schedule_cron, active, created_at)
   -- an admin-registered pluggable topic; config scopes it to a category_id, product list, locales. See §14.
question_generation_runs(id, topic_id FK, triggered_at, status ENUM('running','completed','failed'),
       questions_generated INT, completed_at)
   -- one row per generation batch; questions.generation_run_id points back here. See §14.
responses(id, alias_id FK, question_id FK, option_ids INT[], numeric_value,
          input_mode ENUM('tap','voice','snap') DEFAULT 'tap', language,
          answered_at, client_msg_id UNIQUE)              -- client_msg_id = offline idempotency
intents(id, alias_id FK, product_category_id FK, window ENUM('1m','3m','6m','12m'),
        strength ENUM('yes','maybe'), declared_at, expires_at, fulfilled_offer_id NULL)

-- SNAPS (photo evidence; ground truth, weighted higher in what suppliers buy)
snaps(id, alias_id FK, storage_key, product_code NULL, category_id NULL,
      state ENUM('uploaded','recognized','member_confirmed','ops_verified','rejected'),
      reward_tokens INT, client_msg_id UNIQUE, captured_at, verified_at NULL)
   -- images EXIF-stripped + face-checked ON DEVICE before upload.
   -- originals purged 90 days post-verification; only product_code + timestamp persist.

-- PRODUCT REGISTRY (scrambled; competing suppliers can't see each other's SKU pull-through)
products(product_code PK, category_id FK, display_name, display_name_kn, brand_code, unit_spec, mrp_paise NULL)
brands(brand_code PK, display_name)   -- brand *real* identities live in portal DB, not here

-- TOKENS (LAW 2)
token_ledger(id, alias_id FK, entry ENUM('earn_response','earn_snap','earn_voice','earn_intent',
       'earn_bonus','redeem_offer','expire','adjustment'), tokens INT, ref_type, ref_id, created_at)
       -- append-only, must always balance
earn_rules(id, action, input_mode, base_tokens, multiplier_rules JSONB, active)
token_rate(id, effective_from, effective_to, rate_paise NUMERIC, inputs JSONB, computed_at)
       -- THE PERIODIC RATE. inputs JSONB records the demand/sales/competition factors used.
token_expiry: tokens expire 12 months after earn (FIFO), with in-app warnings.

-- COLLECTIVE OFFERS
offers(id, product_code FK, zone_id FK, collective_price_paise, market_price_paise,
       min_participants, max_participants, opens_at, closes_at,
       status ENUM('draft','open','locked','fulfilled','cancelled'), brand_code)
offer_token_terms(offer_id PK FK, max_tokens_redeemable INT, token_value_paise INT, set_by, computed_at)
offer_participation(id, offer_id FK, alias_id FK, qty, tokens_redeemed INT, joined_at,
       state ENUM('joined','confirmed','delivered','cancelled'), relay_token UNIQUE)

-- SUPPLY SIDE — PRODUCER MARKETPLACE (transform arbitrage into transparent linkage)
producer_profiles(alias_id PK FK, kind ENUM('farmer','shg','artisan','micro_unit'), shg_id NULL, capacity_note, active)
shg_groups(id, name, zone_id FK, member_count)          -- SHG identity is collective
produce_categories(id, slug, name, name_kn, unit ENUM('kg','quintal','litre','piece','acre_yield'))
produce_listings(id, alias_id FK, produce_category_id FK, qty, unit, quality_note, ready_at,
       snap_ids INT[], input_mode ENUM('tap','voice','snap'),
       state ENUM('draft','listed','matched','deal_agreed','fulfilled','withdrawn'),
       asking_price_paise NULL, created_at)
buyer_directory(id, kind ENUM('internal_collective','local_processor','institutional','external_trader','retail_chain'),
       zone_id NULL, produce_category_ids INT[], verified BOOL, contact_ref)
linkages(id, listing_id FK, buyer_id FK, proposed_price_paise, distance_km,
       state ENUM('suggested','producer_interested','negotiating','agreed','completed','declined'),
       identity_disclosed_at NULL)
valueadd_suggestions(id, produce_category_id FK, suggestion_en, suggestion_kn, uplift_note,
       source ENUM('library','llm_generated','ops_curated'), approved BOOL)

-- MONEY (real rupees flow only to producers + the fund)
producer_payouts(id, alias_id FK, linkage_id FK, amount_paise, status, initiated_at)
fund_ledger(id, zone_id FK, entry ENUM('accrual','project_disbursement'), amount_paise, ref_type, ref_id, created_at)

-- COMMUNITY FUND GOVERNANCE
fund_projects(id, zone_id FK, title, title_kn, estimate_paise,
       status ENUM('proposed','voting','approved','funded','done'))
fund_votes(id, project_id FK, alias_id FK, vote ENUM('yes','no'), at, UNIQUE(project_id, alias_id))

-- SELLABLE OUTPUT (what suppliers buy — aggregates ONLY, never rows)
demand_aggregates(id, category_or_product, zone_id, window, metric JSONB,
       cohort_size INT CHECK (cohort_size >= 50), computed_at)   -- LAW 3 in the schema

-- PACS / FULFILMENT NODES
pacs_nodes(id, zone_id FK, kind ENUM('pacs','rwa','society'), name, godown_capacity_note, operator_contact_ref, active)

-- INTEGRITY
audit_log(id, actor_type, actor_id, action, object, at)     -- append-only
quality_flags(id, alias_id, rule, detail, at)               -- fraud/consistency engine output
```

---

## 6. THE MATCHING ENGINE (the core product — §4 of business logic)

Runs as scheduled + on-demand BullMQ jobs. Three responsibilities:

**6A. Aggregation.** Compute `demand_aggregates` from responses, intents, and verified snaps. Metrics: current-usage share by product/zone; declared-intent counts by category/window/zone; switching-willingness. Snaps carry higher weight (harder to fake). **LAW 3 enforced** in job + constraint + API.

**6B. Matching.** Pair demand cohorts with suppliers who bid best value. For the produce side, enforce **matching priority**: (1) internal_collective (local supply meets the local demand ledger — always surface first), (2) local_processor within radius, (3) institutional/external. Emit `offers` (buy side) and `linkages` (sell side).

**6C. Token-rate fixing (LAW 2 pricing).** On a fixed cadence (default every 3 days) compute and publish a new `token_rate`:

```
rate ∝  demand_pressure  ×  realised_sales_velocity  ×  supplier_competition
```
- **demand_pressure** — volume & intensity of live declared intent in the registry (more unmet demand → higher).
- **realised_sales_velocity** — fraction of recent declared demand that converted to verified purchases (proves the ledger performs).
- **supplier_competition** — aggregate supplier bid strength / willingness to pay to reach the demand.

Store the factor values in `token_rate.inputs` for transparency/audit. The rate should rise as trust and activity grow — that behaviour is the whole story; make it observable in the ops portal with a chart. Implement as a pure, unit-tested function `computeTokenRate(inputs) → rate_paise` so the formula can be tuned and back-tested without touching plumbing.

**Redemption gate (LAW 2):** a member may redeem tokens against an offer ONLY if they have a matching `intents` row (self-declared) that this offer fulfils, AND the purchase is verified. On redemption: write `token_ledger` (redeem_offer), set `offer_participation.tokens_redeemed`, mark the intent fulfilled.

**Fraud/quality engine:** consistency scoring (contradictions lower `trust_score`), velocity caps, hashed device-fingerprint dedup (stored core-side, NOT linked to phone), and a verification bonus (receipt/photo after a delivered offer → higher token award) to calibrate declared intent. Payout/eligibility weight by `trust_score`; flagged aliases go to review, never silent confiscation.

---

## 7. IDENTITY-BLIND FULFILMENT (relay + PACS)

When a member joins an offer, Core issues a random `relay_token`. Suppliers ship **one bulk consignment per PACS/RWA node**, not to homes. At dispatch, the node operator app calls Vault `resolve-relay` to map token→pickup; the member collects and confirms in-app. Brand receives only: qty by zone, tokens, escrow payment. Tokens expire post-delivery; `relay_map` rows purge 30 days after completion. Same nodes aggregate outbound produce for buyer pickup. Node operators (PACS rural, RWAs urban) earn a handling fee + commission share.

---

## 8. MOBILE APP — SCREENS

Tabs: **Home · Pulse · Produce · Offers · Community** (member transparency ledger under Home → "Your Vault").

1. **Onboarding** — phone OTP → zone pick (constituency→…→village, Kannada) → alias reveal ceremony (frosted card, three no-share guarantees) → per-category consent toggles.
2. **Home** — token balance (◈, mono, brass, sparkline), village fund balance, pending Pulse count, "earned this month" by source.
3. **Daily Pulse** — card stack, 3–5 Q/day, ~20s target, per-Q token reward shown, offline outbox. **Three input modes, all first-class:** tap chips; **voice** (mic → Bhashini ASR → parsed chips → member confirms → audio deleted post-transcription); intent questions clearly marked.
4. **Snap** — camera; one tap; +tokens per verified snap; on-device EXIF-strip + face-reject before upload; recognition → member confirms brand/size; offline queue (<300 KB/photo).
5. **Produce** — "What do you make?" one action, same tap/voice/snap trio → listing → matched buyers (priority-ranked, price vs prevailing mandi rate shown) + value-add suggestions + deal flow with **progressive identity disclosure** (pseudonymous through negotiation; reveal only on "Reveal & proceed" at agreed deal; SHG may reveal group, not individuals).
6. **Vault (transparency)** — per-category ledger: what was shared, buyer count, tokens earned; instant per-category off-switch (writes `consent_events`); "identity never shared — audit log →".
7. **Offers** — collective buys, progress bar, collective vs market price, **token redemption line** ("Redeem 350 ◈ → pay ₹1,090"), join→qty→confirm; relay/PACS pickup explanation.
8. **Community** — fund balance, active votes (1 member 1 vote), funded-project history.

Non-functional: Android 8+, low-RAM safe, every screen < 2s on 3G, full Kannada, TalkBack/screen-reader accessible, `prefers-reduced-motion` respected, TTS read-aloud for non-readers (mic in / speaker out end to end).

---

## 9. API SURFACE (member app ↔ api, JSON, JWT carrying alias_id)

```
POST /v1/auth/otp/request | /v1/auth/otp/verify         (proxied to Vault; returns data-plane JWT)
GET  /v1/me
GET  /v1/pulse/today        POST /v1/pulse/answers        (batch, idempotent by client_msg_id)
POST /v1/snaps              GET  /v1/snaps
POST /v1/voice/transcribe   (audio → transcript+parse; audio discarded)
GET  /v1/tokens             GET /v1/token-rate            (current + history)
GET  /v1/vault/ledger       PUT /v1/vault/consents/:category
GET  /v1/offers?zone=       POST /v1/offers/:id/join      DELETE /v1/offers/:id/join
POST /v1/produce/listings   GET /v1/produce/listings/:id/linkages   POST /v1/linkages/:id/advance
GET  /v1/fund               GET /v1/fund/projects         POST /v1/fund/projects/:id/vote
GET  /v1/audit/summary
```
Versioned, rate-limited, OpenAPI auto-generated.

---

## 10. TWO-ENTITY BOUNDARY IN CODE (mirrors the legal structure)

The Trust owns member data (Vault + Core PII-adjacent aggregates + the charter). Services runs the matching engine and sells **only aggregated intelligence** (`demand_aggregates`, qualified leads), never rows. Concretely: the supplier/ops portal and the intelligence-export endpoints read ONLY from `demand_aggregates` and offer/linkage tables — they must have NO code path to `responses`, `snaps`, `members`, or Vault. Enforce with a separate DB role for the portal that lacks SELECT on member-level tables. Document this boundary in code comments so it survives refactors.

---

## 11. COMPLIANCE CHECKLIST (bake in, don't bolt on)

- DPDP: explicit per-category consent, revocation, purpose limitation, Indian residency, member data-access + deletion (deletion = Vault purge + alias orphaning; aggregates already irreversibly detached).
- No health/religion/caste/precise-GPS/political data — ever.
- Plain-language privacy charter shipped in-app (English + Kannada).
- Tokens are closed-loop, non-cashable → stay clear of PPI/wallet licensing. Add a code comment at the token module head stating this so no one "helpfully" adds cash-out.
- Every marketing claim ("identity never shared", "off switch", "audio deleted", "audited") must map to a tested code path. If code can't honour a claim, flag it — don't ship the claim.

---

## 12. BUILD PLAN — phase by phase, each ends in tested working software

**Phase 0 — Scaffold.** Monorepo (pnpm), Docker Compose with two Postgres instances (`vault_db`, `core_db`) on separate credentials, migration runner for each, shared package with zod DTOs + token-math stubs. *Acceptance:* both DBs migrate up/down cleanly; `packages/shared` imported by api + vault.

**Phase 1 — The Law (identity/data separation).** Vault service (register, OTP, alias generation via HMAC+pepper in KMS). Core `members`, `zones`. Mobile onboarding through alias-reveal ceremony + consent toggles. *Acceptance:* automated test proves phone number is provably absent from `core_db` (grep schema + sample rows); alias is non-reversible without the pepper; Vault has no "get user" endpoint.

**Phase 2 — Pulse, Snap, Voice + Tokens.** Question engine; offline outbox with `client_msg_id` idempotency; responses; snaps (on-device EXIF/face pre-process → recognition → confirm); voice (Bhashini ASR → parse → confirm → discard audio); `token_ledger` earning. Home/Pulse/Snap/Vault screens. *Acceptance:* offline answers sync exactly once; token ledger balances; an image with a face is rejected client-side; audio is provably not persisted server-side.

**Phase 3 — Aggregation + Token-rate + Portal.** Aggregation jobs with k-anon floor; `computeTokenRate` pure function + 3-day fixing job; supplier/ops portal (Next.js) reading ONLY aggregates. *Acceptance:* no aggregate with cohort < 50 can be produced or exported (constraint + API test); token rate recomputes from inputs and is charted; portal DB role cannot SELECT member-level tables.

**Phase 4 — Offers + Redemption + Relay/PACS.** Offer lifecycle; `offer_token_terms`; join/redeem with the **redemption gate** (must have matching declared intent + verified purchase); relay tokens; PACS node model + operator app role; escrow stub. *Acceptance:* a member with tokens but no matching declared intent CANNOT redeem; relay never exposes identity to the supplier path; token redemption writes a balanced ledger entry and marks the intent fulfilled.

**Phase 5 — Fund + Governance.** Fund ledger accrual; projects; 1-member-1-vote; Community screen. *Acceptance:* fund accrues from completed offers; double-vote rejected by unique constraint.

**Phase 6 — Produce & Linkages.** Producer profiles; listings via tap/voice/snap; buyer directory; matching job with internal-first priority; value-add suggestion library (seed ~20 for Mandya produce: sugarcane, paddy, ragi, milk, coconut, SHG textiles); progressive-disclosure deal flow; producer UPI payouts. *Acceptance:* identity stays hidden until "Reveal & proceed"; internal-collective matches rank first; producer paid in rupees via sandbox UPI.

**Phase 7 — Hardening.** Fraud/quality engine v1; payout batches (UPI sandbox); audit exports; load test (10k members); full Kannada copy review; TalkBack pass; EAS builds for Play Store + TestFlight. *Acceptance:* ledger math property-tested (never unbalanced); k-anon + separation integration tests green; app runs on an Android 8 low-RAM device profile under 2s/screen on throttled 3G.

**Phase 8 — Area Intelligence Question Engine.** Not in the original 8-phase plan — added when the vision grew to include grounding the Question Feeder Engine in real local knowledge, not just admin-authored templates. Document ingestion (Google Drive, per zone); a per-zone "understanding" (narrative summary + structured knowledge map) built from ingested documents by an LLM; a `document_grounded` topic generator kind that drafts candidate questions from that understanding; an ops portal page to connect sources, sync them, review the understanding, and approve/reject the resulting drafts. *Acceptance:* every document_grounded draft still requires human approval before reaching a member (no new bypass of §14's review gate); a topic with no zone or a zone with no understanding fails clearly, never silently; malformed LLM output fails the generation run cleanly, with zero partial drafts persisted.

**Testing bar throughout:** unit tests on all ledger math (token + fund double-entry must balance); integration test proving Vault/Core separation; k-anonymity constraint tests; offline-sync idempotency tests; a test asserting the portal role cannot read member-level data.

---

## 13. FIRST CLAUDE CODE PROMPT (paste this to start)

> "Read SPEC.md in full. We are building DataPay. Start with **Phase 0** only: set up the pnpm monorepo (`apps/mobile`, `apps/api`, `apps/vault`, `apps/portal`, `packages/shared`), a Docker Compose with two separate Postgres instances (`vault_db` and `core_db`) using distinct credentials, a migration runner for each database kept in `infra/migrations/vault` and `infra/migrations/core`, and a `packages/shared` with zod DTOs and stub functions for token math and k-anonymity coarsening. Do not build any other phase yet. When Phase 0's acceptance tests pass (both DBs migrate cleanly up and down; shared package imports in api and vault), stop and show me the tree and the test output."

---

## 14. THE QUESTION FEEDER ENGINE — ADDENDUM (2026-07-23)

Confirms and extends §5B/§8: the Question Engine is not a static seed table admins hand-edit one row at
a time. It is a **pluggable, topic-driven generator** with a review gate before anything reaches a
member's Daily Pulse. This folds into **Phase 2** — it does not add a phase.

**14A. Topics are plugins, not just categories.** A `question_topics` row registers a generator:
`generator_kind` is either `template` (deterministic — fills a template string with a product/category
list and locale pair, no external calls) or `llm_assisted` (calls an LLM with the topic's `config` —
product scope, tone, locale — to draft novel question variants). Both kinds produce the same output
shape: draft rows in `questions` with `source = 'plugin_generated'` and `review_state = 'draft'`.

**14B. Generation runs are batched and logged.** A BullMQ job (scheduled per
`question_topics.schedule_cron`, or triggered on-demand from the ops portal) creates one
`question_generation_runs` row, invokes the topic's generator, and writes however many draft questions
it produces, each tagged with `generation_run_id`. If the generator fails partway, the run is marked
`failed` and none of its partial output is eligible for review — no half-generated batches leak into
the queue.

**14C. Nothing generated reaches a member without review.** `GET /v1/pulse/today`'s selection query
filters on `review_state = 'approved'` (same as it already filters on `active_from/active_to`,
`max_audience`, `frequency_rule`). Admin-authored questions default to `review_state = 'approved'`
immediately (an admin typing a question *is* the review); plugin-generated ones default to `'draft'`
and only flip to `'approved'` through an explicit ops-portal action — bulk-approve or per-question,
with rejected ones staying in `core_db` for audit but never selectable.

**14D. The category-sensitivity rule still applies to generated content.** §2's ban on
health/religion/caste/precise-GPS/political data doesn't relax because a machine wrote the question
instead of a human. `question_topics.config` is scoped to a `category_id` whose `categories.sensitivity`
is already constrained at seed time; a generator cannot target a category that doesn't exist, and the
existing PR-checklist / seed-data enforcement from §2 covers new categories the same way it covers new
questions.

**API additions (ops portal only — not the member-facing surface in §9):**
```
POST /v1/admin/question-topics                 (register a topic + its generator config)
POST /v1/admin/question-topics/:id/generate     (trigger a run on-demand)
GET  /v1/admin/question-generation-runs/:id     (status + generated question count)
GET  /v1/admin/questions?review_state=draft     (the review queue)
POST /v1/admin/questions/:id/approve | /reject
```

**Acceptance test (folds into Phase 2's existing acceptance bar):** a plugin-generated question with
`review_state = 'draft'` never appears in `GET /v1/pulse/today` for any member, under any audience
rule, until an explicit `/approve` call flips it — proven with an integration test that seeds a draft,
calls `/pulse/today`, asserts absence, approves, calls again, asserts presence.

---

## 15. THE TOKEN LEDGER IS PAYMENTS INFRASTRUCTURE — ADDENDUM (2026-07-23)

Confirms and hardens §5B/§6/§12 Phase 2: `token_ledger` is not an activity log with a token count
attached — it is the system's transactional core, and must be built with the same rigor as a bank
ledger or payment gateway, because every token will eventually carry real monetary value (§6C's
token-rate mechanism converts it to ₹ at redemption). This does not change what Phase 2 delivers —
it changes how solidly the ledger inside Phase 2 must be built. Four properties are non-negotiable:

**15A. Every earn is one atomic transaction, not two writes.** Answering a question, snapping a
photo, or completing a voice note writes BOTH the source row (`responses`/`snaps`/etc.) AND the
corresponding `token_ledger` entry inside a single database transaction. If the ledger write fails,
the response write rolls back too — a member is never shown "answer recorded" while silently getting
zero tokens, and never gets tokens without a traceable source row backing them. `ref_type`/`ref_id`
on `token_ledger` isn't just for display, it's a foreign-key-shaped promise that every credited token
can be traced to exactly one concrete action.

**15B. The ledger is append-only, enforced at the database, not just by convention.** No code path
may `UPDATE` or `DELETE` a `token_ledger` row, ever — corrections are new `adjustment` entries, never
edits to history. Enforce this the same way a real ledger enforces it: the api's runtime DB role gets
`INSERT`/`SELECT` but not `UPDATE`/`DELETE` on `token_ledger`, backed by a trigger that rejects any
attempted mutation as defense in depth. This is the same posture as §10's portal-role restriction —
a second instance of "the database enforces the promise, not just the application code."

**15C. Idempotency is a first-class ledger property, not just an API nicety.** Offline members
retry. `client_msg_id` already deduplicates `responses`/`snaps` rows (§5B) — the token_ledger entry
earned from that action must key off the *same* idempotency token: a unique constraint on
`(ref_type, ref_id)`, where `ref_id` is the response/snap's own id, which is itself unique-by-
`client_msg_id`. Retrying a sync never double-credits, by construction, not by a client-side
"don't tap twice" convention.

**15D. Redemption is a lock-and-check against a live balance, not a check-then-write.** Two
concurrent redemption attempts against the same balance is the textbook double-spend bug. The
redemption gate (§6, LAW 2) must run inside a transaction that locks the member's balance
(`SELECT ... FOR UPDATE` on a materialized balance row) before checking
`tokens_redeemed <= balance`, and the constraint that balance never goes negative lives in the
database, not just an application-level `if`. A member's balance is `members.token_balance`
(materialized, updated transactionally alongside every ledger insert) reconciled nightly against
`SUM(token_ledger.tokens) WHERE alias_id = ...` — the materialized column is a cache for fast reads,
the ledger is the only source of truth, and a reconciliation job that finds drift is itself a
paging-worthy incident, not a silent auto-correct.

**Why this matters more than it looks like it does:** §11's compliance posture depends on tokens
staying closed-loop and non-cashable to stay outside PPI/wallet licensing — but the moment tokens
carry a real, engine-computed ₹ value (§6C) and redeem against real purchases, the ledger IS a
payments ledger in every way that matters operationally, even though it isn't a regulated instrument
legally. Building it with a bank's rigor now is cheaper than retrofitting it after Phase 2 ships with
a naive `UPDATE members SET tokens = tokens + 5` and the answer to "why doesn't the balance add up"
is "we don't know."

**Data model addition to §5B:** `members` gains `token_balance INT NOT NULL DEFAULT 0 CHECK
(token_balance >= 0)`. `token_ledger` gains a unique constraint on `(ref_type, ref_id)`.

**Acceptance test additions (folds into Phase 2's existing bar, §12):**
- A property test that no sequence of concurrent earn/redeem operations ever produces a negative
  balance or a `SUM(token_ledger)` that disagrees with `members.token_balance`.
- A test that two parallel redemption requests against a balance that can only satisfy one of them
  produce exactly one success and one clean rejection — never both succeeding, never both failing.
- A test that replaying a `client_msg_id` sync produces zero additional ledger entries.
- A test that `UPDATE`/`DELETE` against `token_ledger` is rejected at the database level regardless
  of which application role attempts it.

---

## 16. VAULT'S SURFACE GREW BY TWO ENDPOINTS — ADDENDUM (2026-07-23, Phase 4)

§5A said Vault exposes *exactly* four internal endpoints. Building the relay flow (§7) for real
surfaced a gap that framing didn't account for: nothing in the original four ever *writes* a
delivery address, and nothing registers a `relay_token → address` mapping ahead of a PACS node
asking to resolve one. Two endpoints were added to close it:

- **`POST /delivery-address`** — `{aliasId, address, zoneHint}`. Resolves `aliasId` to `user_id`
  via `alias_map`, encrypts the address (AES-256-GCM, reversible by design — unlike the alias's
  one-way HMAC, a delivery address must be decryptable at dispatch), and stores it. Returns `{ok:
  true}` — never PII back to the caller.
- **`POST /relay-map`** — `{aliasId, relayToken, offerRef, expiresAt}`. Called by Core at
  offer-join time, *before* any PACS node can ask to resolve anything. Looks up the member's most
  recent delivery address and writes the `relay_map` row Vault will later answer `resolve-relay`
  against. This is deliberately a register-then-resolve design, not "trust whatever alias Core
  asserts at resolve time" — Vault controls the mapping independently, so a compromised or buggy
  Core caller can't make Vault decrypt an arbitrary member's address by asserting the wrong alias
  at pickup time.

Both endpoints keep the original discipline intact: single-purpose, no general "get user," no PII
in the response body, every `resolve-relay` call logged to `vault_access_log`. §5A's "exactly four"
should be read as "exactly these, plus what §7's relay flow needs to function" — the guarantee that
matters (no general read access to identity) is unchanged; the literal endpoint count isn't the
guarantee.

**Acceptance test (folds into Phase 4's existing bar, §12):** a `resolve-relay` call for a token
with no matching `relay_map` row (never registered, or already past its 30-day purge window)
returns 404, never a partial or default address.

---

## 17. FUND ACCRUAL NEEDED A CONCRETE TRIGGER — ADDENDUM (2026-07-23, Phase 5)

Phase 5's acceptance line — "fund accrues from completed offers" — doesn't say what "completed"
means mechanically, or how much accrues. Two concrete decisions were made to make it real:

**17A. "Completed" = a member confirms delivery.** `POST /v1/offers/:id/join` already covers
joining; nothing yet advanced an `offer_participation` to `delivered`. A new endpoint, `POST
/v1/offers/:id/confirm-delivery`, does that — the same action §8's Offers screen already describes
("collect and confirm in-app" at the PACS node, FIG. 4). Confirming is idempotent: a repeat call
returns `already_confirmed` and never accrues twice, via the same `UNIQUE(ref_type, ref_id)`
discipline `token_ledger` already uses (§15C), applied here to `fund_ledger`.

**17B. The accrual amount is 20% of the realised per-unit savings.** `(market_price_paise -
collective_price_paise) × qty × 0.2`. The 20% figure comes from the pitch deck's 50/20/30 split
(tokens / community fund / operations) — a business and legal decision, not something the code
should quietly invent as fact. It lives as one named constant
(`FUND_ACCRUAL_RATE` in `apps/api/src/fund/fund.service.ts`), not copy-pasted across call sites, so
it can be revisited without a hunt.

**17C. `fund_ledger` gets the full §15 treatment, not a lighter one.** It's real rupees, not
closed-loop tokens — if anything that argues for *more* rigor than `token_ledger`, not less. Same
append-only trigger (`reject_fund_ledger_mutation`, rejecting UPDATE/DELETE regardless of role),
same `UNIQUE(ref_type, ref_id)` idempotency key.

**Acceptance test (folds into Phase 5's existing bar, §12):** confirming delivery on an
already-`delivered` participation is a clean no-op — `already_confirmed`, zero additional
`fund_ledger` rows, zone balance unchanged.

---

## 18. PRODUCE & LINKAGES — ADDENDUM (2026-07-23, Phase 6)

Phase 6's acceptance line — "internal-collective matches rank first, identity stays hidden until
'Reveal & proceed', producer paid in rupees via sandbox UPI" — needed the same treatment §14-§17
gave earlier phases: turn each clause into a mechanism a test can check, not a description to take
on faith.

**18A. Ranking is insertion order, not a priority column.** `LinkagesService.matchListing()`
(`apps/api/src/linkages/linkages.service.ts`) queries `buyer_directory` for the listing's category,
`ORDER BY array_position(BUYER_KIND_RANK, kind), id ASC`, and inserts one `linkages` row per buyer
in that order. `BUYER_KIND_RANK` is `['internal_collective', 'local_processor', 'institutional',
'external_trader', 'retail_chain']` — the same internal-first posture §6B already applies to the
buy side, applied here to the sell side. Because insertion order tracks the rank exactly, "does
internal-collective rank first" reduces to "is the lowest-`id` linkage for this listing
`internal_collective`" — no separate priority field to drift out of sync with the rule it's
supposed to encode.

**18B. Identity disclosure is a one-way gate on a single column.** `linkages.identity_disclosed_at`
stays `NULL` through `suggested → producer_interested → negotiating`. `LinkagesService.advance()`
sets it to `now()` if and only if the transition lands on `'agreed'` — never on any other
transition, and never cleared afterward. A hand-authored state-transition map
(`VALID_TRANSITIONS`) rejects anything not on the allowed path (e.g. `suggested → agreed` directly,
skipping negotiation), so the disclosure gate can't be bypassed by an unexpected state jump.

**18C. Payouts reuse Phase 4's reversible-encryption pattern, generalized.** Phase 4 built
AES-256-GCM encrypt/decrypt for delivery addresses only, named accordingly
(`address-crypto.util.ts`). Producer UPI IDs need the identical treatment — reversible, unlike the
alias's one-way HMAC, because a payout has to decrypt back to a real UPI handle at payment time.
Rather than duplicate the logic under a second name, the utility was generalized in place:
`address-crypto.util.ts` → `secret-crypto.util.ts`, `encryptAddress`/`decryptAddress` →
`encryptSecret`/`decryptSecret`, `ADDRESS_ENCRYPTION_KEY` → `VAULT_SECRET_KEY`. Vault's `POST
/payout-instrument` (set) and `POST /resolve-payout` (batch resolve, alias → UPI ID) are the fourth
and fifth endpoints added to Vault's surface (after §16's `/delivery-address` and `/relay-map`) —
same posture: single-purpose, no general read access, every `resolve-payout` call logged to
`vault_access_log`.

**18D. The payout gateway is honestly fake.** `DevSandboxUpiProvider`
(`apps/api/src/producer-payouts/upi-provider.ts`) always "succeeds" and returns a fabricated
`sandbox-<uuid>` reference — there is no bank/NPCI/UPI integration behind it. This follows §11's
rule directly: the code must not claim a payment happened when it didn't. It's the same posture as
Phase 2's `DevNoopStorageProvider` and `DevNoopAsrProvider` — swapped for a real gateway when one is
contracted, never silently presented as real in the meantime.

**18E. Payout idempotency comes from a DB constraint, not app logic.**
`ProducerPayoutsService.runPayouts()` claims a linkage with `INSERT INTO producer_payouts (...)
... ON CONFLICT (linkage_id) DO NOTHING RETURNING id`; the `UNIQUE(linkage_id)` constraint
(migration `1738022401000_buyers_linkages_payouts.js`) is what actually prevents a double pay, not
a check-then-insert in application code. Re-running the payout job is always safe: a second pass
inserts zero rows for anything already claimed, so a retried or duplicated job run can never charge
the same deal twice — the same idempotency discipline §15 established for `token_ledger`, reused
here for a real-rupee payout record.

**Acceptance test (folds into Phase 6's existing bar, §12):** for a produce listing matched
against both the internal collective and an external buyer, the lowest-`id` linkage is always
`internal_collective`; `identity_disclosed_at` is `NULL` through every state up to and including
`negotiating` and non-`NULL` from `agreed` onward; and running the producer-payouts job twice
against the same agreed linkage produces exactly one `producer_payouts` row, `status = 'paid'`,
`upi_ref` matching `sandbox-*`.

---

## 19. HARDENING — ADDENDUM (2026-07-23, Phase 7)

§12's Phase 7 line lists six things: a fraud/quality engine, payout batches, audit exports, a
10k-member load test, a full Kannada copy review, and a TalkBack pass + EAS store builds. The first
three are real code, built and tested below. The last three are **not done** — not quietly skipped,
not claimed and hoped for, but explicitly out of reach of this build environment, for reasons given
in §19G. §11's own rule is the reason to say so plainly: "if code can't honour a claim, flag it —
don't ship the claim."

**19A. The fraud/quality engine v1 is the three mechanisms §6 already named, made concrete.**
`quality_flags` and `device_fingerprints` (named in §5's target schema, never migrated until now)
land in migration `1738108800000_fraud_quality_engine.js`; `FraudService`
(`apps/api/src/fraud/fraud.service.ts`) implements all three:

- **Velocity cap.** `PulseService.submitAnswers()` calls `enforceVelocityCap()` before inserting
  each response — 60 responses/24h (server-side `created_at`, not the client-supplied,
  legitimately-backdated `answered_at`) throws, the transaction rolls back, and the remaining
  answers in that batch are rejected too (one over-cap alias means every later answer in the same
  batch would fail identically). The flag itself is written on a *separate* connection from the
  one that's about to roll back — otherwise the one record of why the request was rejected would
  disappear along with it.
- **Consistency scoring.** A member declaring an intent with a different `strength` for the same
  category within 24h of a prior declaration (SPEC.md §6's "contradictions lower trust_score") gets
  flagged and `trust_score` decremented by 0.05, floored at 0 — the intent itself is still recorded,
  never dropped. `intents.strength` only has `yes`/`maybe` (§5's schema), so the real signal is
  flip-flopping between them, not a `yes`-then-`no` reversal that doesn't exist in this schema.
- **Device-fingerprint dedup.** The mobile client may send a raw `deviceFingerprint` string on
  `POST /v1/pulse/answers`; Core hashes it (SHA-256) before storage — the raw value never persists,
  and the table has no path to a phone number (LAW 1 holds here too). If the same hash is already
  registered under a *different* alias, both aliases get flagged. Nothing is blocked — flagged
  aliases go to review, per §6's own rule, never silent confiscation.
- **Verification bonus.** Phase 2 defined `snaps.state`'s full chain
  (`uploaded → recognized → member_confirmed → ops_verified → rejected`) but never wired an endpoint
  to advance it past `uploaded` — a real gap, not a deliberate stub. `POST
  /v1/admin/snaps/:id/verify` closes it: it's the first real transition into `ops_verified`, and it
  bumps the submitting member's `trust_score` by 0.05 (ceiling 1.0). Re-verifying an already-verified
  or rejected snap is rejected, not a silent no-op-turned-double-credit.

**19B. Payout batches: a run IS a batch, not a separate table.** Every `producer_payouts` row a
single `runPayouts()` call inserts shares one `batch_id` (a `uuid`, generated once per run) —
migration `1738108800000_fraud_quality_engine.js` adds the column. No `payout_batches` table exists
because nothing needs one yet: the batch's own rows, queried by `batch_id`, already answer "what
went out in this run."

**19C. Trust-weighted eligibility, without a new confiscation path.** `ProducerPayoutsService`
checks the producer's `trust_score` (via `producer_profiles → members`) before attempting a payout.
Below 0.5, the row is claimed with `status = 'review'` — same `ON CONFLICT (linkage_id) DO NOTHING`
idempotency guard as every other outcome — and no UPI attempt is made, no `upi_ref` fabricated. This
is §6's own line, applied for real: "payout/eligibility weight by trust_score; flagged aliases go to
review, never silent confiscation." `'review'` is a new value on `producer_payouts.status`'s CHECK
constraint, not a repurposed `'failed'` (which would misreport an attempted-and-failed payment that
never happened).

**19D. Audit export is one CSV across three tables, not three exports.** `token_ledger`,
`fund_ledger`, and `producer_payouts` have different native shapes (alias vs zone, tokens vs paise) —
`AuditService.exportCsv()` (`apps/api/src/audit/audit.service.ts`) unions them into one common row
(`source, subject_id, entry, amount, ref_type, ref_id, at`) so an auditor gets a single file, ordered
by time, instead of three to reconcile by hand. `GET /v1/admin/audit-export?since=<ISO8601>` streams
it as `text/csv`. Every source table is alias/zone-keyed only — an export can never carry a phone
number, because `core_db` never has one to carry (LAW 1, unchanged by this phase).

Alongside it, a new append-only `audit_log` table (also named in §5, never migrated until now)
records *that* an admin/system action ran — `run_produce_matching`, `run_producer_payouts`,
`verify_snap` — with the same append-only trigger discipline §15/§17 give the money ledgers. What
ran is now exactly as tamper-evident as what it moved.

**19E. Admin-endpoint auth is still deliberately deferred — now five endpoints deep.** Aggregation
and token-rate's admin triggers were already unauthenticated by explicit, commented decision (Phase
3). Produce-matching and producer-payouts (Phase 6) followed the same posture. Snap-verify and
audit-export (this phase) make five. This is a widening, acknowledged gap, not five independent
oversights — ops-write/read auth across all five is now the single largest piece of unfinished
hardening work, tracked as Phase 8's first item rather than patched ad hoc per endpoint.

**19F. Ledger math is property-tested, not just example-tested.** `apps/api/src/ledger/ledger.
property.spec.ts` uses `fast-check` to run 25 random sequences of credits/debits (including
deliberate over-drafts) through `LedgerService.creditTokens()` against a real Postgres connection,
asserting after every sequence that `members.token_balance` still equals `SUM(token_ledger.tokens)`
and is never negative — the property §12 literally asks for ("ledger math property-tested, never
unbalanced"), not a fixed set of hand-picked example cases.

**19G. What Phase 7 does NOT claim to have done, and why.** Three items from §12's Phase 7 line are
real infrastructure/human-review work this coding environment cannot honestly perform, so none of
them were touched:

- **A 10k-member load test.** Running one, and trusting its numbers, needs a provisioned
  environment sized like the target (or a documented model of how a laptop's Docker Postgres
  predicts production) — not present here. Writing a load-test *script* nobody has run and calling
  the phase's acceptance line met would be exactly the claim-without-a-code-path §11 forbids.
- **A full Kannada copy review.** Every user-facing string in the mobile app needs a fluent Kannada
  speaker's judgment — a linguistic review, not a code change. Nothing here can substitute for that
  judgment without pretending to have it.
- **TalkBack pass + EAS builds for Play Store/TestFlight.** TalkBack accessibility testing needs a
  real Android device or emulator exercising the actual screen reader; EAS builds need a live Expo
  account and store-signing credentials. Neither exists in this session.

These three remain open Phase 7 acceptance items, explicitly, in the status grid below — not folded
into "done" and not silently dropped from the list.

**Acceptance test (folds into Phase 7's existing bar, §12):** a velocity-capped alias's remaining
batch answers are rejected with zero additional `responses` rows; a contradicting intent
declaration is recorded (not dropped) and lowers `trust_score`; two aliases sharing one device
fingerprint hash both appear in `quality_flags`; a sub-threshold-trust producer's payout lands as
`status = 'review'` with no `upi_ref`; the ledger property suite passes across randomized
credit/debit sequences including deliberate over-drafts.

---

## 20. AREA INTELLIGENCE QUESTION ENGINE — ADDENDUM (2026-07-23, Phase 8)

The vision grew beyond §14's original Question Feeder Engine: instead of only admin-authored
templates, ground daily questions in real, area-specific knowledge — read documents about a place,
build an understanding of it, and let that understanding suggest what to ask. This phase wasn't in
the original 8-phase plan (§12); it's a direct extension of §14, built the same way every other
phase was — real code, real failure modes, nothing faked.

**20A. Two credentialed external dependencies, chosen explicitly, not defaulted into.** Before
writing any code, the two decisions only a human could make were asked and answered: **Anthropic**
for the LLM (matching the ecosystem this whole project is built in), and a **Google service
account** for Drive access (share the target folder with the service account's email — no OAuth
consent flow, no broader access than the specific folders explicitly shared). Both are real
implementations (`AnthropicLlmProvider`, `GoogleDriveProvider` in `apps/api/src/intelligence/`),
not stubs — but neither is present in this dev environment (§20G), so both fail with a clear,
named error the moment they're actually invoked without credentials, never a fake response.

**20B. A zone's "understanding" is a new row every time, not an overwrite.** `zone_understanding`
(migration `1738195300000_intelligence_engine.js`) holds a narrative summary (English + Kannada)
and a structured `knowledge_map` (economic activities, common products/brands, seasonal patterns,
notable concerns, demand signals) — built by feeding every ingested document for a zone to the LLM
in one prompt and validating its JSON response against a zod schema (`ZoneUnderstandingService`,
`apps/api/src/intelligence/zone-understanding.service.ts`). Refreshing never deletes the previous
understanding — how the read on an area changed over time stays visible, the same "append, don't
overwrite" instinct §15/§17 already apply to the money ledgers.

**20C. Ingestion tracks change, and never silently drops what it can't read.**
`IntelligenceSourcesService.sync()` (`apps/api/src/intelligence/intelligence-sources.service.ts`)
hashes each document's extracted text; a file whose hash matches what's already stored is skipped
(no wasted reprocessing), and a file this pass can't extract text from — PDFs, Google Sheets/Slides,
images — is skipped too, but *named* in the sync result rather than disappearing without a trace
(no silent caps, per §11). Google Docs export as plain text; `text/*` and JSON files are read
directly; everything else is explicitly unsupported for now.

**20D. Document-grounded drafts get exactly the same review gate as every other draft.**
`question_topics.generator_kind` gained a third value, `document_grounded` (alongside `template` and
the still-unimplemented `llm_assisted`), and a new nullable `zone_id` column (required only for this
kind, checked in application code — a `template` topic doesn't need one).
`DocumentGroundedGeneratorService.generateVariants()` builds a prompt from the topic's zone's latest
understanding plus its category, explicitly instructs the model to never ask about health,
religion, caste, precise location, or political opinion regardless of what the source documents
contain, and validates the response against the exact same `QuestionVariantSchema` a hand-authored
`template` variant is checked against. The result is handed to `QuestionFeederService`'s existing
`persistVariants()` — the same one-transaction, all-or-nothing insert path template topics already
use — landing in `review_state = 'draft'` like everything else. Nothing about this generator kind
bypasses the human review step §14 established; it only changes where the draft's *content* comes
from.

**20E. The portal's first write actions, deliberately routed around its restricted DB role, not
through it.** Every other portal page reads `demand_aggregates`/`token_rate`/`zones`/`categories`
directly via the `core_portal` role, which has no grant beyond those four (§10). Rather than adding
a grant for the new intelligence tables (defensible, since they hold no PII, but still a widening of
a boundary that's been deliberately narrow and tested since Phase 3), the new `/intelligence` page
routes every read *and* write through Core API's admin endpoints instead
(`apps/portal/app/intelligence/core-api.ts`, using a new `CORE_API_INTERNAL_URL`) — the restricted
role's grants are completely untouched by this phase.

**20F. A circular import, caught by the build, not by inspection.** The document-grounded
generator needs `QuestionFeederService`'s variant schema; `QuestionFeederService` needs the
generator. Importing directly from each other's files created a real circular dependency that
crashed Core API on boot (`Nest can't resolve dependencies of QuestionFeederService (PG_POOL, ?)`)
— caught immediately by actually starting the server, not just by `tsc` (which doesn't catch
runtime DI cycles). Fixed by extracting the shared schema into its own dependency-free file,
`apps/api/src/question-feeder/question-variant.schema.ts`, that both sides import from instead of
each other.

**20G. What's NOT configured in this dev environment, and why that's fine.** No
`ANTHROPIC_API_KEY` or `GOOGLE_SERVICE_ACCOUNT_KEY` exists here — real credentials only the project
owner can obtain (an Anthropic Console account; a Google Cloud service account with the target
Drive folder explicitly shared to it). Every code path up to the actual external call is built and
integration-tested against fake `DriveProvider`/`LlmProvider` implementations
(`apps/api/src/intelligence/intelligence.integration.spec.ts`); the two real provider classes
themselves are exercised by attempting a sync/refresh with no credentials configured and confirming
the failure is a clear, named `BadRequestException` — not a crash, not a fake success — surfaced
all the way to the portal.

**Acceptance test (folds into Phase 8's own bar, §12):** syncing a source with one supported and one
unsupported file ingests exactly one document and names the skipped one; a second sync of unchanged
content re-processes nothing; refreshing a zone's understanding twice produces two rows, not one
overwritten row; a `document_grounded` topic with no `zone_id`, or whose zone has no understanding
yet, fails with a clear message; malformed LLM JSON output fails the generation run with zero
partial questions persisted; every successfully generated draft has `review_state = 'draft'` and
`source = 'plugin_generated'`, identical to a template-generated draft.

---

## 21. A QUESTION-AUTHORING WIZARD, NOT JUST GENERATOR TOPICS — ADDENDUM (2026-07-24)

§14's `template` topics let an admin hand-author question *variants* inside a topic's JSON
`config` — real, but not something a non-technical ops person would want to hand-edit. This adds
the missing piece: `POST /v1/admin/questions` creates one question directly, no topic or
generation run involved, surfaced in the portal as a guided form (`/questions`) — pick a category,
write the question, pick how members answer it.

**21A. The answer-type menu is exactly §5's five `type` values, reframed as UI patterns a
non-technical admin recognizes** — nothing new was added to the data model. Single choice → radio
buttons; multiple choice → checkboxes; yes/no → a plain two-way toggle; buying intent → the
existing `intent_window` mechanic (LAW 2's demand-declaration path), with a timeframe picker
instead of raw JSON; number → `numeric`, no options at all. "Voice" and "photo" — floated early as
candidate answer types — deliberately aren't among them: voice is already a general input-capture
method (`responses.input_mode`), not a property of a *question*, and "photo" is the existing Snap
feature, which has its own category-tagging and isn't a Pulse question. Reusing what exists instead
of adding parallel machinery for the same two concepts.

**21B. `intent_window`'s options are never taken from the request body.** `PulseService`'s
strength-detection logic (§6C's redemption gate depends on it) hard-codes checking for
`label_en === 'yes'`/`'maybe'` — so `createDirectQuestion` always inserts the fixed
`Yes`/`Maybe`/`No` triplet for this type, silently ignoring any `options` an admin's request
happened to include, rather than letting a custom label set quietly break demand declaration.

**21C. Authoring directly skips the draft queue, not the discipline behind it.** `source =
'admin_authored'` and `review_state = 'approved'` are set at creation — the admin typing the
question in *is* the review, the same rule §14 already stated for hand-authored template variants.
It's immediately selectable via `GET /v1/pulse/today`, verified live: no separate approval call
needed, unlike every `plugin_generated` draft from a topic's generation run.

**Acceptance test (folds into §14's existing bar):** creating a `single`/`multi`/`yesno` question
with fewer than 2 options is rejected; creating an `intent_window` question with no `intentWindow`
is rejected; a successfully created question has `review_state = 'approved'` immediately and
appears in a fresh member's `GET /v1/pulse/today` without any additional admin action.
