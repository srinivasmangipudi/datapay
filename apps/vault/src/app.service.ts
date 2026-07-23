import { Injectable } from "@nestjs/common";
import { K_ANON_FLOOR } from "@datapay/shared";

@Injectable()
export class AppService {
  getHealth() {
    return { status: "ok", service: "vault", kAnonFloor: K_ANON_FLOOR };
  }
}
