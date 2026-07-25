import "reflect-metadata";
import { config } from "dotenv";
import { resolve } from "path";

// Only test-setup.ts loaded infra/.env before now — `nest start` outside
// Jest had nothing populating CORE_DATABASE_URL etc. and crashed on boot.
config({ path: resolve(__dirname, "../../../infra/.env") });

import { NestFactory } from "@nestjs/core";
import { json, urlencoded } from "express";
import { AppModule } from "./app.module";

// Express's default body-parser limit is 100kb — fine for every other
// endpoint, but a base64-encoded camera photo (POST /v1/snaps) or voice clip
// (POST /v1/voice/transcribe) routinely runs several MB. Disable Nest's
// built-in parser and re-add it with a real limit rather than leaving every
// snap upload 413ing.
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: "15mb" }));
  app.use(urlencoded({ extended: true, limit: "15mb" }));
  await app.listen(process.env.API_PORT ?? 3000);
}
bootstrap();
