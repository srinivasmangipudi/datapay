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

---

## 22. EVERY QUESTION CAN CARRY SUPPLEMENTARY EVIDENCE — ADDENDUM (2026-07-24)

§21A drew a hard line: voice and photo are input-capture *methods*, not question *types*, so they
were deliberately left out of the answer-type menu. That line still holds for what a question
*requires* — but real usage on a physical device surfaced a gap on the other side of it: a member
answering "how much would you pay for sugar" has no way to add the context that made them pick that
answer, and `numeric`-type questions (e.g. document-grounded ones asking "how many kilograms of rice
does your household use in a month?") had no input UI at all — silently unanswerable. This closes
both gaps: every question, regardless of `type`, can now carry free text, a transcribed-and-translated
voice note, and/or an attached photo as **supplementary evidence alongside its required structured
answer** — additive, never a replacement for it, and never required.

**22A. Three new nullable columns on `responses`, not a new `questions.type`.** `text_value`,
`photo_storage_key` (migration `1738281600000_response_supplements`), plus `input_mode`'s CHECK
constraint gains `'text'` alongside the existing `tap`/`voice`/`snap`. `input_mode` still describes
the *primary* channel used for the question's required answer (almost always `'tap'`, since every
current UI still taps/types a structured value) — the two new columns are independent of it and can
be populated no matter what `input_mode` says.

**22B. Voice notes are transcribed AND translated in one call, via Gemini, not Bhashini.** Bhashini
was the original plan (§8/§9) but ruled out for the pilot as too bureaucratic to get real API access
to in time. `GeminiAsrProvider` (`apps/api/src/voice/asr.provider.ts`) sends the recorded audio
directly to Gemini's multimodal API with a transcribe-and-translate prompt — no separate GCP
Speech-to-Text call needed. `POST /v1/voice/transcribe` now returns `{transcript, translatedText?}`;
the mobile client drops whichever of the two is more useful straight into the free-text note field
for the member to review before submitting. The existing "audio is transcribed and discarded, never
persisted" guarantee (§8/§9, proven by `voice.integration.spec.ts`) is unchanged — only the *quality*
of the transcription changed, not what happens to the audio bytes afterward.

