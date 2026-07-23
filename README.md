# DataPay

Demand-aggregation payments platform for a pilot in the Melukote constituency (Mandya,
Karnataka). Governing spec: [`SPEC.md`](SPEC.md) — read it first, especially §1-§11 (the
architecture and its three LAWs) and §12 (the phase-by-phase build plan; §14 onward are addenda
documenting what was actually built in each phase, versus what's still open).

## Layout

- `apps/vault` — identity plane (NestJS). Holds real PII. Never internet-facing.
- `apps/api` — data/matching plane (NestJS, "Core"). The only service the mobile app talks to.
- `apps/portal` — ops/supplier dashboard (Next.js). Reads aggregates only, via a restricted DB role.
- `apps/mobile` — member app (Expo/React Native).
- `packages/shared` — zod DTOs, k-anonymity + token-math pure functions, shared by api + vault.
- `infra/` — Docker Compose (two Postgres instances + Redis), migrations, the one shared `.env`.

## Prerequisites

- Node >= 20, pnpm 11.15.1 (`packageManager` pinned in `package.json`)
- Docker (for Postgres × 2 + Redis)
- For mobile: Expo Go on a physical device, or an iOS Simulator / Android Emulator

## First-time setup

```bash
pnpm install

cp infra/.env.example infra/.env      # dev defaults work as-is; only real deployments need real secrets
cp apps/mobile/.env.example apps/mobile/.env   # see that file for simulator/emulator/device guidance

cd infra
docker compose up -d
npm run migrate:vault:up
npm run migrate:core:up
```

`infra/.env` is the **single source of truth** for every port/credential in the stack — `apps/api`,
`apps/vault`, and `apps/portal` all load it directly at boot (via `dotenv`, pointed at
`infra/.env` from each service's own `main.ts`/`next.config.js`) rather than needing their own
copies. `apps/mobile` is the one exception: Expo only reads `.env` from its own project directory,
which is why it gets its own `apps/mobile/.env`.

## Running everything

Each of these runs in its own terminal (or background job) from the repo root:

```bash
pnpm --filter @datapay/vault start:dev     # http://localhost:3001 — identity plane, never expose this
pnpm --filter @datapay/api start:dev       # http://localhost:3000 — the one thing mobile talks to
pnpm --filter @datapay/portal dev          # http://localhost:3002 — ops dashboard
pnpm --filter @datapay/mobile start        # Expo dev server + QR code (Metro on :8081)
```

Ports are fixed per service (`VAULT_PORT`/`API_PORT` in `infra/.env`; portal is hardcoded to
`3002` in `apps/portal/package.json`, since Next has no equivalent env-var hook) — no two of them
collide.

Health checks once vault + api are up:

```bash
curl http://localhost:3001/health
curl http://localhost:3000/v1/zones   # any unauthenticated GET proves the API is actually routing
```

### "Could not connect to server" in Expo Go

`pnpm --filter @datapay/mobile start` uses LAN mode by default — Expo Go fetches the manifest and
bundle directly from your Mac's local network IP. This only works if the phone is genuinely
reachable from the Mac on that network: same Wi-Fi, and no client/AP isolation on the router
(common on guest networks, campus/office Wi-Fi, and some mesh setups by default). If it isn't, you
get exactly this error with no more specific detail.

The fix is tunnel mode, which routes through Expo's own relay instead of requiring direct LAN
reachability:

```bash
pnpm --filter @datapay/mobile start:tunnel
```

Slower to load (traffic round-trips through the tunnel), but works regardless of network
topology. `@expo/ngrok` is already a devDependency so this doesn't prompt to install anything.

### Mobile under pnpm — why `metro.config.js`/`index.js` look the way they do

Mobile is on **Expo SDK 54** (bumped from 51 to match whatever SDK the Expo Go app on your phone
requires — Expo Go only ever supports one SDK version at a time, so this drifts and will need
bumping again eventually; `npx expo install expo@<major>` + `npx expo install --fix` is the
official upgrade path, done from `apps/mobile`).

Bundling only breaks once a device/simulator actually asks Metro to build the app — the dev-server
manifest loads fine either way, so this doesn't show up just from `expo start` printing "Waiting on
http://localhost:8081". Several pnpm-specific fixes were needed, all already in place:

1. **`apps/mobile/metro.config.js`** enables symlink resolution and adds the monorepo root to
   `watchFolders`/`nodeModulesPaths` — pnpm symlinks packages in from a content-addressed store
   *outside* `apps/mobile`, and Metro doesn't watch or resolve through symlinks by default. One
   side effect: with the monorepo root as a watch folder, `@expo/cli` (SDK 54+) now serves the
   bundle at **`/apps/mobile/index.bundle`**, not `/index.bundle` — only matters if you're
   `curl`-ing it directly; the manifest a real device/Expo Go fetches already has the right path.
2. **`apps/mobile/index.js`** replaces the default `main: node_modules/expo/AppEntry.js`. That
   default file's own `import App from "../../App"` resolves against `expo`'s real (symlinked-from)
   location, not the project — landing on a path deep in the pnpm store. A project-local entry
   point sidesteps the problem entirely.
3. **`@expo/vector-icons`, `expo-asset`, `@babel/runtime`, `metro-runtime`** are explicit
   dependencies of `apps/mobile`, not left as transitive-only — pnpm doesn't hoist packages into a
   project's own resolution scope just because some *other* package (`expo`, `@expo/cli`) depends
   on them. Each surfaced one at a time as "Cannot find module X" the first time something actually
   exercised that code path.

**Tried and reverted:** `shamefully-hoist=true` in a root `.npmrc` looked like a one-shot fix for
the whole category of "missing transitive dependency" errors above, and it does fix them — but it
also flattens node_modules enough that `@expo/cli`'s project-root auto-detection breaks (it starts
resolving the entry module from the monorepo root instead of `apps/mobile`). The targeted
explicit-dependency approach is more tedious but doesn't have that side effect.

If a future `pnpm install` or Expo SDK upgrade breaks bundling again, `curl
"http://localhost:8081/apps/mobile/index.bundle?platform=ios&dev=false"` reproduces the failure
directly, without needing a device.

## What's NOT wired up yet

This is a live build following SPEC.md §12 phase-by-phase — some real gaps, tracked rather than
hidden:

- **The portal is read-only.** It has no UI for any of the admin-trigger endpoints built so far
  (question review/approval, aggregation/token-rate/produce-matching/producer-payouts runs,
  snap-verify, audit-export) — those are `curl`/Postman-only today. None of those endpoints have
  auth either (SPEC.md §19E).
- **Mobile has no Offers or Produce/Linkages screens.** The backend for both (Phase 4 and Phase 6)
  is built and tested; the member-facing UI for either isn't. Voice input is similarly unwired —
  `transcribeVoice()` exists but nothing in the UI calls it.
- **`hasFace()` (Snap's on-device face check) is a hardcoded stub** — it always returns `false`,
  so the "photos with a face are rejected" claim isn't actually true yet.
- **Mobile's Kannada UI-chrome strings (`apps/mobile/src/i18n/strings.ts`) are a first draft**, not
  reviewed by a native speaker — the same open item SPEC.md §19G already tracks for the app's
  content generally. Server-supplied bilingual content (question/option/project text) is unaffected;
  this is only the static chrome (tab labels, button text, empty states).

Home/Pulse/Snap got a visual redesign pass — shared design tokens
(`apps/mobile/src/theme.ts`), an icon tab bar, safe-area handling for notched devices, and
equal-weight bilingual labels throughout. Community/Vault still use the original inline styles;
same palette, not yet migrated to the shared theme.

## Tests

```bash
pnpm test              # every package, via pnpm -r
pnpm --filter @datapay/api test
pnpm --filter @datapay/vault test
pnpm --filter @datapay/shared test
```

Integration tests expect the Docker Postgres/Redis stack above already running — they talk to the
real databases, not mocks (see `apps/api/src/test-vault-process.ts`, which spawns a real built
Vault process for cross-service tests rather than stubbing the call).
