import "reflect-metadata";
import { config } from "dotenv";
import { resolve } from "path";

// Only test-setup.ts loaded infra/.env before now — `nest start` outside
// Jest had nothing populating VAULT_DATABASE_URL/ALIAS_PEPPER/etc. and
// crashed on boot.
config({ path: resolve(__dirname, "../../../infra/.env") });

import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.VAULT_PORT ?? 3001);
}
bootstrap();
