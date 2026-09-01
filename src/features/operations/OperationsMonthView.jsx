import React, { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../../components/ui/button";
import { buildCalendarMonthDays, shiftCalendarMonth } from "../../domain/operationsMonth.ts";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SOURCE_DOT = {
  rent: "bg-rose-500",
  lease: "bg-violet-500",
  maintenance: "bg-orange-500",
  document: "bg-blue-500",
  recurring: "bg-cyan-500",
  smart_check: "bg-amber-500",
  planning: "bg-purple-500",
  loan: "bg-sky-500",
};

function monthLabel(month) {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

export function OperationsMonthView({ items, month, onMonthChange, onOpen, todayIso }) {
  const days = useMemo(() => buildCalendarMonthDays(month), [month]);
  const itemsByDate = useMemo(() => {
    const grouped = new Map();
    items.forEach((item) => {
      const dayItems = grouped.get(item.date) || [];
      dayItems.push(item);
      grouped.set(item.date, dayItems);
    });
    return grouped;
  }, [items]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <div className="text-base font-semibold text-slate-900">{monthLabel(month)}</div>
          <div className="text-xs text-slate-500">Select any item to open its authoritative record.</div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" aria-label="Previous month" onClick={() => onMonthChange(shiftCalendarMonth(month, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => onMonthChange(todayIso.slice(0, 7))}>Today</Button>
          <Button size="sm" variant="outline" aria-label="Next month" onClick={() => onMonthChange(shiftCalendarMonth(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {WEEKDAYS.map((weekday) => <div key={weekday} className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">{weekday}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, index) => {
          const dayItems = itemsByDate.get(day.date) || [];
          const isToday = day.date === todayIso;
          return (
            <div key={day.date} className={`min-h-28 border-b border-r border-slate-100 p-1.5 ${index % 7 === 6 ? "border-r-0" : ""} ${day.inMonth ? "bg-white" : "bg-slate-50/70"}`}>
              <div className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${isToday ? "bg-teal-700 text-white" : day.inMonth ? "text-slate-700" : "text-slate-400"}`}>{day.dayNumber}</div>
              <div className="space-y-1">
                {dayItems.slice(0, 3).map((item) => (
                  <button key={item.id} type="button" onClick={() => onOpen(item)} title={item.title} className="flex w-full items-start gap-1 rounded border border-slate-100 bg-slate-50 px-1.5 py-1 text-left text-[10px] leading-3 text-slate-700 hover:border-teal-200 hover:bg-teal-50">
                    <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${SOURCE_DOT[item.source] || "bg-slate-400"}`} />
                    <span className="line-clamp-2">{item.title}</span>
                  </button>
                ))}
                {dayItems.length > 3 ? <div className="px-1 text-[10px] font-medium text-slate-500">+{dayItems.length - 3} more</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

