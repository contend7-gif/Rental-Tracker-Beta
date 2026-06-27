import React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { PlanningReviewInbox } from "./PlanningSharedPanels.jsx";

export function PlanningActionsTab({
  actionItems,
  memoText,
  onAddActionItem,
  onDeleteActionItem,
  onOpenReviewItem,
  onRecommendationAdded,
  onUpdateActionItem,
  propertyFilter,
  recommendations,
  renderField,
  reviewItems,
}) {
  const addRecommendationToPlan = (item) => {
    onAddActionItem({
      title: item.title,
      priority: item.priority,
      notes: item.detail,
      sourceType: "recommendation",
      sourceKey: item.id ? `recommendation:${item.id}` : `recommendation:${item.title}`,
      propertyId: propertyFilter === "all" ? "" : propertyFilter,
    });
    onRecommendationAdded?.();
  };

  return (
    <>
      <PlanningReviewInbox items={reviewItems} onOpenItem={onOpenReviewItem} />

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="font-medium text-slate-900">Action plan</div>
            <div className="mt-1 text-xs text-slate-500">Tasks created from recommendations, capital projects, and review items.</div>
          </div>
          <Badge variant="outline">{actionItems.length} items</Badge>
        </div>
        <div className="mt-3 space-y-2">
          {actionItems.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-sm text-slate-500">
              No planning tasks yet. Add a task when a recommendation, project, or review item needs follow-up.
            </div>
          ) : (
            actionItems.map((item) => (
              <div key={`planning-action-${item.id}`} className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                <div className="grid gap-2 md:grid-cols-[1.3fr,0.8fr,0.8fr,0.8fr,auto]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                      <Badge variant="outline">{item.sourceType || "manual"}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{item.notes || "No notes yet."}</div>
                  </div>
                  {renderField(
                    "Status",
                    <Select value={item.status} onValueChange={(value) => onUpdateActionItem(item.id, { status: value })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="idea">Idea</SelectItem>
                        <SelectItem value="in_progress">In progress</SelectItem>
                        <SelectItem value="done">Done</SelectItem>
                      </SelectContent>
                    </Select>,
                  )}
                  {renderField(
                    "Priority",
                    <Select value={item.priority} onValueChange={(value) => onUpdateActionItem(item.id, { priority: value })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>,
                  )}
                  {renderField(
                    "Due date",
                    <Input
                      className="mt-1"
                      type="date"
                      value={item.dueDate}
                      onChange={(e) => onUpdateActionItem(item.id, { dueDate: e.target.value })}
                    />,
                  )}
                  <div className="flex items-end">
                    <Button size="sm" variant="ghost" onClick={() => onDeleteActionItem(item)}>Delete</Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="font-medium text-slate-900">Recommended actions</div>
          </div>
          <Badge variant="secondary">{recommendations.length} signals</Badge>
        </div>
        <div className="mt-3 grid gap-3 xl:grid-cols-[1fr,0.9fr]">
          <div className="space-y-2">
            {recommendations.length === 0 ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-sm text-emerald-900">
                No generated actions need attention. Accepted tasks will stay in the Action plan above.
              </div>
            ) : recommendations.map((item) => (
              <div
                key={`planning-recommendation-${item.priority}-${item.title}`}
                className={`rounded-lg border p-3 ${
                  item.priority === "high"
                    ? "border-rose-200 bg-rose-50/70"
                    : item.priority === "medium"
                      ? "border-amber-200 bg-amber-50/70"
                      : "border-slate-200 bg-slate-50/80"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                    <div className="mt-1 text-xs text-slate-600">{item.detail}</div>
                  </div>
                  <div className="ml-auto flex w-full shrink-0 justify-end gap-2 sm:w-auto">
                    <Badge variant={item.priority === "high" ? "destructive" : item.priority === "medium" ? "secondary" : "outline"}>
                      {item.priority === "high" ? "High" : item.priority === "medium" ? "Medium" : "Low"}
                    </Badge>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7"
                      onClick={() => addRecommendationToPlan(item)}
                    >
                      Add to action plan
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
            <div className="text-sm font-semibold text-slate-900">Memo snapshot</div>
            <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-700">
              {memoText}
            </pre>
          </div>
        </div>
      </div>
    </>
  );
}
