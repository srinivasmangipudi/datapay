import { Injectable } from "@nestjs/common";
import { computeTokenRate } from "@datapay/shared";

@Injectable()
export class AppService {
  getHealth() {
    // Demonstrates the shared token-math contract is reachable from api,
    // not just re-implemented locally.
    const sampleRatePaise = computeTokenRate({
      demandPressure: 0.5,
      realisedSalesVelocity: 0.5,
      supplierCompetition: 0.5,
    });
    return { status: "ok", service: "api", sampleRatePaise };
  }
}
