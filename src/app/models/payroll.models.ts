export type EntryMode = 'manual' | 'schedule';

export interface UserSettings {
  grossHourlyRate: number;
  netHourlyRate: number;
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
}
