import type { Lease } from "../models.ts";
import { leaseIsOpenEnded } from "./leaseTerms.js";

export function leaseIsActiveByDate(lease: Pick<Lease, "startDate" | "actualEndDate" | "endDate" | "agreementType" | "monthToMonthAfterTerm">, dateStr: string) {
  if (!dateStr) return false;
  if (lease.startDate > dateStr) return false;
  if (lease.actualEndDate) return lease.actualEndDate >= dateStr;
  if (leaseIsOpenEnded(lease)) return true;
  return lease.endDate >= dateStr;
}
