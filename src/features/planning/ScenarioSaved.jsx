import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PlanningSavedScenariosPanel({
  activeScenario,
  isDirty,
  nameDraft,
  notesDraft,
  savedScenarios,
  baselineScenarioId,
  onNameDraftChange,
  onNotesDraftChange,
  onSaveAsNew,
  onSaveBranch,
  onUpdateSelected,
  onClearSelection,
  onSetBaseline,
  onLoad,
  onClone,
  onDelete,
  formatPropertyLabel,
  formatDateTime,
  countScenarioEvents,
  currency,
}) {
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-900">Saved scenarios</div>
          <div className="mt-1 text-xs text-slate-500">Named planning versions.</div>
        </div>
        {activeScenario ? (
          <Badge variant={isDirty ? "secondary" : "outline"}>
            {isDirty ? "Unsaved changes" : "Saved"}
          </Badge>
        ) : (
          <Badge variant="outline">Scratchpad</Badge>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1">
          <Label className="text-xs text-slate-600">Scenario name</Label>
          <Input className="mt-1" value={nameDraft} onChange={(e) => onNameDraftChange(e.target.value)} placeholder="Base hold, Re-rent 614, Aggressive payoff..." />
        </div>
        <Button size="sm" variant="secondary" onClick={onSaveAsNew}>Save as new</Button>
        <Button size="sm" variant="secondary" onClick={onSaveBranch}>Save branch</Button>
        <Button size="sm" variant="secondary" onClick={onUpdateSelected} disabled={!activeScenario}>Update selected</Button>
        <Button size="sm" variant="ghost" onClick={onClearSelection}>New scratchpad</Button>
      </div>
      <div className="mt-2 text-xs text-slate-500">
        Save branch creates a new named scenario.
      </div>
      <div className="mt-3">
        <Label className="text-xs text-slate-600">Scenario notes</Label>
        <textarea
          className="mt-1 h-20 w-full rounded-md border border-slate-200 p-2 text-sm"
          value={notesDraft}
          onChange={(e) => onNotesDraftChange(e.target.value)}
          placeholder="Why this plan exists, what would trigger it, or what assumption you want to revisit later."
        />
      </div>
      <div className="mt-3 space-y-2">
        {savedScenarios.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2 text-xs text-slate-500">
            No saved planning scenarios yet. Save a branch once this working plan becomes a version you may revisit.
          </div>
        ) : (
          savedScenarios.slice(0, 6).map((scenario) => (
            <div key={`planning-saved-scenario-${scenario.id}`} className="rounded-lg border border-slate-200 bg-slate-50/80 p-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-medium text-slate-900">{scenario.name}</div>
                    {baselineScenarioId === scenario.id ? <Badge variant="outline">Baseline</Badge> : null}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{formatPropertyLabel(scenario.propertyId || "all")} | Updated {formatDateTime(scenario.updatedAt)}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => onSetBaseline(scenario.id)}>Set baseline</Button>
                  <Button size="sm" variant="secondary" onClick={() => onLoad(scenario)}>Load</Button>
                  <Button size="sm" variant="secondary" onClick={() => onClone(scenario)}>Clone</Button>
                  <Button size="sm" variant="ghost" onClick={() => onDelete(scenario)}>Delete</Button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-600">
                <span>Horizon {scenario.assumptions.horizonMonths} mo</span>
                <span>Rent growth {scenario.assumptions.annualRentGrowthPct}%</span>
                <span>Vacancy {scenario.assumptions.vacancyRatePct}%</span>
                <span>Reserve {currency(Number(scenario.assumptions.monthlyCapexReserve || 0))}</span>
                <span>{countScenarioEvents(scenario.events)} events</span>
              </div>
              {scenario.notes ? (
                <div className="mt-2 text-xs text-slate-500">{scenario.notes}</div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
