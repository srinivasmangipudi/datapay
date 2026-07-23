import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthProxyController } from "./auth-proxy.controller";
import { AliasAuthGuard } from "./alias-auth.guard";

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error("Missing JWT_SECRET");
        return { secret };
      },
    }),
  ],
  controllers: [AuthProxyController],
  providers: [AliasAuthGuard],
  exports: [AliasAuthGuard, JwtModule],
})
export class AuthModule {}
