import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatUnitLabel } from "../../domain/unitLabels.js";

export function PlanningScenarioEventTimeline({ visual, horizonMonths, buildChartPointX }) {
  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-900">Scenario event timeline</div>
          <div className="mt-1 text-xs text-slate-500">Events, lease milestones, and capital timing.</div>
        </div>
        <Badge variant="outline">{visual.items.length} markers</Badge>
      </div>
      {visual.months.length === 0 ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-500">Timeline opens once the planning projection has monthly rows.</div>
      ) : (
        <>
          <div className="mt-3 overflow-x-auto">
            <svg viewBox="0 0 320 124" className="h-36 min-w-[320px] w-full">
              {visual.lanes.map((lane) => (
                <g key={`planning-timeline-lane-${lane.label}`}>
                  <line x1="14" x2="306" y1={lane.y} y2={lane.y} stroke="#e2e8f0" strokeWidth="1" />
                  <text x="14" y={lane.y - 8} fontSize="10" fill="#64748b">{lane.label}</text>
                </g>
              ))}
              {visual.labels.map((label, index) => {
                const x = buildChartPointX(index, visual.labels.length, 320, 14);
                return (
                  <g key={`planning-timeline-label-${label}`}>
                    <line x1={x} x2={x} y1="16" y2="108" stroke="#f1f5f9" strokeWidth="1" />
                    <text x={x} y="120" fontSize="10" fill="#94a3b8" textAnchor="middle">{label}</text>
                  </g>
                );
              })}
              {visual.items.map((item) => {
                const x = 14 + ((item.xPct / 100) * 292);
                return <circle key={`planning-timeline-item-${item.id}`} cx={x} cy={item.y} r="5" fill={item.color} stroke="#ffffff" strokeWidth="2" />;
              })}
            </svg>
          </div>
          <div className="mt-3 space-y-2">
            {visual.items.map((item) => (
              <div key={`planning-timeline-row-${item.id}`} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <div className="text-sm font-medium text-slate-900">{item.title}</div>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{item.detail}</div>
                </div>
                <div className="text-xs text-slate-500">{item.date}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function PlanningScenarioTimelineEventsPanel({
  events,
  eventDraft,
  eventPropertyId,
  properties,
  eventUnitOptions,
  timelineVisual,
  horizonMonths,
  onEventDraftChange,
  onSaveEvent,
  onResetEventDraft,
  onEditEvent,
  onDeleteEvent,
  renderField,
  formatPropertyLabel,
  currency,
  buildChartPointX,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-900">Scenario timeline events</div>
          <div className="mt-1 text-xs text-slate-500">Dated future changes.</div>
        </div>
        <Badge variant="secondary">{events.length} events</Badge>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {renderField(
          "Property",
          <Select value={eventPropertyId || "__none__"} onValueChange={(value) => onEventDraftChange((prev) => ({ ...prev, propertyId: value === "__none__" ? "" : value, unit: "Shared" }))}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Select property" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Select property</SelectItem>
              {properties.map((property) => <SelectItem key={`planning-event-property-${property.id}`} value={property.id}>{property.name}</SelectItem>)}
            </SelectContent>
          </Select>,
        )}
        {renderField("Effective date", <Input className="mt-1" type="date" value={eventDraft.date} onChange={(e) => onEventDraftChange((prev) => ({ ...prev, propertyId: eventPropertyId, date: e.target.value }))} />)}
        {renderField(
          "Event type",
          <Select value={eventDraft.eventType} onValueChange={(value) => onEventDraftChange((prev) => ({ ...prev, propertyId: eventPropertyId, eventType: value }))}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unit_override">Unit occupancy / rent</SelectItem>
              <SelectItem value="reserve_change">Reserve change</SelectItem>
            </SelectContent>
          </Select>,
        )}
        {eventDraft.eventType === "unit_override"
          ? renderField(
            "Unit",
            <Select value={eventDraft.unit || "Shared"} onValueChange={(value) => onEventDraftChange((prev) => ({ ...prev, propertyId: eventPropertyId, unit: value }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {eventUnitOptions.map((unitName) => <SelectItem key={`planning-event-unit-${unitName}`} value={unitName}>{unitName}</SelectItem>)}
              </SelectContent>
            </Select>,
          )
          : renderField("New reserve / mo", <Input className="mt-1" type="number" step="0.01" value={eventDraft.monthlyCapexReserve} onChange={(e) => onEventDraftChange((prev) => ({ ...prev, monthlyCapexReserve: e.target.value }))} />)}
        {eventDraft.eventType === "unit_override" ? renderField(
          "Mode",
          <Select value={eventDraft.mode} onValueChange={(value) => onEventDraftChange((prev) => ({ ...prev, mode: value }))}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="rented">Rented</SelectItem>
              <SelectItem value="owner">Owner-Occupied</SelectItem>
              <SelectItem value="vacant">Vacant</SelectItem>
            </SelectContent>
          </Select>,
        ) : null}
        {eventDraft.eventType === "unit_override" ? renderField("Monthly rent", <Input className="mt-1" type="number" step="0.01" value={eventDraft.monthlyRent} disabled={eventDraft.mode !== "rented"} onChange={(e) => onEventDraftChange((prev) => ({ ...prev, monthlyRent: e.target.value }))} />) : null}
      </div>
      <div className="mt-2">
        <Label className="text-xs text-slate-600">Notes</Label>
        <textarea className="mt-1 h-16 w-full rounded-md border border-slate-200 p-2 text-sm" value={eventDraft.notes} onChange={(e) => onEventDraftChange((prev) => ({ ...prev, notes: e.target.value }))} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={onSaveEvent}>{eventDraft.id ? "Update event" : "Add event"}</Button>
        <Button size="sm" variant="ghost" onClick={onResetEventDraft}>Reset</Button>
      </div>
      <div className="mt-3 space-y-2">
        {events.length === 0 ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-2 text-xs text-emerald-900">No dated scenario events yet. Add one when a lease, occupancy, rent, or reserve assumption should start on a specific date.</div>
        ) : (
          events.map((event) => (
            <div key={`planning-event-${event.id}`} className="rounded-lg border border-slate-200 bg-slate-50/80 p-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-slate-900">
                    {event.eventType === "reserve_change"
                      ? `Reserve change to ${currency(Number(event.monthlyCapexReserve || 0))} / mo`
                      : `${formatPropertyLabel(event.propertyId)} | ${formatUnitLabel(event.unit)} -> ${event.mode === "rented" ? "Rented" : event.mode === "owner" ? "Owner-Occupied" : "Vacant"}${event.mode === "rented" && event.monthlyRent ? ` at ${currency(Number(event.monthlyRent || 0))}` : ""}`}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{event.date}{event.notes ? ` | ${event.notes}` : ""}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => onEditEvent(event)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => onDeleteEvent(event)}>Delete</Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <PlanningScenarioEventTimeline
        visual={timelineVisual}
        horizonMonths={horizonMonths}
        buildChartPointX={buildChartPointX}
      />
    </div>
  );
}
