import { WorkEntry } from '../models/payroll.models';
import {
  calculateMonthlySummary,
  calculateScheduleMinutes,
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
});
