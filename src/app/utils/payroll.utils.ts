import { MonthlySummary, WorkEntry } from '../models/payroll.models';

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

export function getPaymentDate(monthKey: string): Date {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(year, month, 15, 12));
}

export function shiftMonth(monthKey: string, offset: number): string {
  const [year, month] = monthKey.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + offset, 1, 12));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}
