import React from "react";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";

export function ActivityWorkspace({
  activityActionFilter,
  activityActionOptions,
  activityEntityFilter,
  activityEntityOptions,
  activitySearch,
  filteredActivityLog,
  propertyFilter,
  propertyNameById,
  setActivityActionFilter,
  setActivityEntityFilter,
  setActivitySearch,
  unitFilter,
  yearFilter,
}) {
  return (
    <Card>
      <CardContent className="space-y-3 !p-3">
        <div className="rounded-lg border border-slate-200 bg-slate-100/70 p-3">
          <div className="mb-2 flex justify-end">
            <Badge variant="secondary">
              {filteredActivityLog.length} event{filteredActivityLog.length === 1 ? "" : "s"}
            </Badge>
          </div>
          <div className="grid gap-2 md:grid-cols-4">
            <Input placeholder="Search summary, details, actor..." value={activitySearch} onChange={(e) => setActivitySearch(e.target.value)} />
            <Select value={activityActionFilter} onValueChange={setActivityActionFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {activityActionOptions.map((action) => (
                  <SelectItem key={`activity-action-${action}`} value={action}>
                    {action}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={activityEntityFilter} onValueChange={setActivityEntityFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All entities</SelectItem>
                {activityEntityOptions.map((entityType) => (
                  <SelectItem key={`activity-entity-${entityType}`} value={entityType}>
                    {entityType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
              Filter scope: {yearFilter} | {propertyFilter === "all" ? "All properties" : (propertyNameById[propertyFilter] || propertyFilter)} | {unitFilter === "all" ? "All units" : unitFilter}
            </div>
          </div>
        </div>

        {filteredActivityLog.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-100/70 p-3 text-sm text-slate-600">
            No activity events match these filters.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-2 py-1 text-left">Time</th>
                  <th className="px-2 py-1 text-left">Action</th>
                  <th className="px-2 py-1 text-left">Category / Entity</th>
                  <th className="px-2 py-1 text-left">Property / Unit</th>
                  <th className="px-2 py-1 text-left">Summary</th>
                  <th className="px-2 py-1 text-left">Details</th>
                  <th className="px-2 py-1 text-left">Actor / Role</th>
                </tr>
              </thead>
              <tbody>
                {filteredActivityLog.map((entry) => {
                  const propertyLabel = entry.propertyId ? (propertyNameById[entry.propertyId] || entry.propertyId) : "-";
                  const unitLabel = entry.unit || "-";
                  const parsedAt = new Date(entry.at);
                  const timeLabel = Number.isNaN(parsedAt.getTime()) ? entry.at : parsedAt.toLocaleString();
                  return (
                    <tr key={`${entry.id}-${entry.at}`} className="border-t border-slate-100 align-top">
                      <td className="whitespace-nowrap px-2 py-1">{timeLabel}</td>
                      <td className="px-2 py-1">
                        <Badge variant="secondary">{entry.action}</Badge>
                      </td>
                      <td className="px-2 py-1">
                        <div className="font-medium text-slate-900">{entry.entityType}</div>
                        <div className="text-[11px] text-slate-500">{entry.entityId}</div>
                      </td>
                      <td className="px-2 py-1">{propertyLabel} | {unitLabel}</td>
                      <td className="px-2 py-1 text-slate-700">{entry.summary}</td>
                      <td className="px-2 py-1 text-slate-500">{entry.details || "-"}</td>
                      <td className="px-2 py-1 text-slate-500">
                        <div className="font-medium text-slate-900">{entry.actor || "local-user"}</div>
                        <div className="text-[11px] text-slate-500">{entry.actorRole || "Unspecified role"}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
