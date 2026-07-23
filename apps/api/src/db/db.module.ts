import { Global, Module } from "@nestjs/common";
import { Pool } from "pg";

export const PG_POOL = "PG_POOL";

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: () => {
        const connectionString = process.env.CORE_DATABASE_URL;
        if (!connectionString) {
          throw new Error("Missing CORE_DATABASE_URL");
        }
        return new Pool({ connectionString });
      },
    },
  ],
  exports: [PG_POOL],
})
export class DbModule {}
