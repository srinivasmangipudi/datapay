import { randomUUID } from "crypto";

export interface UpiPayoutResult {
  ok: boolean;
  reference: string;
}

export interface UpiProvider {
  payout(upiId: string, amountPaise: number): Promise<UpiPayoutResult>;
}

// NOT a real payment. There is no bank/NPCI integration behind this — it
// always "succeeds" and returns a fabricated reference. Standing in for a
// real UPI payout gateway until one is contracted, per SPEC.md §11: the code
// must not claim a payment happened when it didn't. Same posture as
// DevNoopStorageProvider (Phase 2) and DevNoopAsrProvider (Phase 2).
export class DevSandboxUpiProvider implements UpiProvider {
  async payout(_upiId: string, _amountPaise: number): Promise<UpiPayoutResult> {
    return { ok: true, reference: `sandbox-${randomUUID()}` };
  }
}
