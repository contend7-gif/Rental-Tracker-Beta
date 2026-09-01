export type CalendarMonthDay = {
  date: string;
  dayNumber: number;
  inMonth: boolean;
};

function validMonth(month: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

export function shiftCalendarMonth(month: string, offset: number) {
  if (!validMonth(month)) return month;
  const [year, monthNumber] = month.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return shifted.toISOString().slice(0, 7);
}

export function buildCalendarMonthDays(month: string): CalendarMonthDay[] {
  if (!validMonth(month)) return [];
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const start = new Date(first);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const iso = date.toISOString().slice(0, 10);
    return {
      date: iso,
      dayNumber: date.getUTCDate(),
      inMonth: iso.startsWith(month),
    };
  });
}

