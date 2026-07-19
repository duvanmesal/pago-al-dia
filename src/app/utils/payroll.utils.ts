import { DashboardInsights, MonthlySummary, WeeklySummary, WorkEntry } from '../models/payroll.models';

export const WARSAW_TIMEZONE = 'Europe/Warsaw';

export function getWarsawDate(): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: WARSAW_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function calculateScheduleMinutes(startTime: string, endTime: string, breakMinutes: number): number {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  return end - start - breakMinutes;
}

export function calculateMonthlySummary(entries: WorkEntry[]): MonthlySummary {
  return entries.reduce<MonthlySummary>(
    (summary, entry) => ({
      daysWorked: summary.daysWorked + 1,
      workedMinutes: summary.workedMinutes + entry.workedMinutes,
      grossAmount: summary.grossAmount + (entry.workedMinutes / 60) * entry.grossHourlyRate,
      netAmount: summary.netAmount + (entry.workedMinutes / 60) * entry.netHourlyRate,
    }),
    { daysWorked: 0, workedMinutes: 0, grossAmount: 0, netAmount: 0 },
  );
}

export function calculateWeeklySummaries(entries: WorkEntry[], monthKey: string): WeeklySummary[] {
  const [year, month] = monthKey.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const entriesByDate = new Map(entries.map((entry) => [entry.date, entry]));
  const summaries: WeeklySummary[] = [];

  let weekNumber = 1;
  for (let day = 1; day <= daysInMonth;) {
    const startDay = day;
    const startDate = `${monthKey}-${String(startDay).padStart(2, '0')}`;
    const weekday = (new Date(`${startDate}T12:00:00Z`).getUTCDay() + 6) % 7;
    const daysUntilSunday = 7 - weekday;
    const endDay = Math.min(daysInMonth, startDay + daysUntilSunday - 1);
    const weekEntries: WorkEntry[] = [];

    for (let currentDay = startDay; currentDay <= endDay; currentDay++) {
      const entry = entriesByDate.get(`${monthKey}-${String(currentDay).padStart(2, '0')}`);
      if (entry) weekEntries.push(entry);
    }

    summaries.push({
      weekNumber,
      startDate,
      endDate: `${monthKey}-${String(endDay).padStart(2, '0')}`,
      ...calculateMonthlySummary(weekEntries),
    });

    weekNumber++;
    day = endDay + 1;
  }

  return summaries;
}

export function calculateCurrentWeekSummary(entries: WorkEntry[], today: string): WeeklySummary {
  const date = new Date(`${today}T12:00:00Z`);
  const weekday = (date.getUTCDay() + 6) % 7;
  const start = new Date(date);
  start.setUTCDate(date.getUTCDate() - weekday);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  const startDate = toDateKey(start);
  const endDate = toDateKey(end);
  const weekEntries = entries.filter((entry) => entry.date >= startDate && entry.date <= endDate);

  return {
    weekNumber: 0,
    startDate,
    endDate,
    ...calculateMonthlySummary(weekEntries),
  };
}

export function calculateDashboardInsights(
  entries: WorkEntry[],
  monthKey: string,
  today: string,
): DashboardInsights {
  const summary = calculateMonthlySummary(entries);
  const todayEntry = entries.find((entry) => entry.date === today) ?? null;
  const averageWorkedMinutes = summary.daysWorked ? summary.workedMinutes / summary.daysWorked : 0;
  const averageNetAmount = summary.daysWorked ? summary.netAmount / summary.daysWorked : 0;
  const lastScheduleEntry = [...entries]
    .reverse()
    .find((entry) => entry.mode === 'schedule' && entry.startTime && entry.endTime) ?? null;

  if (monthKey !== today.slice(0, 7) || !entries.length) {
    return {
      todayEntry,
      averageWorkedMinutes,
      averageNetAmount,
      projectedWorkedMinutes: summary.workedMinutes,
      projectedNetAmount: summary.netAmount,
      lastScheduleEntry,
    };
  }

  const [, month] = monthKey.split('-').map(Number);
  const elapsedDays = Math.max(1, Number(today.slice(8, 10)));
  const daysInMonth = new Date(Date.UTC(Number(today.slice(0, 4)), month, 0)).getUTCDate();

  return {
    todayEntry,
    averageWorkedMinutes,
    averageNetAmount,
    projectedWorkedMinutes: (summary.workedMinutes / elapsedDays) * daysInMonth,
    projectedNetAmount: (summary.netAmount / elapsedDays) * daysInMonth,
    lastScheduleEntry,
  };
}

export function getPaymentDate(monthKey: string): Date {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(year, month, 15, 12));
}

export function shiftMonth(monthKey: string, offset: number): string {
  const [year, month] = monthKey.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + offset, 1, 12));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

function toDateKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}
