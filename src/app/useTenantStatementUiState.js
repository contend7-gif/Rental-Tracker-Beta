import { useState } from "react";

export function useTenantStatementUiState() {
  const [tenantStatementPreset, setTenantStatementPreset] = useState("all");
  const [tenantStatementCustomStart, setTenantStatementCustomStart] = useState("");
  const [tenantStatementCustomEnd, setTenantStatementCustomEnd] = useState("");

  return {
    tenantStatementCustomEnd,
    tenantStatementCustomStart,
    tenantStatementPreset,
    setTenantStatementCustomEnd,
    setTenantStatementCustomStart,
    setTenantStatementPreset,
  };
}
