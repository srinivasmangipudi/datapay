import { Controller, Get, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { AuditService } from "./audit.service";

// Same deliberately-deferred-auth posture as every other admin endpoint in
// this codebase (aggregation, token-rate, produce-matching, producer-payouts,
// snap-verify) — ops-write/read auth is a later hardening pass (§19E).
@Controller("v1/admin/audit-export")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  async export(@Query("since") since: string | undefined, @Res() res: Response) {
    const sinceDate = since ? new Date(since) : new Date(0);
    const csv = await this.audit.exportCsv(sinceDate);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="datapay-ledger-export.csv"`);
    res.send(csv);
  }
}
