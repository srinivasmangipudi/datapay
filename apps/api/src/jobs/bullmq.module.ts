import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => {
        const url = process.env.REDIS_URL;
        if (!url) throw new Error("Missing REDIS_URL");
        // Local dev's Redis has no password, so `new URL(url)`'s
        // username/password were silently empty and never noticed —
        // Railway's managed Redis requires auth, so a real deploy hard-fails
        // with NOAUTH until both are actually threaded through.
        const { hostname, port, username, password } = new URL(url);
        return {
          connection: {
            host: hostname,
            port: Number(port),
            username: username || undefined,
            password: password || undefined,
          },
        };
      },
    }),
  ],
  exports: [BullModule],
})
export class JobsModule {}
