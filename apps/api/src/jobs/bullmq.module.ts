import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => {
        const url = process.env.REDIS_URL;
        if (!url) throw new Error("Missing REDIS_URL");
        const { hostname, port } = new URL(url);
        return { connection: { host: hostname, port: Number(port) } };
      },
    }),
  ],
  exports: [BullModule],
})
export class JobsModule {}
