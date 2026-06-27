import React from "react";
import { Badge } from "../../components/ui/badge";
import { auditBadgeClass, normalizeAuditStatus } from "./auditBadges.js";

export function AuditReadinessBadge({ status, label, className = "" }) {
  const normalized = normalizeAuditStatus(status);
  return (
    <Badge variant="secondary" className={`${auditBadgeClass(normalized)} ${className}`}>
      {label || normalized.label}
    </Badge>
  );
}
