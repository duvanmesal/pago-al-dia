export type EntryMode = 'manual' | 'schedule';
export type PayrollDiscountType = 'fixed' | 'percentage';

export interface PayrollDiscount {
  id: string;
  name: string;
  type: PayrollDiscountType;
  value: number;
  enabled: boolean;
}

export interface UserSettings {
  grossHourlyRate: number;
  netHourlyRate: number;
  discounts: PayrollDiscount[];
  currency: 'PLN';
  timezone: 'Europe/Warsaw';
}

export interface WorkEntry {
  date: string;
  mode: EntryMode;
  workedMinutes: number;
  breakMinutes: number;
  grossHourlyRate: number;
  netHourlyRate: number;
  manualHours?: number;
  manualMinutes?: number;
  startTime?: string;
  endTime?: string;
}

export interface WorkEntryInput {
  date: string;
  mode: EntryMode;
  workedMinutes: number;
  breakMinutes: number;
  manualHours?: number;
  manualMinutes?: number;
  startTime?: string;
  endTime?: string;
}

export interface MonthlySummary {
  daysWorked: number;
  workedMinutes: number;
  grossAmount: number;
  netAmount: number;
  discountAmount: number;
  finalNetAmount: number;
}

export interface WeeklySummary extends MonthlySummary {
  weekNumber: number;
  startDate: string;
  endDate: string;
}

export interface DashboardInsights {
  todayEntry: WorkEntry | null;
  averageWorkedMinutes: number;
  averageNetAmount: number;
  averageFinalNetAmount: number;
  projectedWorkedMinutes: number;
  projectedNetAmount: number;
  projectedFinalNetAmount: number;
  lastScheduleEntry: WorkEntry | null;
}
