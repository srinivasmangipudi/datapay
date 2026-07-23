const { config } = require("dotenv");
const { resolve } = require("path");

// Next.js only auto-loads .env/.env.local from THIS app's own directory — it
// has no notion of the shared infra/.env every other service reads from. This
// runs before Next boots, so CORE_PORTAL_DATABASE_URL is populated the same
// way api/vault's main.ts populates theirs.
config({ path: resolve(__dirname, "../../infra/.env") });

/** @type {import('next').NextConfig} */
const nextConfig = {};

module.exports = nextConfig;
