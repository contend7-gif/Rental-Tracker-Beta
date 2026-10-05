import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function PlanningHorizonControl({ assumptions, onAssumptionsChange }) {
  return <div className="flex items-center gap-2 text-xs text-slate-500">
    <span>Horizon</span>
    <Select aria-label="Planning horizon" value={assumptions.horizonMonths} onValueChange={(value) => onAssumptionsChange((prev) => ({ ...prev, horizonMonths: value }))}>
      <SelectTrigger className="h-9 w-[120px] border-slate-200 bg-white text-sm"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="12">12 months</SelectItem>
        <SelectItem value="24">24 months</SelectItem>
        <SelectItem value="36">36 months</SelectItem>
      </SelectContent>
    </Select>
  </div>;
}

export function PlanningView({ children }) {
  return (
    <Card className="overflow-hidden shadow-none">
      <CardContent className="space-y-4 !p-4">
        {children}
      </CardContent>
    </Card>
  );
}
