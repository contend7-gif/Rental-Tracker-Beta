import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatUnitLabel } from "../../domain/unitLabels.js";

export function PlanningScenarioQuickActions({ onApplyPreset, onApplyTemplate }) {
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 shadow-none">
      <div className="grid gap-3 xl:grid-cols-[0.75fr,1.25fr]">
        <div>
          <div className="text-sm font-semibold text-slate-900">Quick scenario moves</div>
          <div className="mt-1 text-xs text-slate-500">Start with a preset, then add dated changes only where the plan truly differs.</div>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 p-2">
            <div className="w-full text-xs font-medium uppercase tracking-wide text-slate-500">Presets</div>
            <Button size="sm" variant="secondary" onClick={() => onApplyPreset("conservative")}>Conservative</Button>
            <Button size="sm" variant="secondary" onClick={() => onApplyPreset("base")}>Base</Button>
            <Button size="sm" variant="secondary" onClick={() => onApplyPreset("growth")}>Growth</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 p-2">
            <div className="w-full text-xs font-medium uppercase tracking-wide text-slate-500">Templates</div>
            <Button size="sm" variant="outline" onClick={() => onApplyTemplate("re_rent")}>Re-rent unit</Button>
            <Button size="sm" variant="outline" onClick={() => onApplyTemplate("owner_move_out")}>Owner move-out</Button>
            <Button size="sm" variant="outline" onClick={() => onApplyTemplate("start_vacancy")}>Start vacancy</Button>
            <Button size="sm" variant="outline" onClick={() => onApplyTemplate("renew_target")}>Renew at target</Button>
            <Button size="sm" variant="outline" onClick={() => onApplyTemplate("reserve_increase")}>Raise reserve</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlanningScenarioUnitOverrides({
  units,
  getUnitOverride,
  onSetUnitOverride,
  renderField,
  formatPropertyLabel,
}) {
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-900">Scenario unit overrides</div>
          <div className="mt-1 text-xs text-slate-500">Planning-only occupancy and rent overrides.</div>
        </div>
        <Badge variant="outline">{units.length} units</Badge>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {units.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2 text-xs text-slate-500">Choose a property with units to use scenario-specific overrides.</div>
        ) : (
          units.map((unit) => {
            const override = getUnitOverride(unit.propertyId, unit.name);
            return (
              <div key={`planning-override-${unit.propertyId}-${unit.name}`} className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{formatPropertyLabel(unit.propertyId)} | {formatUnitLabel(unit.name)}</div>
                    <div className="mt-1 text-xs text-slate-500">Live status {unit.status}</div>
                  </div>
                  <Badge variant={override.mode === "auto" ? "outline" : "secondary"}>{override.mode === "auto" ? "Auto" : "Override"}</Badge>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {renderField(
                    "Mode",
                    <Select value={override.mode} onValueChange={(value) => onSetUnitOverride(unit.propertyId, unit.name, { mode: value })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto</SelectItem>
                        <SelectItem value="rented">Rented</SelectItem>
                        <SelectItem value="owner">Owner-Occupied</SelectItem>
                        <SelectItem value="vacant">Vacant</SelectItem>
                      </SelectContent>
                    </Select>,
                  )}
                  {renderField(
                    "Monthly rent",
                    <Input className="mt-1" type="number" step="0.01" value={override.monthlyRent} disabled={override.mode !== "rented"} onChange={(e) => onSetUnitOverride(unit.propertyId, unit.name, { monthlyRent: e.target.value })} placeholder="1500" />,
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function PlanningScenarioAssumptions({ assumptions, onAssumptionsChange, renderField }) {
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-2">
      {renderField("Annual rent growth %", <Input className="mt-1" type="number" step="0.1" value={assumptions.annualRentGrowthPct} onChange={(e) => onAssumptionsChange((prev) => ({ ...prev, annualRentGrowthPct: e.target.value }))} />)}
      {renderField("Annual OpEx growth %", <Input className="mt-1" type="number" step="0.1" value={assumptions.annualExpenseGrowthPct} onChange={(e) => onAssumptionsChange((prev) => ({ ...prev, annualExpenseGrowthPct: e.target.value }))} />)}
      {renderField("Annual value growth %", <Input className="mt-1" type="number" step="0.1" value={assumptions.annualValueGrowthPct} onChange={(e) => onAssumptionsChange((prev) => ({ ...prev, annualValueGrowthPct: e.target.value }))} />)}
      {renderField("Vacancy / credit loss %", <Input className="mt-1" type="number" step="0.1" value={assumptions.vacancyRatePct} onChange={(e) => onAssumptionsChange((prev) => ({ ...prev, vacancyRatePct: e.target.value }))} />)}
      {renderField("Monthly CapEx reserve", <Input className="mt-1" type="number" step="0.01" value={assumptions.monthlyCapexReserve} onChange={(e) => onAssumptionsChange((prev) => ({ ...prev, monthlyCapexReserve: e.target.value }))} />)}
      {renderField("Included utilities / mo", <Input className="mt-1" type="number" min="0" step="0.01" placeholder="Auto" value={assumptions.includedUtilitiesMonthly} onChange={(e) => onAssumptionsChange((prev) => ({ ...prev, includedUtilitiesMonthly: e.target.value }))} />)}
    </div>
  );
}
