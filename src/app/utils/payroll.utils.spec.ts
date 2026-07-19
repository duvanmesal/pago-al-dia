import { WorkEntry } from '../models/payroll.models';
import {
  calculateDashboardInsights,
  calculateMonthlySummary,
  calculateScheduleMinutes,
  calculateWeeklySummaries,
  getPaymentDate,
  shiftMonth,
} from './payroll.utils';

describe('payroll utils', () => {
  it('subtracts the break from a schedule', () => {
    expect(calculateScheduleMinutes('08:00', '16:30', 30)).toBe(480);
  });

  it('calculates gross and net monthly totals', () => {
    const entries: WorkEntry[] = [
      {
        date: '2026-07-01',
        mode: 'manual',
        workedMinutes: 480,
        breakMinutes: 0,
        grossHourlyRate: 30,
        netHourlyRate: 24,
      },
      {
        date: '2026-07-02',
        mode: 'schedule',
        workedMinutes: 450,
        breakMinutes: 30,
        grossHourlyRate: 30,
        netHourlyRate: 24,
      },
    ];

    expect(calculateMonthlySummary(entries)).toEqual({
      daysWorked: 2,
      workedMinutes: 930,
      grossAmount: 465,
      netAmount: 372,
    });
  });

  it('moves December into January of the next year', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });

  it('sets payment on the 15th of the next month', () => {
    expect(getPaymentDate('2026-12').toISOString().slice(0, 10)).toBe('2027-01-15');
  });

  it('groups entries by calendar weeks clipped to the month', () => {
    const entries: WorkEntry[] = [
      {
        date: '2026-07-01',
        mode: 'manual',
        workedMinutes: 120,
        breakMinutes: 0,
        grossHourlyRate: 30,
        netHourlyRate: 24,
      },
      {
        date: '2026-07-06',
        mode: 'manual',
        workedMinutes: 480,
        breakMinutes: 0,
        grossHourlyRate: 30,
        netHourlyRate: 24,
      },
    ];

    const weeks = calculateWeeklySummaries(entries, '2026-07');

    expect(weeks[0]).toEqual({
      weekNumber: 1,
      startDate: '2026-07-01',
      endDate: '2026-07-05',
      daysWorked: 1,
      workedMinutes: 120,
      grossAmount: 60,
      netAmount: 48,
    });
    expect(weeks[1].startDate).toBe('2026-07-06');
    expect(weeks[1].workedMinutes).toBe(480);
  });

  it('returns empty averages and projection when the month has no entries', () => {
    expect(calculateDashboardInsights([], '2026-07', '2026-07-18')).toEqual({
      todayEntry: null,
      averageWorkedMinutes: 0,
      averageNetAmount: 0,
      projectedWorkedMinutes: 0,
      projectedNetAmount: 0,
      lastScheduleEntry: null,
    });
  });

  it('projects the current month from elapsed calendar days', () => {
    const entries: WorkEntry[] = [
      {
        date: '2026-07-05',
        mode: 'manual',
        workedMinutes: 600,
        breakMinutes: 0,
        grossHourlyRate: 30,
        netHourlyRate: 24,
      },
    ];

    const insights = calculateDashboardInsights(entries, '2026-07', '2026-07-10');

    expect(insights.averageWorkedMinutes).toBe(600);
    expect(insights.averageNetAmount).toBe(240);
    expect(insights.projectedWorkedMinutes).toBe(1860);
    expect(insights.projectedNetAmount).toBe(744);
  });

  it('finds the last schedule entry that can be reused', () => {
    const entries: WorkEntry[] = [
      {
        date: '2026-07-01',
        mode: 'schedule',
        workedMinutes: 480,
        breakMinutes: 30,
        grossHourlyRate: 30,
        netHourlyRate: 24,
        startTime: '08:00',
        endTime: '16:30',
      },
      {
        date: '2026-07-02',
        mode: 'manual',
        workedMinutes: 300,
        breakMinutes: 0,
        grossHourlyRate: 30,
        netHourlyRate: 24,
      },
      {
        date: '2026-07-03',
        mode: 'schedule',
        workedMinutes: 420,
        breakMinutes: 15,
        grossHourlyRate: 30,
        netHourlyRate: 24,
        startTime: '09:00',
        endTime: '16:15',
      },
    ];

    expect(calculateDashboardInsights(entries, '2026-07', '2026-07-04').lastScheduleEntry?.date).toBe('2026-07-03');
  });
});