**22C. An attached photo reuses `SnapsService`'s `StorageProvider`, not the Snap feature itself.**
A photo attached to a Pulse answer is supplementary context for that specific response — it does not
go through Snap's product-recognition/ops-verification chain (`uploaded → recognized →
member_confirmed → ops_verified`) or credit a separate `earn_snap` bonus on top of the question's own
`reward_tokens`. It's stored via the same (currently dev-stub) `StorageProvider` Snap already uses,
because it's the same underlying problem (store an image, get a key back) — not because it's the same
*feature*. Real blob storage (GCS) is still not wired up for either use — "photo evidence" isn't a
real claim for Pulse answers any more than it already wasn't for Snap (see `storage.provider.ts`).

**22D. `numeric` questions finally have an answer UI.** `PulseScreen` previously rendered every
question type as tap-chips, including `numeric` — which has no options, so those questions were
unanswerable on the app despite passing every server-side check. This was found, not requested,
while wiring up the supplementary-evidence UI in the same screen; fixing it was in scope because an
unanswerable question type contradicts this addendum's own premise.

**Acceptance test:** a response can be submitted with `textValue`/`photoBase64` set regardless of the
question's `type`, and without either, exactly as before (both fully optional); a `numeric` question
is answerable via a real input field on mobile; `voice.integration.spec.ts`'s audio-is-discarded
guarantee still holds against the Gemini-backed provider.

---

## 23. REGION-SCOPED QUESTION DELIVERY — ADDENDUM (2026-07-24)

Every question, from Phase 1 through §22, was implicitly global — `GET /v1/pulse/today` had no
concept of *where* a member is relative to *what a question is about*. That stopped making sense the
moment the Area Intelligence Question Engine (§20) started grounding questions in one specific zone's
documents — a question drafted from Melukote's ingested reports has no business reaching a member in
an unrelated part of the state, and an ops admin authoring a question by hand (§21) needs the same
choice: "just this region" or "everywhere."

**23A. `questions.zone_id` — nullable, cascades down, never sideways.** Migration
`1738368000000_question_zone_scoping` adds one nullable FK column. `NULL` means global (every
member sees it, identical to every question's behavior before this addendum). A non-null `zone_id`
scopes the question to that zone **and every zone beneath it** in the `zones` hierarchy (village ⊂
panchayat ⊂ hobli ⊂ constituency) — a question scoped to a constituency reaches every village under
it, but a question scoped to one hobli never reaches a sibling hobli under the same constituency,
even though they share a parent.

**23B. The cascade is computed with a recursive CTE over the member's own zone, not the question's.**
`PulseService.today()` walks *up* from the member's `zone_id` to the root, collecting every
ancestor-or-self zone id, then admits a question if `zone_id IS NULL OR zone_id IN (that chain)`. This
is the only direction that scales without precomputing anything: zones are a shallow, rarely-changing
tree (4 levels in the pilot), so walking up from one member is cheap, while walking down from a
question to "every descendant zone" would mean recomputing that set on every insert instead. The same
rule is duplicated (deliberately — see `isEligibleForPulseToday` in `test-fixtures.ts`) for tests that
need to assert eligibility without racing `today()`'s own `LIMIT 5`.

**23C. Both question-creation paths thread the zone through, from two different sources.** A
`document_grounded`/`template`/`llm_assisted` topic's own `zone_id` (already existed on
`question_topics` for §20's document-grounded generation, previously unused by other generator kinds)
becomes every question that topic's generation runs produce — set once on the topic, inherited by
every draft. An admin authoring a question directly (§21's wizard) picks a region explicitly per
question via a new optional `zoneId` field on `CreateQuestionDtoSchema`, defaulting to global if
omitted — the portal's region picker at `/questions` lists every zone indented by level, with "Global
— every member, everywhere" as the first option.

**Acceptance test (`zone-scoping.integration.spec.ts`):** a question scoped to a hobli reaches a
member in a village beneath it but not a member in a sibling hobli under the same constituency; a
question scoped to the member's exact zone reaches them; a question with no zone reaches every
region — all checked via `isEligibleForPulseToday`, not `today()`'s own rotation-limited output.

---

## 24. SCHEDULED GENERATION — THE ENGINE RUNS UNATTENDED — ADDENDUM (2026-07-24)

§20/§21 built the generation *capability* (document-grounded drafts, hand-authored questions) and §23
built *where they go* (region scoping). What was still missing is *when they run*: every generator —
document-grounded, template, admin-authored — required an ops admin to click "Sync," "Refresh," or
"Generate" by hand. `question_topics.schedule_cron` existed as a column since §20's original migration
but nothing ever read it. This wires it up: an admin points a topic at a region's intelligence sources
once, and generation keeps happening on its own from then on.

**24A. Two independent scheduled jobs, not one.** Freshness and generation are different concerns on
different clocks: `IntelligenceRefreshProcessor` runs **daily** for every zone with a connected source
— re-syncs each `intelligence_source`, then rebuilds that zone's `zone_understanding` from whatever the
sync produced — because stale ground truth makes every downstream draft stale regardless of how often
it's generated. `QuestionGenerationProcessor` runs **per-topic**, on that topic's own `schedule_cron` —
because one topic wanting daily drafts and another wanting weekly is a per-topic choice, not a platform-
wide one. A scheduled generation run is functionally identical to an admin clicking "Generate" by hand:
it produces `review_state='draft'` rows and nothing else. Automating the *trigger* never automates the
*review* — §14's gate (a human approves before any member sees it) is untouched.

**24B. `upsertJobScheduler`, not `queue.add(name, data, {repeat, jobId})`.** The latter *looks* like it
dedupes by the given `jobId` (this codebase's two pre-existing scheduled jobs — aggregation, token-rate —
both use exactly that pattern), but in BullMQ v5 it doesn't: the repeatable job's real identity is a hash
of its options, invisible from the `jobId` field, and re-registering it on every app boot risks
accumulating duplicate repeatable entries rather than safely no-op'ing. `upsertJobScheduler(id, repeatOpts,
template)` is the API that's actually keyed by `id` — confirmed directly (`getJobScheduler(id)` returns
what `upsertJobScheduler(id, ...)` created, and calling it twice with the same id updates instead of
duplicating). Both new schedulers here use it. The two pre-existing ones were left as-is — this is a
correctness gap worth fixing, not something to fix silently as a side effect of an unrelated feature.

**24C. A bad `scheduleCron` is rejected before the topic ever exists.** `CronExpressionParser.parse()`
(a direct dependency now, not reached into transitively through bullmq's own bundled `cron-parser`)
validates the string synchronously, before the `INSERT INTO question_topics` — so an invalid cron can
never leave an orphaned topic row with a schedule that silently never fires.

**24D. One failing source or zone doesn't block the others in the same refresh run.** `sync()`/`refresh()`
failures (revoked Drive sharing, no documents ingested yet) are caught per-source and per-zone inside
`IntelligenceRefreshProcessor` — a single broken connection degrades to "that one zone's understanding
didn't update today," not "nothing updated today."

**Acceptance test (`scheduled-generation.integration.spec.ts`):** a topic created with an invalid
`scheduleCron` is rejected with no row inserted; a topic created with a valid cron has a real,
independently-verifiable job scheduler registered (`queue.getJobScheduler` returns it, matching pattern);
a topic created with no cron registers no scheduler at all — manual `/generate` still works for it,
exactly as before this addendum.

**Known limitation, stated plainly:** there is no portal UI yet for creating a `question_topics` row (with
or without a schedule) — topics are still created via a direct API call, same as before this addendum.
The scheduling wiring is real and tested; the "point-and-click, no curl" ops experience for topic creation
itself is not yet built.

---

## 25. THE COMPLETE ADMIN PORTAL — ADDENDUM (2026-07-24)

Every phase before this one built a real admin/ops capability — snap verification, token-rate/
aggregation triggers, fund projects, produce matching, payout batching, audit export, quality
flags — but almost all of it was curl-only, reachable by nobody who wasn't reading this file. §21's
question wizard and §20's intelligence page were the only two exceptions. This addendum puts a UI on
top of everything else and gives the whole portal a front door.

**25A. A shared password gate, not per-user auth.** Every `/v1/admin/*` write endpoint has been
deliberately unauthenticated since §19E ("a later hardening pass") — that posture doesn't change
here. What changes is that the *portal* now fronts all of it, and a portal with this much control
sitting wide open the moment someone finds the URL is a different risk than an unauthenticated API
nobody's indexed. `middleware.ts` gates every route except `/login` behind a single shared
`PORTAL_SESSION_SECRET` cookie, set by `/login`'s server action after checking a separate
`PORTAL_ADMIN_PASSWORD` — deliberately two different values, so a leaked cookie doesn't also leak the
login secret. This is explicitly *not* role-based auth: everyone who knows the one password can do
everything. That's the stated tradeoff, not an oversight.

**25B. One shared layout, not ten copies of the same CSS.** Before this addendum, each of the
portal's 3 pages hand-wrote its own `<style dangerouslySetInnerHTML>` block, independently
reinventing `.eyebrow`/`.tableWrap`/`.errorBanner`/etc. with small inconsistencies each time.
`globals.css` (imported once, in `layout.tsx`) now holds every class shared across pages; a page's
local `<style>` block, where one still exists, holds only what's genuinely unique to that page
(Area Intelligence's knowledge-map cards, for instance). `AdminNav` — one client component reading
`usePathname()` to highlight the current section — replaces what used to be a hand-written
`<a>`-per-page back-link paragraph on every screen.

**25C. New admin endpoints, added because the portal needed them, not the other way round.** Several
capabilities had a service but no route: categories and zones had no create endpoint at all (only
ever seeded via migrations/test fixtures); snaps had no ops-wide list, only a single-item verify;
question topics had no list endpoint; quality flags and trust scores had no read surface at all;
produce listings and producer payouts had no admin-wide view. All of these were added as thin,
unauthenticated (same §19E posture) reads/writes specifically to back a real portal page — not
speculative API surface with no caller.

**25D. Every page follows the same three-file shape** established by §20/§21: a `core-api.ts` (typed
`apiFetch` wrappers, no direct DB access beyond the original §10 grants), an `actions.ts` (`"use
server"`, catches errors and redirects with `?error=`), and a `page.tsx` (server component). A page
needing user input adds a `"use client"` wizard component. The nine new pages this addendum adds:

- **Topics** (`/topics`) — create a `template` or `document_grounded` generation topic (region,
  schedule, category), list existing topics with last-run status, trigger "Generate now."
- **Review queue** (`/review`) — every draft question across every zone in one list, not scoped to
  whichever zone happens to be selected on the Area Intelligence page.
- **Snap verification** (`/snaps`) — the ops queue for `uploaded → ops_verified/rejected`, filterable
  by state. Added a `reject()` path to `SnapsService` that didn't exist before (only `verify()` did).
- **Token economy** (`/token-economy`) — trigger an out-of-cycle token-rate/aggregation run; the
  scheduled jobs (§6C, hourly/3-day) keep running regardless.
- **Fund & governance** (`/fund`) — propose a zone-scoped fund project; members still vote on it in
  the app, this page only ever proposes, never approves on their behalf.
- **Produce & payouts** (`/produce`) — every listing across every producer with its latest linkage
  state, trigger matching per-listing, trigger a payout batch run, view payout history.
- **Audit & fraud** (`/audit`) — quality flags and trust scores (alias-only, LAW 1 holds), plus the
  ledger CSV export proxied through the portal's own origin (`/audit/export`) rather than exposing
  `CORE_API_INTERNAL_URL` to the browser directly.
- **Zones & categories** (`/zones`) — the region hierarchy and category list finally have a create UI;
  before this, both only ever existed via migrations or test fixtures.

**Acceptance:** every route (`/`, `/questions`, `/topics`, `/review`, `/intelligence`, `/snaps`,
`/token-economy`, `/fund`, `/produce`, `/audit`, `/zones`) renders 200 with a real `<h1>` behind a
valid session cookie, and redirects to `/login` without one; `next build` compiles all 14 routes
including middleware with no errors; every new admin endpoint returns real rows from the live
database, not stubs.

---

## 26. CATEGORIES ARE FIND-OR-CREATE, NOT A SEPARATE SETUP STEP — ADDENDUM (2026-07-24)

The question and topic wizards (§21/§25) originally required picking a category from a fixed
dropdown — meaning an admin who wanted to ask about something new had to stop, go to Zones &
Categories, create the category, then come back and start the wizard over. That's friction with no
real purpose: a category is just a name and a slug, not something that needs a separate review step.

**26A. `POST /v1/admin/categories` is now find-or-create, keyed by slug.** `slug` became optional on
`CreateCategoryDtoSchema` — when omitted, `CategoriesService` derives one from `name` (lowercase,
non-alphanumeric runs collapsed to a hyphen). The insert itself is `ON CONFLICT (slug) DO NOTHING
RETURNING id`, falling back to a `SELECT` when the conflict fires — not a `SELECT` first, which would
race two concurrent requests for the same brand-new name into one succeeding and one hitting the
UNIQUE constraint. Calling it twice with the same name is safe either way: the second call returns
`created: false` and the same `id`, never a duplicate row or an error.

**26B. Both wizards now take free text, not a picklist.** `QuestionWizard` and `TopicWizard`'s category
field is an `<input list=…>` bound to a `<datalist>` of existing category names — typing an existing
name still autocompletes, but typing a brand-new one is just as valid. The wizard's own server action
(`createQuestionAction`/`createTopicAction`) resolves the typed name to a category id via the
find-or-create endpoint *before* creating the question/topic — the resolution is invisible to the
admin, who never sees or thinks about a category id at all.

**Acceptance:** creating a question/topic with a category name that doesn't exist yet creates that
category and the question/topic in the same submission, with no separate setup step; submitting the
same new name twice (e.g. two topics for one new category) resolves both to the same category row.

---

## 27. FREE-TEXT QUESTIONS, AND AUTO-TRANSLATE WITH EDIT CONTROL — ADDENDUM (2026-07-24)

Two additions to the question-authoring wizards, requested together: a genuine open-ended answer
type, and a faster way to fill in the Kannada text every question already carries.

**27A. `free_text` is a sixth `questions.type`, not a repurposing of §22's `text_value`.** §22 gave
every question a *supplementary* `text_value` — a note alongside whatever the question's real answer
was. This is different: a `free_text` question's answer *is* the text_value, with no `option_ids` or
`numeric_value` to fall back on, same as `numeric` needs no options. Migration
`1738454400000_free_text_question_type` adds it to the `questions_type_check` CHECK constraint; the
type appears everywhere the existing five already did — `CreateQuestionDtoSchema`,
`QuestionVariantSchema` (so `template`/`document_grounded` topics can produce it too), the mobile
`PulseQuestion` type, and both portal wizards' answer-type menus.

**27B. Mobile reuses the existing note field as the primary answer, not a second text box.**
`PulseScreen` already had a free-text `note` input for §22's supplementary evidence — for a
`free_text` question, that same field becomes the *required* answer (placeholder changes from "Add a
note (optional)" to "Type your answer", and `canSubmit` requires it non-empty) instead of adding a
redundant second input. Voice-record and photo-attach stay available exactly as before — recording a
voice note still transcribes into this same field, and an admin could equally read a member's
free-text answer that started life as a spoken one.

**27C. `aggregation.service.ts` needed no changes.** A `free_text` response's `option_ids` is NULL;
the aggregation query's `LEFT JOIN question_options o ON o.id = ANY(r.option_ids)` already produces
`o.label_en = NULL` for that row, and the existing `.filter(r => r.label_en !== null)` already drops
it from the published `optionCounts` — confirmed by reading the query, not assumed. A free-text
response still counts toward cohort sizing (correctly — it's still a real response), it just
contributes nothing to a tap-option tally, which is the only thing that would ever have been wrong to
publish anyway (free text isn't k-anonymizable the way a chosen option is).

**27D. `POST /v1/admin/translate` — Gemini, EN→KN, always editable before saving.** A new
`TranslationService` (same lazy-init-throws-if-missing-key posture as `GeminiAsrProvider`) wraps a
single-purpose "translate this text" Gemini call. The portal wizards' Kannada field gets a "Translate
to Kannada →" button next to it — the translation fills the field but the field stays a normal,
editable `<input>`; nothing is ever submitted without the admin having had the chance to correct it.
Deliberately scoped to English→Kannada only (matching the schema's actual `text_en`/`text_kn`
columns) rather than a general multi-language selector — the schema and mobile app don't carry any
other language today, so a "pick from many languages" UI would be decoration in front of a feature
that doesn't exist yet.

**Acceptance:** a `free_text` question can be created with zero options via either wizard, and is
answerable end-to-end on mobile (required, not optional, unlike the same field's supplementary role on
every other question type); the translate endpoint returns a real Gemini-produced translation when
`GEMINI_API_KEY` is configured, and a clear `BadRequestException` (not a 500 or a silent fallback) when
it isn't.

---

## 28. THE DATAPAY BRAND SYSTEM, WIRED INTO BOTH APPS — ADDENDUM (2026-07-24)

The user dropped a brand asset package into `apps/assets/` (logo components, color tokens, app
icons, favicons, an OG image) and asked for it applied throughout. What's actually in that folder is
a *subset* of a larger documented package — `apps/assets/README.md`/`INSTALL.md` describe files
(splash.png, adaptive-icon.png, individual favicon sizes, logo-horizontal, pattern tiles, custom
font files) that were never included. Everything below uses only what's real; gaps are named, not
papered over.

**28A. The mobile app's existing palette had already independently converged on most of this.**
`apps/mobile/src/theme.ts` predates the brand package and already had `ink` (#101418) and `teal`
(#0E7A5C) at the *exact* canonical hex — `brass` was off by one shade (#C99A2E vs. the real
#B98F2F) and has been corrected, along with two tint colors aligned to their canonical values
(`paper`→ porcelain #F6F5F1, `tealTint` → jadeSoft #E3EFEA). A new `tealBright` (#12946F, brand
"jadeBright") and `mist` (#8A939B) were added for parity with the full token set.

**28B. The portal's primary accent was blue (#2a78d6) — not a brand color at all.** Every page's
eyebrow text, nav links, active-nav highlight, and primary buttons used an ad hoc blue that predates
this addendum and was never part of DataPay's actual identity. `globals.css` now defines the real
palette as CSS custom properties (`--ink`, `--jade`, `--jade-bright`, `--jade-soft`, `--brass`,
`--brass-bright`, `--mist`) and every one of those blue instances — light and dark mode — now
resolves to jade instead.

**28C. Brass is applied only to genuine value/money displays, per the brand's own rule ("value &
money only — never body text").** Not a blanket recolor of every number: a new `.value` utility
class went specifically onto the token-rate tile (₹), fund/produce ₹ amounts, and reward-token (◈)
table cells — plain counts (cohort size, vote tallies, aggregate counts) stay the default text color
because they aren't money.

**28D. `DataPayMark`/`DataPayLogo` — copied in as provided, not reinvented.** Both are inline-SVG
components (no image asset dependency for the small in-app placements) at
`apps/mobile/src/brand/DataPayLogo.tsx` (React Native, needs `react-native-svg`, now installed) and
`apps/portal/app/components/DataPayLogo.tsx` (web). Placed: the portal's `AdminNav` (mark, every
page) and `/login` (full logo + tagline); the mobile app's onboarding welcome screen and the home
screen header (mark next to the member's alias). The wordmark's custom display font (Cabinet
Grotesk) isn't bundled — no font files were part of the asset drop — so it falls back to the system
font everywhere; the brass "Pay" color and -9° skew still render correctly either way.

**28E. App icons wired via each platform's real file convention, not hand-rolled metadata.** Next.js
App Router auto-detects `app/favicon.ico`, `app/icon.png`, `app/apple-icon.png` — dropping the real
files in was the entire integration, no manifest code needed. Expo's `app.json` gained `icon`
(`./assets/icon.png`) and a `splash` block using the same source image (no dedicated splash asset was
provided). Android's `adaptiveIcon` was deliberately **not** configured — the only square-icon asset
available (`icon.png`) is opaque with the mark already inset, not the transparent, edge-to-edge
foreground layer adaptive icons need; using it there would double-crop under Android's own mask.
Real transparent foreground art would need to be added before that's wired up.

**28F. The auth middleware needed a fix once real asset routes existed.** `middleware.ts`'s matcher
only excluded `favicon.ico` from the §25 login gate — `icon.png`, `apple-icon.png`, `og-image.png`,
and the copied SVGs were being redirected to `/login` (caught directly: curled each one, got 307s).
Fixed by excluding all of them — a favicon or a shared-link preview has to load whether or not the
viewer is signed in; nothing else in the matcher changed.

**Acceptance:** every new icon/asset route (`/icon.png`, `/apple-icon.png`, `/favicon.ico`,
`/og-image.png`, `/mark-primary.svg`) returns 200 with the correct content-type, unauthenticated;
`AdminNav`'s rendered HTML contains the mark's actual SVG markup; `next build` and mobile's `tsc
--noEmit` both pass clean with zero new errors.

---

## 29. THE PUBLIC DEMAND REGISTRY + OPPORTUNITIES PAGE — ADDENDUM (2026-07-24)

Everything under `/v1/admin/*` and the portal's `AdminNav`-gated pages is deliberately
unauthenticated-for-now per §19E — a stopgap, not a design decision, until real per-user auth exists.
This addendum is different in kind: `/v1/public/registry` and the portal's `/registry` page are
**meant to have no login, ever** — a public-facing page showing what real, k-anonymized household
demand looks like, and where it's going unmet, for anyone (press, officials, prospective suppliers)
to see without an account. Built inside the admin portal app for now, per the user's explicit "we can
move it later" — kept deliberately decoupled from the rest of the portal so that move is cheap.

**29A. Two sections, one query shape, one honest distinction.** `PublicService.getRegistry()` runs
two queries against `demand_aggregates` (joined to `categories`/`zones` for display names): the
**registry** is every published aggregate, newest first; **opportunities** is the same rows filtered
to `NOT EXISTS` a matching open `offers` row — same `zone_id`, and an `offers.product_code` whose
`products.category_id` matches the aggregate's category. That `NOT EXISTS` join is the entire
definition of "unmet demand" the user chose (over the other option offered: demand nearing the k=50
threshold) — real supply-side absence, not a proxy for it. Both queries select only
`category_name`/`zone_name`/`zone_level`/`cohort_size`/`computed_at` — deliberately never
`collective_price_paise` or `market_price_paise`, which are commercially sensitive and have no
business on a public page.

**29B. `GET /v1/public/registry` carries no guard, by design — verified, not asserted.** `public.
controller.ts` has no auth decorator at all, and the doc comment on the module says explicitly why
this is not the same posture as §19E's admin endpoints. Confirmed live: rebuilt, restarted the API,
curled the endpoint directly and got `{"registry":[],"opportunities":[]}` — and confirmed by direct
query that this empty result is *correct*, not a bug: zero rows exist in `demand_aggregates` yet, and
the real per-category/zone response counts (checked directly) all fall well short of the k=50
publication floor (six responses was the highest, for rice in one village). The page has to render
that state gracefully, not assume data will always be there by the time someone visits.

**29C. The portal route needed two separate exclusions, not one.** `middleware.ts`'s matcher gained
`registry` alongside its existing static-asset exclusions (§28F) — without it, the login gate would
redirect a public page to a login form, defeating the entire point. `AdminNav` also gained a
`pathname === "/registry"` check next to its existing `/login` check, so the ops-only nav bar (with
its "Log out" button and nine admin links) doesn't render on a page meant for the general public.

**29D. The page's styling is fully self-contained — no `globals.css` dependency.** Every other portal
page shares `globals.css` and `AdminNav`'s layout chrome; `/registry` intentionally does not, via an
inline `<style>` tag scoped to its own class names. This is the concrete form the user's "we can move
it later" took: the file can be lifted into a standalone Next.js app with just `page.tsx` and
`core-api.ts` — no CSS variables or shared components to untangle first. `core-api.ts` still goes
through Core API (`apiFetch("/v1/public/registry")`) rather than a direct DB read, same §10
discipline as every other page, just against a genuinely public endpoint instead of an admin one.

**Acceptance:** `curl http://localhost:3002/registry` returns 200 with no redirect, unauthenticated
(confirmed directly, alongside `/` correctly still 307-ing to `/login`); the rendered page shows
tasteful empty-state copy for both sections rather than a blank or broken layout, matching the real
current state of zero published aggregates; `next build` passes clean with the new route listed as
server-rendered (`ƒ /registry`).

---

## 30. MEMBER-PROPOSED FUND PROJECTS — ADDENDUM (2026-07-24)

The mobile Community tab's "fake data" turned out to be real, but wrong: 43 identical "Streetlight
repair" rows had accumulated in `fund_projects`, one per run of `fund.integration.spec.ts` — the test
created a project via the admin endpoint to exercise the one-vote-per-member rule but never deleted
it afterward (the same class of bug as the earlier "suppression test question" incident). No seed
script or fixture inserts fund projects anywhere in this repo; this was pure test debris, confirmed
by reading every seed migration and grepping for the literal title. Deleted all 43 rows directly
(`fund_votes` cascades off `fund_projects`, so nothing else needed cleanup), and fixed the test to
delete its project row in the same place it already deletes its test members.

**30A. Members can now propose a project into their own zone's fund — a real gap, not a UI-only
one.** Until now `fund_projects` only had one write path: `POST /v1/admin/fund-projects`, ops-only,
zone chosen by whoever's calling it. `POST /v1/fund/projects` (new, member-facing, same
`AliasAuthGuard` as every other member write) adds the missing path: `FundService.proposeProject()`
resolves the zone from the caller's own membership (`getMemberZone`) and never accepts a client-
supplied `zoneId` — a member can only ever propose into the zone they actually belong to, the same
trust boundary as every other member-facing endpoint in this codebase. New project rows land with
the schema's existing default status (`proposed`) — no new status-transition logic was needed, since
none existed before this either (moving `proposed → voting → approved → funded → done` is still a
manual/ops action, unchanged).

**30B. "Upvote/downvote once" was already enforced server-side — the gap was the client, not the
rule.** `fund_votes`' `UNIQUE(project_id, alias_id)` constraint (§12 Phase 5, unchanged) already made
a second vote from the same alias impossible at the database level, regardless of what the mobile app
remembered locally. What was missing was the server ever telling the client it had already voted:
`GET /v1/fund/projects` now returns `yesVotes`/`noVotes`/`myVote` per project (a `LEFT JOIN` against
`fund_votes` plus a per-caller correlated subquery for `myVote`), replacing the mobile screen's old
`votedIds` local-only state — which meant a killed-and-reopened app forgot every vote it had cast
until the member tried again and hit a 400. The vote buttons (styled as ▲/▼ counts, brand jade/danger
colors) now disable and highlight based on the server's `myVote`, and there's still no vote-changing
path — casting once is final, matching the DB constraint exactly.

**30C. The Community tab gained a propose form, not a separate screen.** A "+ Propose a project"
toggle above the active-votes list reveals a small inline form (title, estimated cost in rupees,
converted to paise before the request) — kept in the same screen deliberately, since proposing and
voting are the same activity from a member's point of view. Submission errors (e.g. a network
failure) surface inline rather than failing silently, unlike the vote action's deliberately-silent
catch (a failed vote just leaves the buttons active again on reload — there's no ambiguous state to
explain, but a failed proposal would otherwise look like nothing happened).

**Acceptance:** `fund.integration.spec.ts` passes and leaves zero rows in `fund_projects` afterward
(confirmed via direct query pre- and post-run, both `0`); `POST /v1/fund/projects` is mapped and
reachable only with a valid member bearer token; a member who has already voted on a project cannot
vote again even after force-quitting and relaunching the app, because `myVote` now comes from the
server on every load, not from memory.

---

## 31. EDITABLE FUND PROJECTS IN THE ADMIN PORTAL — ADDENDUM (2026-07-24)

Before this, `fund_projects` had exactly one ops write path (`POST /v1/admin/fund-projects`, create
only) — a typo in a title, a wrong estimate, or moving a project through its status lifecycle
(`proposed → voting → approved → funded → done`) had no UI at all; the only fix was a direct SQL
`UPDATE`. This closes that gap with a real edit path, not a bigger create form.

**31A. `PATCH /v1/admin/fund-projects/:id` — partial update, same posture as the rest of §25's admin
API (no auth guard yet, per §19E).** `UpdateFundProjectDtoSchema` (`packages/shared/src/dto.ts`)
makes every field optional (`title`, `titleKn`, `estimatePaise`, `status`) but `.refine()`s that at
least one is present — an empty `{}` body is a 400 ("Provide at least one field to update"), not a
silent no-op. `FundService.updateProject()` builds its `SET` clause from whichever fields were sent
and returns the row via `RETURNING id`; a nonexistent project id is a real 404
(`NotFoundException`), not a quiet 200 that changed nothing. `status` is constrained to the same five
values the table's own CHECK constraint allows — the DTO and the schema agree on the same list by
construction, not by copy-paste luck.

**31B. The portal's project table is now a client component with an inline edit row, not a separate
edit page.** `FundProjectsTable.tsx` (new) replaces the static table that used to live directly in
`page.tsx`; clicking "Edit" swaps that one row for input fields (title, Kannada title, a status
`<select>` restricted to the five real statuses, and estimate in ₹) pre-filled with the row's current
values, "Save" and "Cancel" buttons alongside. This is the same client-component-plus-server-action
shape as `FundWizard.tsx`'s create form (`useTransition`, inline `clientError`, no full-page reload) —
extended to editing rather than inventing a second pattern.

**31C. This is also the only place in the entire app a project's status can move.** Nothing before
this addendum ever wrote anything other than `'proposed'` into `fund_projects.status` — not a bug
being fixed, just a genuinely unbuilt path until now. Advancing a project to `voting`/`approved`/
`funded`/`done` is still entirely a manual ops call (no automatic vote-threshold or deadline logic
was added), made through this same edit form by picking a different status and saving.

**Acceptance:** `PATCH /v1/admin/fund-projects/:id` confirmed live — a title/estimate/status edit
persists and reads back correctly, an empty body 400s with the refine's message, and an unknown id
404s; the portal's `/fund` page (authenticated) renders the edit button against the two real
member-proposed projects live in the DB ("art for schools", "Farm school"); `pnpm build`/`tsc
--noEmit` clean across `packages/shared`, `apps/api`, and `apps/portal`; `fund.integration.spec.ts`
still passes and still leaves zero rows behind.

---

## 32. SNAP IMAGE RECOGNITION — GEMINI VISION TAGS, LABELS, PRODUCT & CATEGORY GUESSES (2026-07-24)

`snaps.state` has always had a `recognized` value in its CHECK constraint (SPEC.md §8.4's own
described chain: `uploaded → recognized → member_confirmed → ops_verified → rejected`) — but nothing
ever wrote it. A snap sat at `uploaded` until an ops reviewer manually verified or rejected it, with
zero automated help figuring out what was actually in the photo. This closes that specific gap: real
image analysis, not a stub — same "GCP/Gemini across the stack, not Bhashini" posture as ASR (§9) and
translation (§27D).

**32A. `GeminiVisionProvider` (`apps/api/src/snaps/vision.provider.ts`) — same lazy-init,
fails-loudly-if-misconfigured shape as every other Gemini provider in this codebase, with one
deliberate difference: it degrades instead of failing the request.** `GeminiAsrProvider`/
`GeminiTranslationProvider` throw if `GEMINI_API_KEY` is missing, because their callers (a member
speaking, an admin translating) are asking for that specific thing to happen right now. Recognition
is different — it's enrichment on top of a reward that's already been earned, so `SnapsService`'s
private `vision` getter falls back to a `DevNoopVisionProvider` (empty tags, by design — never
invents plausible-looking ones) rather than throwing, if the key isn't configured.

**32B. Recognition runs after the reward is committed, not before — a member's tokens never depend
on whether Gemini could tag the photo.** `submit()` now fires `this.recognize(snapId, imageBase64)`
as a background call (`.catch()`'d, not `await`'d) only after the transaction crediting tokens has
already resolved; a failed or slow Gemini call is logged and otherwise invisible to the member. This
also sidesteps a real constraint: `storage.provider.ts`'s `DevNoopStorageProvider` discards the
actual image bytes immediately (no real blob storage is wired up yet, documented since §8's original
build) — recognition works around that by analyzing `dto.imageBase64` while it's still in scope,
before it would otherwise be thrown away, rather than depending on storage that doesn't durably exist.

**32C. The model returns tags, a label, a product guess, AND a category guess — the category guess
is checked against the real category list, never trusted blindly.** The prompt sends Gemini the
exact list of real category slugs and requires it to either copy one verbatim or return `null` —
`GeminiVisionProvider.analyze()` re-validates the returned slug against that same list itself
(`categories.some(...)`) before it's treated as real, so a hallucinated slug can never become a
dangling reference. `productGuess` is intentionally free text, not FK-validated against `products` —
the pilot's product catalog is one row deep today, so matching against it reliably isn't
possible yet; it's stored as an honest guess, not a validated product link.

**32D. The AI's category guess is stored separately from the member-declared one — never merged
into it.** New columns `recognized_tags`, `recognized_label`, `recognized_confidence`,
`recognized_product_guess`, `recognized_category_id` (migration
`1738540800000_snap_recognition.js`) sit alongside the existing `category_id`, which stays exactly
what the member chose (or left blank) at capture time. This matches the same "AI output is always a
suggestion, never silently becomes the system of record" posture as §27D's translate-then-edit flow
— ops sees both and decides, recognition never overwrites ground truth.

**32E. Surfaced in the ops verification queue, not on the member's device.** The portal's `/snaps`
page gained an "AI tags" column — product guess, tags, matched category (if any), and confidence —
next to the existing verify/reject actions, explicitly captioned as "ops-assist only, never a
substitute for actually looking at the evidence." Nothing was added to the mobile Snap screen; a
member never sees or interacts with their own photo's AI tags.

**Acceptance:** confirmed live against a real (non-garbage) JPEG through the running API and a real
`GEMINI_API_KEY` — Gemini correctly tagged an unrelated logo image as `{graphic, logo, icon, vector,
symbol}` at 0.3 confidence with no product guess and no category match (an honest low-confidence
non-match, not a forced one); `snaps.integration.spec.ts` gained a test using a
`FakeVisionProvider` override (same seam as `TranslationService.translationOverride`) that polls for
the background recognition to land and asserts the real category-slug validation resolves to a real
`category_id`; the portal's `/snaps` page renders the new column against live data; `pnpm build`
clean on `apps/api`, `tsc --noEmit` clean on `apps/portal`.

---

## 33. FIX: "REQUEST ENTITY TOO LARGE" ON SNAP UPLOADS (2026-07-24)

`main.ts` never configured a body-size limit, so Nest fell back to Express's default (100kb) for
every endpoint. That's fine for JSON DTOs, but a real camera photo — base64-encoded, often several
MB — blew straight past it, and the mobile app surfaced Express's raw `PayloadTooLargeError` as
"Couldn't upload image. Request entity too large." §32's snap recognition work made real (not
garbage) image bytes flow through this same path for the first time this session, which is what
surfaced it.

**Fix:** `bootstrap()` now disables Nest's built-in body parser (`{ bodyParser: false }`) and
re-registers `express`'s own `json`/`urlencoded` parsers with an explicit `15mb` limit — enough
headroom for a full-resolution phone photo's base64 encoding (~33% larger than the raw file).

**A real dependency gap surfaced doing this, not just a config tweak.** `import { json, urlencoded }
from "express"` doesn't resolve at all under this repo's pnpm workspace — `express` was only ever a
*transitive* dependency of `@nestjs/platform-express`, never a direct one, and pnpm's strict
node_modules layout doesn't let a package reach into dependencies it didn't declare itself
("phantom dependency" access, which npm/yarn's flatter layouts allow by accident and pnpm
deliberately blocks). Added `express` as a direct dependency of `apps/api` — but pinned to `^4.22.1`
to match the version `@nestjs/platform-express@10` actually runs internally, not the `^5.x` that
`pnpm add express` resolves to by default today. Nest 10 is built and tested against Express 4;
running two different major versions side-by-side in the same process (Nest's internal one on v4,
this file's directly-imported one on v5) risked subtle incompatibilities for no real benefit, so both
now resolve to the same v4.22.1 install.

**Acceptance:** confirmed live — a ~2.6MB request body (26× the old 100kb ceiling) that previously
would have 413'd now returns `201 credited`; `apps/api/node_modules/express` resolves to the same
`4.22.1` install `@nestjs/platform-express` uses internally (checked directly, not assumed);
`snaps.integration.spec.ts`, `voice.integration.spec.ts`, and `fund.integration.spec.ts` all still
pass, confirming normal-sized JSON request handling is unaffected by disabling Nest's default parser.

---

## 34. PHOTO/VOICE MOVE FROM A GENERIC SNAP TAB TO A PER-QUESTION ANSWER MODE (2026-07-24)

The mobile app had two, disconnected ways to submit a photo: a standalone "Snap" tab (point the
camera at anything you use, get a small reward, no question involved) and a photo-attach button
already living inside Pulse's answer flow (§22, evidence supplementary to a specific question's
answer). The user asked for three things: the Snap tab's raw camera capture uploaded with no chance
to review what was actually captured; photo (and voice) should only ever be offered as part of
answering a specific question, not as a free-floating button; and the question's author — not a
blanket app-wide setting — should decide whether a given question accepts photo/voice evidence at
all, on by default.

**34A. The Snap tab is gone — not hidden, removed.** `apps/mobile/src/main/SnapScreen.tsx` (raw
`expo-camera` `CameraView`, immediate `takePictureAsync` → upload, no preview) is deleted, along with
its `"snap"` entry in `MainApp.tsx`'s tab bar, `strings.tabs.snap`, and the whole `strings.snap`
block. Mobile's `submitSnap()` API client function is deleted too — nothing in the app calls
`POST /v1/snaps` anymore. **Left alone, deliberately:** the backend `snaps` module/table, its
recognition pipeline (§32), and the admin portal's `/snaps` verification queue — those are real,
independent infrastructure the user didn't ask to remove, and this is a big enough call (rolling back
part of §8/§32) that it's flagged here rather than silently taken. If the whole `snaps` feature
should also be retired, that's a separate, explicit decision.

**34B. "The photo should freeze" turned out to already be solved by the OTHER photo path.**
`PulseScreen.tsx`'s existing `attachPhoto()` uses `expo-image-picker`'s `launchCameraAsync`, whose
native camera UI already shows a freeze-frame + "use photo / retake" confirmation before ever
returning control to the app — unlike the deleted `SnapScreen`'s raw `CameraView`, which had no such
step. Consolidating onto this path fixes the freeze complaint as a side effect of removing the worse
path, not a separate fix. The one gap carried over deliberately: the Snap tab's `hasFace()` privacy
check (SPEC.md §8.4, rejects a photo that looks like it contains a person) is now also run inside
`attachPhoto()` — dropping it during the move would have quietly regressed a real privacy protection.

**34C. `questions.allow_photo`/`allow_voice` — both default `true`, an admin opts out, not in.**
New columns (migration `1738627200000_question_photo_voice_gating.js`), returned by
`GET /v1/pulse/today` and enforced (not just hidden client-side) by `POST /v1/pulse/answers`: a photo
on a `allow_photo = false` question, or `inputMode: "voice"` on an `allow_voice = false` one, is a
`400`, not a silent drop — the mobile client shouldn't offer the control at all if it's off, so
hitting this in practice means a stale client, and a clear rejection is the right response to that,
not partial acceptance. The portal's `QuestionWizard` gained a fifth step ("Evidence") with two
checkboxes, both checked by default; the recent-questions table shows what each question actually
allows.

**34D. `inputMode` is one categorical value but a response can now carry a photo AND a voice-sourced
note at once — precedence had to be decided, not left implicit.** `PulseScreen.submit()`: a photo
takes priority (`"snap"`), then a voice-sourced note (`"voice"` — tracked via a new `usedVoice` flag,
set only when transcription actually produced the note text, not when the member just typed
something), then the question-type default. This also, as a side effect, activates two reward
branches (`earn_voice`, `earn_snap`) in `pulse.service.ts` that existed since §22 but were dead code —
the mobile client never sent anything but `"tap"`/`"text"` before this.

**34E. A photo attached to a Pulse response is analyzed the same way a Snap always has been —
reused, not reimplemented.** `PulseService` gained the exact same lazy `vision` getter, background
(`.catch()`'d, never `await`'d) `recognize()` call, and category-slug validation as `SnapsService`
(§32) — importing `GeminiVisionProvider`/`DevNoopVisionProvider` from `apps/api/src/snaps/
vision.provider.ts` rather than duplicating the logic. Results land in new `responses` columns
(`recognized_tags`, `recognized_label`, `recognized_confidence`, `recognized_product_guess`,
`recognized_category_id`, `recognized_at` — same shape as `snaps`'), same "never gates the reward,
ops-assist only" posture. Voice's equivalent — "analysed, saved as part of the response" — was
already true before this addendum: `transcribeVoice()` already runs client-side and its output
already lands in `textValue`; nothing new was needed there beyond the gating and `inputMode` fixes
above.

**Acceptance:** confirmed live — a question created with `allowVoice: false` 400s a voice-mode
answer and 400s nothing for a photo; a photo submitted to an `allowPhoto: true` question credits
immediately (`201 credited`) and a real Gemini call (not a fake) tags the response's photo in the
background, polled and confirmed in the database; `pulse.integration.spec.ts` gained three new tests
(photo-gating rejection, voice-gating rejection, background recognition via a `FakeVisionProvider`
override) and `create-question.integration.spec.ts` gained one (default-true / explicit-false);
`tsc --noEmit` clean on `apps/mobile` and `apps/portal`, `pnpm build` clean on `apps/api`; grepped
the mobile source tree to confirm zero remaining references to `SnapScreen`, `strings.tabs.snap`, or
`strings.snap`.

---

## 35. GEOLOCATION → NEAREST-ZONE RESOLUTION, PER RESPONSE (2026-07-24)

The user's ask: capture geolocation on every question response, so demand can eventually be
calculated by real place, not just by whatever zone a member picked once at onboarding — "a proper
GIS system." Before writing any code, three real tradeoffs needed the user's own call (asked via
`AskUserQuestion`, not assumed): how precise a location to keep and where it lives, whether to
capture it once (onboarding) or every time, and whether real boundary-polygon data already exists.
Answers: **zone-only, no raw GPS stored**; **every time a question is answered**; **still need
boundary data — try bharatatlas.com**. That third answer changed the plan mid-build (§35C).

**35A. What "zone-only, no raw GPS stored" means concretely: coordinates are used, never kept.**
`PulseAnswerDtoSchema` gained optional `lat`/`lng` (SPEC.md §35), but `PulseService.submitAnswers()`
resolves them to a zone id via `ZoneResolverService.resolveNearestZone()` *before* the transaction —
a read-only lookup, not a write — and only that resolved id is ever referenced again; `answer.lat`/
`answer.lng` are never passed to a query, a log line, or anywhere past that one call. `responses`
gained a `zone_id` column (migration `1738713600000_geo_zone_resolution.js`) for the result —
deliberately separate from `members.zone_id` (the zone chosen once at onboarding, unchanged) — not a
`lat`/`lng` column. `geo-resolution.integration.spec.ts` asserts this schema-level, not just by
convention: it queries `information_schema.columns` and fails if any raw-coordinate column ever
appears on `responses`.

**35B. Captured every time, but never blocking — `expo-location`'s cached reading, not a live GPS
fix.** This app is offline-first by construction (an answer enqueues locally the instant it's given,
SPEC.md §3); awaiting a fresh GPS fix (which can take seconds cold) on every single answer would have
visibly stalled that. `PulseScreen.getBestEffortLocation()` uses `getLastKnownPositionAsync()` — an
already-cached reading, effectively instant — and returns `null` on any denial, timeout, or missing
cache rather than throwing; a question always submits regardless of whether a location was obtained.
Permission is requested (once — the OS itself suppresses repeat prompts after a denial) via the
standard `expo-location` flow, coarse accuracy only (`ACCESS_COARSE_LOCATION` on Android), matching
the "we only need which village, not which house" scope.

**35C. Real boundary-polygon data still doesn't exist — bharatatlas.com was checked twice and never
returned usable content.** Fetched directly (both `bharatatlas.com` and `www.bharatatlas.com`) while
building this — empty both times (likely a JS-rendered SPA the fetch tool can't execute, or the
domain isn't what it was remembered as). Rather than block the whole feature on unresolved data
sourcing, `ZoneResolverService` ships nearest-centroid matching instead: `zones` gained
`centroid_lat`/`centroid_lng` (admin-settable, both nullable — a zone with no centroid is just never
matched, not an error), and resolution is a Haversine-distance nearest search capped at 50km (a
pilot-scale sanity bound, not a universal constant — tunable if the pilot area grows). This is
strictly less precise than real polygons would be, and is documented as exactly that, not dressed up
as more than it is. [[memory: geo_zone_resolution]] records the exact current state of which zones
actually have centroids set (5 of 6 — real Melukote-pilot zones, approximate town-center coordinates
from general knowledge, not surveyed) and flags a likely-stray "Mapusa" zone (a real town in Goa,
unrelated to this Mandya pilot) that has none.

**35D. Demand aggregation deliberately still uses `members.zone_id`, not the new per-response
one — not an oversight, a scope boundary.** A household's *registered* zone is what determines where
a collective-buy truck actually delivers; the zone resolved from wherever a member happened to be
standing when answering a Pulse question is a different, additional signal (useful later for
detecting zone drift, or as a fraud/quality input alongside `FraudService`'s existing checks) — not
automatically the right thing to recalculate demand-by-place against. `aggregation.service.ts` is
untouched by this addendum. If per-response geo should eventually feed aggregation, that's a distinct
decision to make explicitly, not an implicit side effect of capturing the data.

**35E. Portal support: create-time centroid fields, plus inline edit for existing zones.**
`ZoneWizard.tsx`'s create form gained optional centroid lat/lng inputs; `/zones` also gained
`ZonesTable.tsx` (the same inline-edit-row pattern as `FundProjectsTable.tsx`, §31) so a zone created
before this addendum — i.e. every zone that exists today — can have its centroid set or corrected
after the fact via `PATCH /v1/admin/zones/:id`.

**Acceptance:** confirmed live — `resolveNearestZone()` correctly matches a reading near a
zone's real centroid and correctly returns `null` for one >1500km away (New Delhi, well past the
50km cap); a real Pulse answer submitted with `lat`/`lng` near Kikkeri's centroid resolved and stored
`responses.zone_id = 'Kikkeri'` end-to-end through the live API; `geo-resolution.integration.spec.ts`
(4 tests, including the schema-level "no raw coordinate column" assertion) plus the existing
`pulse`/`zones`/`snaps`/`question-feeder`/`fund` suites (34 tests total) all pass together; `tsc
--noEmit` clean on `apps/mobile`/`apps/portal`, `pnpm build` clean on `apps/api`. One test-authoring
bug surfaced and was fixed during this work, not left in: the geo-resolution test's own test-zone
centroid was initially set to Melukote's exact real-world coordinates, which broke the moment
Melukote's actual centroid was also set to that location — a genuine tie, not a resolver bug — fixed
by moving the test's centroid somewhere no real pilot zone will ever coincide with.

---

## 36. SIGNUP REDESIGN: NO AADHAAR, AND A CHOSEN (NOT ASSIGNED) DISPLAY ALIAS (2026-07-24)

The user's original ask included collecting an Aadhaar number at signup. Flagged before writing any
code, not built and quietly dropped, and not silently skipped either: India's Aadhaar Act restricts
Aadhaar collection/authentication to UIDAI-licensed "Requesting Entities," and the Supreme Court's
2018 Puttaswamy ruling struck down *mandatory* Aadhaar for private, non-welfare services outright — a
pilot with no such license would carry real legal exposure, on top of directly contradicting LAW 1's
"no name, no phone, no address, ever" architecture. Asked the user directly; confirmed: drop it,
phone+OTP is enough. The rest of the ask — a nicer visual pass, and letting a member pick their own
public name from generated options rather than have one silently assigned — proceeded as designed.

**36A. Alias generation and alias commitment used to be the same atomic step — split into two.**
Before this addendum, `AuthService.resolveOrCreateAlias()` picked ONE random `display_alias` and
inserted it in the same breath as the OTP verification. Now: a *returning* member's flow is
byte-for-byte unchanged (existing `alias_map` row → straight to a session token, no picking). A
*first-time* member instead gets an 8-name batch and commits nothing yet — `verify-otp`'s response is
now a discriminated union, `{status:"returning", token, aliasId, displayAlias}` or
`{status:"choose_alias", pendingToken, aliasId, candidates}`.

**36B. A new Vault table, `pending_signups` (migration `1738800000000_pending_signups.js`), bridges
"OTP verified" to "name chosen" — one row per user, replaced (not duplicated) on re-verification.**
Two new Vault endpoints close the loop: `POST /alias-candidates` (fetch a fresh batch for the same
session — "see various combinations," the exact ask) and `POST /commit-alias` (locks in the pick,
mints the real JWT, deletes the pending row). Both are proxied through Core's existing unauthenticated
`AuthProxyController` (`POST /v1/auth/otp/alias-candidates`, `POST /v1/auth/otp/commit-alias`) —
Vault itself stays never-internet-facing, unchanged.

**36C. The chosen name is never trusted at face value — re-validated against the real word lists,
not just checked for "looks like a name."** `commitAlias()` rejects anything that isn't an exact
`RIVER BIRD NN` combination genuinely producible by `alias.util.ts`'s own generator
(`isWellFormedDisplayAlias()`) — a member (or a modified client) can't submit an arbitrary string as
their "generated" alias. A same-name race between two different members committing in the same
instant is handled explicitly: the loser gets a `409`, not a silently-overwritten row, and `alias_map`'s
existing `UNIQUE` constraints (both `user_id` and `display_alias`) are what actually enforce it —
`commitAlias()` just interprets the two different `23505` cases correctly (own retry → idempotent
replay; someone else's name → ask for a different one).

**36D. Five onboarding screens redesigned, one new one added — all real, no fabricated illustration
assets.** `PhoneEntryScreen`, `OtpVerifyScreen` (now individual digit boxes, not a single 6-char
field), the new `ChooseAliasScreen`, `ZonePickerScreen`, and `AliasRevealScreen` (reframed from
"reveal" to "here's your profile," since the name is chosen now, not surprised-with) all share a new
`ProgressDots` component and consistent brand styling (jade/brass/porcelain, `DataPayLogo`/
`DataPayMark`, rounded cards) — built from the theme's real tokens and soft decorative circles (plain
colored `View`s), not invented image assets that don't exist in `apps/assets`.

**Acceptance:** confirmed live through the actually-running Vault + Core services (not just tests) —
a real signup cycle: request OTP → verify (returns 8 real candidates, commits nothing) →
`alias-candidates` (fresh batch) → `commit-alias` (real JWT, JWT payload decoded and confirmed to
contain only `aliasId`/`displayAlias`, no phone) → re-verifying the same phone now returns
`status:"returning"` with the identical alias → `PUT /v1/me` creates the real Core member end to end.
32 Vault tests (14 rewritten/new in `auth.integration.spec.ts` for the new contract, 9 new unit tests
in `alias.util.spec.ts`) and the existing 34 API tests (`pulse`/`zones`/`snaps`/`question-feeder`/
`fund`, unaffected by this change) all pass; `tsc --noEmit` clean on `apps/mobile`, `pnpm build`
clean on `apps/vault` and `apps/api`.

---

## 37. ZONE CENTROIDS: PICK ON A MAP, NOT TYPE COORDINATES (2026-07-24)

§35's admin-facing centroid fields were plain latitude/longitude number inputs — functional, but not
how anyone actually thinks about "where is this place." Replaced with `ZoneCentroidMapModal.tsx`, an
interactive Leaflet map (OpenStreetMap tiles, no API key — same "avoid unnecessary bureaucracy"
reasoning as ruling out Bhashini for voice, SPEC.md §9): tap anywhere to drop a marker, drag to
adjust, save. Used in two places — `/zones`' per-row "Set centroid"/"Edit" button (`ZonesTable.tsx`,
now a modal trigger instead of an inline editable row) and `ZoneWizard.tsx`'s create form (replacing
its two manual number inputs) — one component, not two implementations of the same picker.

**37A. Opens centered on the admin's own location when a zone has no existing centroid yet** — the
explicit ask, not a guess at what "beautiful and simple" meant. Falls back to a wide view of the
pilot area (Melukote) if geolocation is denied or unavailable; either way this is silent and
non-blocking — declining to share location is a normal choice, not an error state. A zone that
already has a centroid opens centered on that point instead (editing, not re-discovering).

**37B. The save button is fire-and-forget, matching how every other action-triggering button in this
portal already works — not a new pattern.** `updateZoneCentroidAction`/`createZoneAction` always
redirect (to `?updated=zone` or `?error=...`), never throw back to the caller — so the modal doesn't
`await` or `try/catch` the save; it hands `{lat, lng}` to the parent and closes. The parent decides
what "save" means: `ZonesTable` wraps the existing server action in `startTransition` (a real,
immediate write); `ZoneWizard` just fills in the create-form's local state, since a new zone's
centroid is submitted together with everything else when the form itself is submitted.

**37C. Leaflet's default marker icons are pointed at unpkg's CDN, not bundled paths.** Leaflet's
default icon URLs are relative paths that resolve incorrectly under Next.js's bundler — a well-known
class of issue for this library, not specific to this app — worked around by pointing
`L.Icon.Default` at the same CDN the `leaflet` package itself publishes its release assets to, rather
than fighting webpack's asset resolution.

**Acceptance:** `tsc --noEmit` clean; confirmed the `leaflet` package is actually bundled into both
the server module graph and the client-side chunk (not just installed and unused); `/zones`
(authenticated) renders the "Set centroid"/"Edit" triggers correctly against live zone data.
Interactive behavior itself (drag/click/geolocation prompt) needs a real browser to exercise, which
this environment doesn't have — flagged rather than assumed working from static checks alone.

---

## 38. ONBOARDING FALLBACK: "MY AREA ISN'T LISTED" — GEOCODE, THEN FIND-OR-CREATE THE REAL REGION (2026-07-25)

The pilot's zone tree only ever covered Melukote — testing on a real device immediately surfaced
that a member from anywhere else has exactly one complete path to pick (Melukote → Melukote Hobli →
Kikkeri → Kikkeri Village) and nothing else. Two things got fixed: the immediate blocker (a member
outside the pilot area couldn't finish onboarding at all), and a stray "Mapusa" constituency
(a real Goa town, unrelated to this Mandya pilot, with nothing built under it) confirmed unreferenced
and deleted.

**38A. "Detect my location" or "enter my address" — either way, geocoded to a real place, not just
matched to whatever's nearest.** `ZonePickerScreen` gained an "My area isn't listed →" link opening a
flow with both options: a live GPS fix (`getCurrentPositionAsync`, a real fetch worth the few seconds
since this is a one-time onboarding moment — unlike §35's per-answer capture, which deliberately only
uses a cached reading) or a free-text address, forward-geocoded instead. Whichever path is used, the
result is shown to the member for explicit confirmation ("Is this right?") before it's ever used —
especially important for the typed-address path, where a mistyped address could resolve to the wrong
place entirely.

**38B. Geocoding: OpenStreetMap's Nominatim, not Google — same "avoid the bureaucracy" reasoning as
ruling out Bhashini for voice (§9) and Google Maps for §37's zone-centroid picker.** Free, no API
key/billing setup. Real, stated tradeoff: OSM's rural-India coverage is thinner than Google's — live-
tested directly against the actual pilot area (reverse-geocoding real coordinates near Kikkeri
correctly resolved to "Guduganahalli," a genuine neighboring village), so it's adequate here, but this
is a one-file provider swap (`geocoding.provider.ts`, same seam as `GeminiVisionProvider`/
`GeminiAsrProvider`) if that ever stops being true.

**38C. A real bug, caught by the user during live testing, not by code review: the first version of
this parented every newly-created village under whatever existing constituency happened to be
nearest — with no distance cap.** With only Melukote in the system, that meant a village reverse-
geocoded from a phone actually in Goa got filed under a Karnataka constituency 500km away. Since this
platform's entire point is aggregating demand *by real geographic area* for logistics, a wrong parent
silently corrupts exactly the rollups that matter — not a cosmetic bug. Fixed by changing what "find
the right structure" means entirely: **`ZoneGeocodingService` now finds-or-creates the region
(constituency-level) zone BY NAME first** — using the geocoder's own district/taluk-equivalent field
(`regionName()` in `geocoding.provider.ts`; OSM doesn't carry India's actual Assembly Constituency
layer, so this is an honest proxy using a real administrative name, not a fabricated one) — and only
THEN finds-or-creates the village SCOPED INSIDE that specific region. Distance is no longer part of
the decision at all. This also fixed a second, related latent bug: village-name matching used to be
global (`WHERE level='village' AND name=...` with no region scope), so two real, differently-located
villages that happen to share a name would have collided into one; now correctly scoped per-region.

**38D. Both members and zones carry an honest "not verified" flag, at the layer where verification
actually applies.** `members.zone_confirmed` (false only for the old nearest-guess path, which no
longer exists post-38C — the current flow always gets an explicit member confirmation, so this is
now effectively always true via the fallback) plus `members.requested_area_note` (free text, for a
path that still wants one). `zones.needs_hierarchy_review` is the one that matters most today: every
region or village created via this flow is flagged, since its centroid is just the first reading that
created it and its placement in a bigger real hierarchy (state, above constituency — a level this
schema doesn't model yet) is a guess ops should review, not a verified boundary.

**Acceptance:** live-tested end to end on a real device, twice — once surfacing the §38C bug (a real
Arpora, Goa reading filed under Melukote), once confirming the fix (same coordinates now correctly
create/match a "North Goa" region, with Arpora correctly nested under it, not Melukote). The member
and fund-project data created during that first (buggy) test were repaired in place — rows
reassigned to the corrected hierarchy — rather than deleted, since a real `fund_projects` row already
referenced the original zone. `onboarding-fallback.integration.spec.ts` (9 tests, using a
`FakeGeocodingProvider` override — same seam as `SnapsService.recognitionOverride` — to avoid live
Nominatim calls in CI) covers: region matched by name regardless of proximity, region+village created
together when neither exists, same-named villages in different regions not colliding, missing
place/region name both 400, address-based resolution, and `zoneConfirmed`/`requestedAreaNote`
persistence. `pnpm build` clean on `apps/api`, `tsc --noEmit` clean on `apps/mobile`.

## 39. QUESTIONS IN THREE LANGUAGES: ENGLISH (ALWAYS), HINDI (ALWAYS), THE MEMBER'S LOCAL LANGUAGE (2026-07-25)

The question text schema hardcoded a single `questions.text_kn` column — fine while every pilot
member was in Karnataka, wrong the moment §38's onboarding fallback let a member from anywhere in
India actually join: their "local language" isn't necessarily Kannada. Fixed by replacing the fixed
column with a flexible per-question translations table, and deriving each zone's local language from
its real-world state, so a question always shows English, always attempts Hindi, and shows a third
line only when the member's own zone resolves to a further, distinct local language.

**39A. Schema: `question_translations` (question_id, language_code, text — composite PK) replaces the
single `text_kn` column.** Any number of languages per question, each independently optional. The
migration (`1739059200000_multilingual_questions.js`) preserved every existing Kannada translation
losslessly — verified directly via psql after running it: 15 rows correctly migrated with
`language_code = 'kn'`, `questions.text_kn` dropped, zero data loss.

**39B. `zones.language_code`, auto-derived from the geocoded state — an explicit AskUserQuestion
decision (auto-derive, recommended, over asking per-zone).** `india-languages.util.ts`'s
`STATE_LANGUAGE` map (36 states/UTs → ISO-ish language codes) is consulted whenever §38's geocoding
flow creates or matches a region/village zone; `GeocodedPlace` gained a `state` field for this,
populated only from what the geocoder actually returned, never guessed. A zone created before this
addendum existed, or created manually by an admin, has no language yet — ops sets or corrects it via
the new `PATCH /v1/admin/zones/:id/language` endpoint, surfaced in the portal as a language picker on
both the zones table (per-row, fires immediately on change) and the new-zone wizard.

**39C. Resolution walks the member's zone ancestor chain, same recursive-CTE shape as §23's
region-scoping query, taking the first non-null `language_code` found.** Necessary because a
geocoded zone (§38) gets its language set on both the village and its region, but a manually-created
zone typically only has it set on the region — a plain lookup on the member's own zone would miss the
latter case.

**39D. Missing translation falls back to showing English only for that slot — never blocks question
creation or delivery (the other explicit AskUserQuestion decision this addendum needed).** When the
member's resolved local language IS Hindi, `textLocal`/`localLanguage` are omitted entirely (not just
duplicated) rather than showing the same Hindi translation twice under two different labels.

**39E. Portal (`QuestionWizard.tsx`): the old single "Translate to Kannada →" button is now two
independent ones — Hindi (always available) and a dynamic local-language button that only appears
once a target zone with a known language is selected**, each still Gemini-backed drafts the admin
reviews/edits before saving, same non-system-of-record posture as §27. `TranslationService` itself
needed no new logic, just generalizing from a single hardcoded `{ kn: "Kannada" }` map to the shared
15-language `LANGUAGE_NAMES` table.

**39F. Deliberately out of scope: the LLM-driven document-grounded question generator
(`document-grounded-generator.service.ts`, topics' `translateToKannada`) stays Kannada-only.** That
generator config predates this addendum and wasn't asked about — extending it to auto-generate in
whatever language a topic's target zone resolves to is a real follow-up, not silently bundled in here.

**Acceptance:** migration run and verified directly via psql (translations migrated, zero loss; real
pilot zones correctly auto-tagged `kn`); `pnpm build` clean on `packages/shared`, `apps/api`,
`apps/portal`; `tsc --noEmit` clean on `apps/mobile`. New tests: `language-resolution.integration.spec.ts`
(4 cases — full translation, partial/English-fallback, Hindi-zone dedup, no-language-set zone) plus a
new translations-persistence case in `create-question.integration.spec.ts`; full existing suite (112
tests, 25 suites) still green.

## 40. ISSUED VS. REALISED TOKENS — THE RESERVE (2026-07-25)

Two related gaps closed together: (1) the ledger already distinguished earned vs. redeemed tokens,
but nothing distinguished "redeemed" from "backed by an actual completed sale" — a real distinction
per LAW 2 ("tokens convert to value only at a verified, self-declared purchase"), just never made
visible or ledgered as its own thing; (2) the pitch deck's 50/20/30 split (tokens/fund/operations, §17)
only ever had the fund's 20% slice built — the 50% tokens-backing slice didn't exist as a ledger at
all. Both close with the same mechanism: a new **reserve**, credited at the same event that already
triggers Fund accrual.

**40A. A token is "issued" (hollow ◇) from the moment it's earned until it's spent, and
"realised" (filled ◆) only once the specific offer it was redeemed against reaches DELIVERED — never
at redemption itself.** A member can redeem tokens joining an offer (`offers.service.ts`'s `join()`)
before the goods actually arrive; nothing about that moment proves a completed sale. Confirmed
delivery (`FundService.confirmDelivery()`, already SPEC.md §17A's fund-accrual trigger) is the
verification event LAW 2 refers to — the same call now realises the tokens redeemed on that
participation, atomically alongside the fund accrual it already does.

**40B. The reserve amount is 1:1 against the realised tokens, not a percentage of savings like the
fund's 20%.** `tokens_redeemed × offer_token_terms.token_value_paise` — the rate actually locked in
for that specific offer, never the fluctuating current `token_rate` (a different offer's redemption
could have happened at a different published rate entirely). New table `reserve_ledger` (migration
`1739145600000_reserve_ledger.js`) gets the full §15/§17C treatment: append-only via a
`reject_reserve_ledger_mutation` trigger rejecting UPDATE/DELETE from any role, idempotent via
`UNIQUE(ref_type, ref_id)` keyed to the same `offer_participation` row the fund accrual uses. Global,
not per-zone — tokens themselves aren't zone-partitioned (`members.token_balance` isn't either), so
neither is what backs them. `ReserveService` (new module) owns `creditReserve()`/`getTotal()`;
`FundService.confirmDelivery()` calls it inside the same transaction and now returns `reservedPaise`
alongside `accruedPaise`.

**40C. All three design questions were asked, not assumed, since guessing wrong on real-money
mechanics is expensive to unwind:** realise-at-delivery vs. realise-at-redemption (chose delivery);
1:1 token value vs. a savings-percentage split (chose 1:1); a new ledger vs. just better-surfacing the
existing Fund (chose new — the reserve backs token liability, the Fund funds community projects; same
trigger event, different purpose, both need to exist).

**40D. A genuinely stale stub got fixed in passing, not expanded in scope: `token_rate`'s
`realisedSalesVelocity` factor (§6C) had been hardcoded to 0** with a comment saying it honestly
couldn't be computed until Phase 4 (offers + verified purchases) existed. Phase 4 shipped since that
comment was written and it was never revisited. Now computed for real — the fraction of intents
declared in the last 30 days whose `fulfilled_offer_id` points at an offer_participation that reached
`delivered` — the same "verified purchase" bar §40A uses. `supplierCompetition` stays at 0 deliberately:
it needs a competing-bids mechanic that genuinely doesn't exist yet (an offer today has exactly one
`collective_price_paise`, not multiple suppliers bidding), so 0 remains the honest current value there.

**40E. Surfaced in three places.** Member-facing `GET /v1/tokens` gains `realisedTokens` (this
member's own delivered-redemption total) alongside the existing `balance`; `HomeScreen.tsx`'s balance
card now shows both, hollow ◇ for issued and dimmed filled ◆ for realised, so the distinction the
member sees matches the one the ledger enforces. Ops-facing: a new `GET
/v1/admin/token-economy/overview` (new `AdminOverviewModule`, no new business logic — it only reports
what LedgerService/ReserveService/TokenRateService already recorded) returns total members,
issued tokens, realised tokens, reserved paise, and the current published rate; the portal's home
page (`page.tsx`, the actual "main company page") gained a "Token economics" section showing all five,
fetched via Core API like every other member-adjacent portal read (§10's boundary — none of
members/token_ledger/reserve_ledger are in the portal role's direct-read grant).

**Acceptance:** migration run and verified via psql (table, both triggers, unique constraint all
present); `pnpm build` clean on `apps/api` and `apps/portal`; `tsc --noEmit` clean on `apps/mobile`.
New tests: `reserve.integration.spec.ts` (3 cases — reserves only at delivery not redemption, zero
reserve when no tokens redeemed, append-only enforcement), `admin-overview.integration.spec.ts` (2
cases — full earn→redeem→deliver delta tracking, token-rate field presence), `tokens.integration.spec.ts`
(1 case — balance drops at redemption, realisedTokens only appears at delivery). Full suite: 118
tests, 28 suites, all green. Live-verified `GET /v1/admin/token-economy/overview` against the running
dev API after restarting it with the new build — real data (1597 members, 61126 issued tokens,
current rate ₹0.50) returned in the exact shape the portal page consumes. The portal page itself was
not click-tested in a browser — its session cookie is gated by a `PORTAL_SESSION_SECRET` set directly
in the shell environment, not in any file this session had access to; confirmed instead that the live
API response matches the TypeScript shape the page code reads, and that `next build` type-checks the
render logic cleanly.
