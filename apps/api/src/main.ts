import "reflect-metadata";
import { config } from "dotenv";
import { resolve } from "path";

// Only test-setup.ts loaded infra/.env before now — `nest start` outside
// Jest had nothing populating CORE_DATABASE_URL etc. and crashed on boot.
config({ path: resolve(__dirname, "../../../infra/.env") });

import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.API_PORT ?? 3000);
}
bootstrap();
