import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function PlanningView({
  assumptions,
  children,
  onAssumptionsChange,
  scopeLabel,
}) {
  return (
    <Card className="overflow-hidden shadow-none">
      <CardContent className="space-y-4 !p-4">
        <div className="flex flex-wrap items-center justify-end gap-2 rounded-lg border border-slate-200 bg-slate-50/80 p-2.5">
          <Badge variant="secondary">{scopeLabel}</Badge>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
            <span className="font-medium uppercase tracking-wide text-slate-500">Horizon</span>
            <Select value={assumptions.horizonMonths} onValueChange={(value) => onAssumptionsChange((prev) => ({ ...prev, horizonMonths: value }))}>
              <SelectTrigger className="h-8 w-[128px] border-slate-200 bg-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12">12 months</SelectItem>
                <SelectItem value="24">24 months</SelectItem>
                <SelectItem value="36">36 months</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
