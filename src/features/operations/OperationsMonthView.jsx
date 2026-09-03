import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
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

const SOURCE_LABEL = {
  rent: "Rent",
  lease: "Lease",
  maintenance: "Maintenance",
  document: "Document",
  recurring: "Recurring",
  smart_check: "Smart check",
  planning: "Planning",
  loan: "Loan",
};

function monthLabel(month) {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

function dayLabel(date) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(parsed);
}

export function OperationsMonthView({ items, month, onMonthChange, onOpen, propertyNameById, todayIso }) {
  const days = useMemo(() => buildCalendarMonthDays(month), [month]);
  const [selectedDate, setSelectedDate] = useState(month === todayIso.slice(0, 7) ? todayIso : `${month}-01`);
  useEffect(() => {
    setSelectedDate(month === todayIso.slice(0, 7) ? todayIso : `${month}-01`);
  }, [month, todayIso]);
  const itemsByDate = useMemo(() => {
    const grouped = new Map();
    items.forEach((item) => {
      const dayItems = grouped.get(item.date) || [];
      dayItems.push(item);
      grouped.set(item.date, dayItems);
    });
    return grouped;
  }, [items]);
  const selectedItems = itemsByDate.get(selectedDate) || [];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <div className="text-base font-semibold text-slate-900">{monthLabel(month)}</div>
          <div className="text-xs text-slate-500">Select any item to open its authoritative record.</div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="outline" aria-label="Previous month" onClick={() => onMonthChange(shiftCalendarMonth(month, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => onMonthChange(todayIso.slice(0, 7))}>Today</Button>
          <Button size="sm" variant="outline" aria-label="Next month" onClick={() => onMonthChange(shiftCalendarMonth(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
          <Input className="h-9 w-36" type="month" aria-label="Jump to month" value={month} onChange={(event) => event.target.value && onMonthChange(event.target.value)} />
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
            {WEEKDAYS.map((weekday) => <div key={weekday} className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">{weekday}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day, index) => {
              const dayItems = itemsByDate.get(day.date) || [];
              const isToday = day.date === todayIso;
              const isSelected = day.date === selectedDate;
              return (
                <div key={day.date} className={`min-h-28 border-b border-r border-slate-100 p-1.5 ${index % 7 === 6 ? "border-r-0" : ""} ${isSelected ? "bg-teal-50/60 ring-1 ring-inset ring-teal-300" : day.inMonth ? "bg-white" : "bg-slate-50/70"}`}>
                  <button type="button" onClick={() => setSelectedDate(day.date)} aria-label={`Show ${dayLabel(day.date)}`} className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${isToday ? "bg-teal-700 text-white" : day.inMonth ? "text-slate-700 hover:bg-slate-100" : "text-slate-400 hover:bg-slate-100"}`}>{day.dayNumber}</button>
                  <div className="space-y-1">
                    {dayItems.slice(0, 3).map((item) => (
                      <button key={item.id} type="button" onClick={() => { setSelectedDate(day.date); onOpen(item); }} title={item.title} className="flex w-full items-start gap-1 rounded border border-slate-100 bg-slate-50 px-1.5 py-1 text-left text-[10px] leading-3 text-slate-700 hover:border-teal-200 hover:bg-teal-50">
                        <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${SOURCE_DOT[item.source] || "bg-slate-400"}`} />
                        <span className="line-clamp-2">{item.title}</span>
                      </button>
                    ))}
                    {dayItems.length > 3 ? <button type="button" className="px-1 text-[10px] font-medium text-teal-700 hover:underline" onClick={() => setSelectedDate(day.date)}>+{dayItems.length - 3} more</button> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="border-t border-slate-200 bg-slate-50/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-slate-900">{dayLabel(selectedDate)}</div>
            <div className="mt-0.5 text-xs text-slate-500">{selectedItems.length ? `${selectedItems.length} dated item${selectedItems.length === 1 ? "" : "s"}` : "No dated items"}</div>
          </div>
          {selectedDate !== todayIso ? <Button size="sm" variant="ghost" onClick={() => { setSelectedDate(todayIso); onMonthChange(todayIso.slice(0, 7)); }}>Return to today</Button> : null}
        </div>
        {selectedItems.length ? (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {selectedItems.map((item) => (
              <button key={item.id} type="button" onClick={() => onOpen(item)} className="rounded-lg border border-slate-200 bg-white p-3 text-left hover:border-teal-300 hover:bg-teal-50/40">
                <div className="flex items-start gap-2">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${SOURCE_DOT[item.source] || "bg-slate-400"}`} />
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900">{item.title}</div>
                    <div className="mt-1 text-xs text-slate-600">{item.detail}</div>
                    <div className="mt-1.5 text-[11px] font-medium text-slate-500">{SOURCE_LABEL[item.source] || "Calendar"} · {propertyNameById?.[item.propertyId] || (item.propertyId ? "Property" : "Portfolio-wide")}{item.unit ? ` · ${item.unit}` : ""}{item.role === "milestone" ? " · Milestone" : ""}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">Select another date or adjust the source and property filters above.</div>}
      </div>
    </div>
  );
}
