import React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatUnitLabel } from "../../domain/unitLabels.js";

export function PlanningCapitalReservePanel({
  reserveSummary,
  assumptions,
  nearTermTargets,
  nearTermCost,
  nearTermReserveTarget,
  capitalMonthlyTarget,
  reserveGap,
  mustFundWarnings,
  currency,
}) {
  return (
    <div className="self-start rounded-xl border border-slate-200 bg-white p-3 shadow-none">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-900">Reserve planning</div>
          <div className="mt-1 text-xs text-slate-500">Liquidity cushion and capital project reserve readiness.</div>
        </div>
        <Badge variant="secondary">{assumptions.horizonMonths} mo</Badge>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Monthly carry cost</div>
          <div className="mt-1 text-base font-semibold text-slate-900">{currency(reserveSummary.monthlyCarryCost)}</div>
          <div className="mt-1 text-xs text-slate-500">Reserve cushion math: trailing OpEx plus adjusted debt service.</div>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3">
          <div className="text-xs uppercase tracking-wide text-blue-700">6-mo cushion target</div>
          <div className="mt-1 text-base font-semibold text-blue-900">{currency(reserveSummary.sixMonthCushionTarget)}</div>
          <div className="mt-1 text-xs text-blue-900/80">A simple liquidity benchmark for vacancies, repairs, and uneven months.</div>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
          <div className="text-xs uppercase tracking-wide text-emerald-700">First-year reserve funding</div>
          <div className="mt-1 text-base font-semibold text-emerald-900">{currency(reserveSummary.firstYearReserveContribution)}</div>
          <div className="mt-1 text-xs text-emerald-900/80">Coverage {reserveSummary.firstYearCoverageMonths.toFixed(1)} months of current carry cost.</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Horizon reserve funding</div>
          <div className="mt-1 text-base font-semibold text-slate-900">{currency(reserveSummary.horizonReserveContribution)}</div>
          <div className="mt-1 text-xs text-slate-500">At {currency(Number(assumptions.monthlyCapexReserve || 0))} per month.</div>
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Next 12-mo projects</div>
          <div className="mt-1 text-base font-semibold text-slate-900">{nearTermTargets.length}</div>
          <div className="mt-1 text-xs text-slate-500">Targets due within the next year.</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">12-mo capital cost</div>
          <div className="mt-1 text-base font-semibold text-slate-900">{currency(nearTermCost)}</div>
          <div className="mt-1 text-xs text-slate-500">Estimated spend for near-term tracked projects.</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">12-mo project reserve</div>
          <div className="mt-1 text-base font-semibold text-slate-900">{currency(nearTermReserveTarget)}</div>
          <div className="mt-1 text-xs text-slate-500">Monthly reserve pressure from near-term items only.</div>
        </div>
      </div>
      <div className={`mt-3 rounded-lg border p-3 ${reserveGap <= 0 ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/70"}`}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className={`text-sm font-semibold ${reserveGap <= 0 ? "text-emerald-900" : "text-amber-900"}`}>Capital project reserve gap</div>
            <div className={`mt-1 text-xs ${reserveGap <= 0 ? "text-emerald-900/80" : "text-amber-900/80"}`}>
              Suggested monthly project reserve from tracked assets and manual projects is {currency(capitalMonthlyTarget)}.
            </div>
          </div>
          <div className={`text-base font-semibold ${reserveGap <= 0 ? "text-emerald-900" : "text-amber-900"}`}>
            {reserveGap <= 0 ? currency(Math.abs(reserveGap)) + " ahead" : currency(reserveGap) + " short / mo"}
          </div>
        </div>
      </div>
      {mustFundWarnings.length > 0 ? (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50/70 p-3">
          <div className="text-sm font-semibold text-rose-900">Must-fund warnings</div>
          <div className="mt-2 space-y-2">
            {mustFundWarnings.slice(0, 4).map((warning) => (
              <div key={`planning-fund-warning-${warning.assetId}-${warning.mustFundBy}`} className="text-xs text-rose-900/90">
                {warning.description} needs funding by {warning.mustFundBy} for {currency(warning.estimatedReplacementCost)}.
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PlanningCapitalTargetsPanel({
  targets,
  excludedBuildingAssetCount,
  nextTarget,
  targetSections,
  onAddAction,
  onCreateProject,
  onEditProject,
  currency,
}) {
  return (
    <div className="self-start rounded-xl border border-slate-200 bg-white p-3 shadow-none">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-900">Capital targets</div>
          <div className="mt-1 text-xs text-slate-500">Asset and manual project reserve targets.</div>
        </div>
        <Badge variant="secondary">{targets.length} tracked</Badge>
      </div>
      {excludedBuildingAssetCount > 0 ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 p-2 text-xs text-slate-600">
          {excludedBuildingAssetCount} residential building asset{excludedBuildingAssetCount === 1 ? "" : "s"} excluded from reserve math. Use manual capital projects for roof, exterior, HVAC, windows, or other real replacement plans.
        </div>
      ) : null}
      {nextTarget ? (
        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/70 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-blue-900">Next capital pressure point</div>
              <div className="mt-1 text-xs text-blue-900/80">
                {nextTarget.description} for {nextTarget.propertyName} is the next tracked capital target.
              </div>
            </div>
            <Badge variant={nextTarget.urgency === "near_term" ? "destructive" : nextTarget.urgency === "watchlist" ? "secondary" : "outline"}>
              {nextTarget.urgency === "near_term" ? "Near term" : nextTarget.urgency === "watchlist" ? "Watchlist" : "Long range"}
            </Badge>
          </div>
          <div className="mt-2 grid gap-2 text-xs text-blue-900/80 md:grid-cols-3">
            <div>Target date <span className="font-medium text-blue-950">{nextTarget.targetDate}</span></div>
            <div>Est. cost <span className="font-medium text-blue-950">{currency(nextTarget.estimatedReplacementCost)}</span></div>
            <div>Reserve / mo <span className="font-medium text-blue-950">{currency(nextTarget.monthlyReserveTarget)}</span></div>
          </div>
        </div>
      ) : null}
      <div className="mt-3 space-y-3">
        {targets.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2 text-xs text-slate-500">
            No capital targets yet. Add assets with placed-in-service dates, or create a manual project, to turn this into a reserve roadmap.
          </div>
        ) : (
          targetSections.map((section) => (
            section.items.length > 0 ? (
              <div key={`planning-capital-section-${section.urgency}`} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-900">{section.label}</div>
                  <Badge variant={section.urgency === "near_term" ? "destructive" : section.urgency === "watchlist" ? "secondary" : "outline"}>
                    {section.items.length} item{section.items.length === 1 ? "" : "s"}
                  </Badge>
                </div>
                {section.items.map((target) => (
                  <div key={`planning-capital-target-${target.source}-${target.assetId}`} className="rounded-lg border border-slate-200 bg-slate-50/80 p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium text-slate-900">{target.description}</div>
                        <div className="mt-1 text-xs text-slate-500">{target.propertyName} | {formatUnitLabel(target.unit)} | {target.source === "manual" ? "Manual project" : target.assetType}</div>
                      </div>
                      <Badge variant={target.urgency === "near_term" ? "destructive" : target.urgency === "watchlist" ? "secondary" : "outline"}>
                        {target.urgency === "near_term" ? "Near term" : target.urgency === "watchlist" ? "Watchlist" : "Long range"}
                      </Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <div>Target date: <span className="font-medium text-slate-900">{target.targetDate}</span></div>
                      <div>Years left: <span className="font-medium text-slate-900">{target.yearsRemaining.toFixed(1)}</span></div>
                      <div>Est. cost: <span className="font-medium text-slate-900">{currency(target.estimatedReplacementCost)}</span></div>
                      <div>Monthly reserve: <span className="font-medium text-slate-900">{currency(target.monthlyReserveTarget)}</span></div>
                    </div>
                    {target.mustFundBy ? <div className="mt-2 text-xs text-slate-500">Must fund by {target.mustFundBy} | {target.fundingSource || "tbd"} | {target.scheduleType === "phased" ? "Phased" : "One-time"}</div> : null}
                    {target.notes ? <div className="mt-2 text-xs text-slate-500">{target.notes}</div> : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => onAddAction(target)}>Add action</Button>
                      {target.source === "manual" ? (
                        <Button size="sm" variant="outline" onClick={() => onEditProject(target)}>Edit project</Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => onCreateProject(target)}>Create project</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : null
          ))
        )}
      </div>
    </div>
  );
}

export function PlanningManualCapitalProjectsPanel({
  projects,
  projectPropertyId,
  projectDraft,
  projectUnitOptions,
  projectLinkedAssetOptions,
  properties,
  propertyFilter,
  renderField,
  formatPropertyLabel,
  onProjectDraftChange,
  onSaveProject,
  onResetProjectDraft,
  onAddProjectAction,
  onEditProject,
  onDeleteProject,
  currency,
}) {
  const visibleProjects = projects.filter((project) => propertyFilter === "all" || project.propertyId === propertyFilter);

  return (
    <div className="self-start rounded-xl border border-slate-200 bg-white p-3 shadow-none">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-900">Manual capital projects</div>
          <div className="mt-1 text-xs text-slate-500">Manual projects with due dates and notes.</div>
        </div>
        <Badge variant="secondary">{projects.length} saved</Badge>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {renderField(
          "Property",
          <Select value={projectPropertyId || "__none__"} onValueChange={(value) => onProjectDraftChange((prev) => ({ ...prev, propertyId: value === "__none__" ? "" : value, unit: "Shared", linkedAssetId: "" }))}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Select property" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Select property</SelectItem>
              {properties.map((property) => <SelectItem key={`planning-project-property-${property.id}`} value={property.id}>{property.name}</SelectItem>)}
            </SelectContent>
          </Select>,
        )}
        {renderField(
          "Unit",
          <Select value={projectDraft.unit || "Shared"} onValueChange={(value) => onProjectDraftChange((prev) => ({ ...prev, propertyId: projectPropertyId, unit: value }))}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {projectUnitOptions.map((unitName) => <SelectItem key={`planning-project-unit-${unitName}`} value={unitName}>{unitName}</SelectItem>)}
            </SelectContent>
          </Select>,
        )}
        {renderField("Project", <Input className="mt-1" value={projectDraft.title} onChange={(e) => onProjectDraftChange((prev) => ({ ...prev, propertyId: projectPropertyId, title: e.target.value }))} />)}
        {renderField("Target date", <Input className="mt-1" type="date" value={projectDraft.targetDate} onChange={(e) => onProjectDraftChange((prev) => ({ ...prev, propertyId: projectPropertyId, targetDate: e.target.value }))} />)}
        {renderField("Estimated cost", <Input className="mt-1" type="number" step="0.01" value={projectDraft.estimatedCost} onChange={(e) => onProjectDraftChange((prev) => ({ ...prev, propertyId: projectPropertyId, estimatedCost: e.target.value }))} />)}
        {renderField("Must fund by", <Input className="mt-1" type="date" value={projectDraft.mustFundBy} onChange={(e) => onProjectDraftChange((prev) => ({ ...prev, propertyId: projectPropertyId, mustFundBy: e.target.value }))} />)}
        {renderField(
          "Priority",
          <Select value={projectDraft.priority} onValueChange={(value) => onProjectDraftChange((prev) => ({ ...prev, propertyId: projectPropertyId, priority: value }))}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>,
        )}
        {renderField(
          "Funding source",
          <Select value={projectDraft.fundingSource} onValueChange={(value) => onProjectDraftChange((prev) => ({ ...prev, propertyId: projectPropertyId, fundingSource: value }))}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="reserve">Reserve</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="financing">Financing</SelectItem>
              <SelectItem value="heloc">HELOC</SelectItem>
              <SelectItem value="tbd">TBD</SelectItem>
            </SelectContent>
          </Select>,
        )}
        {renderField(
          "Schedule type",
          <Select value={projectDraft.scheduleType} onValueChange={(value) => onProjectDraftChange((prev) => ({ ...prev, propertyId: projectPropertyId, scheduleType: value }))}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="one_time">One-time</SelectItem>
              <SelectItem value="phased">Phased</SelectItem>
            </SelectContent>
          </Select>,
        )}
        {renderField(
          "Linked asset",
          <Select value={projectDraft.linkedAssetId || "__none__"} onValueChange={(value) => onProjectDraftChange((prev) => ({ ...prev, propertyId: projectPropertyId, linkedAssetId: value === "__none__" ? "" : value }))}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No linked asset</SelectItem>
              {projectLinkedAssetOptions.map((asset) => <SelectItem key={`planning-project-asset-${asset.id}`} value={asset.id}>{asset.description}</SelectItem>)}
            </SelectContent>
          </Select>,
        )}
      </div>
      <div className="mt-2">
        <Label className="text-xs text-slate-600">Notes</Label>
        <textarea className="mt-1 h-20 w-full rounded-md border border-slate-200 p-2 text-sm" value={projectDraft.notes} onChange={(e) => onProjectDraftChange((prev) => ({ ...prev, propertyId: projectPropertyId, notes: e.target.value }))} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={onSaveProject}>{projectDraft.id ? "Update project" : "Add project"}</Button>
        <Button size="sm" variant="ghost" onClick={onResetProjectDraft}>Reset</Button>
      </div>
      <div className="mt-3 space-y-2">
        {projects.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2 text-xs text-slate-500">No manual capital projects yet. Add a dated project when a replacement, repair, or improvement needs reserve planning outside the asset schedule.</div>
        ) : (
          visibleProjects.map((project) => (
            <div key={`planning-manual-project-${project.id}`} className="rounded-lg border border-slate-200 bg-slate-50/80 p-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-slate-900">{project.title}</div>
                  <div className="mt-1 text-xs text-slate-500">{formatPropertyLabel(project.propertyId)} | {formatUnitLabel(project.unit)} | {project.targetDate} | {currency(Number(project.estimatedCost || 0))}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => onAddProjectAction(project)}>Add action</Button>
                  <Button size="sm" variant="secondary" onClick={() => onEditProject(project)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => onDeleteProject(project)}>Delete</Button>
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-500">{project.priority || "medium"} priority | {project.fundingSource || "tbd"} | {project.scheduleType === "phased" ? "Phased" : "One-time"}{project.mustFundBy ? ` | Must fund by ${project.mustFundBy}` : ""}</div>
              {project.notes ? <div className="mt-2 text-xs text-slate-500">{project.notes}</div> : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
