import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error("Missing JWT_SECRET");
        return { secret, signOptions: { expiresIn: "30d" } };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
