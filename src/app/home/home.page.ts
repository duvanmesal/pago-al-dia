import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonContent, IonIcon, IonModal, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  add,
  calendarOutline,
  chevronBack,
  chevronForward,
  closeOutline,
  logOutOutline,
  settingsOutline,
} from 'ionicons/icons';
import { EntryMode, WorkEntry } from '../models/payroll.models';
import { AuthService } from '../services/auth.service';
import { WorkDataService } from '../services/work-data.service';
import {
  calculateMonthlySummary,
  calculateScheduleMinutes,
  getPaymentDate,
  getWarsawDate,
  shiftMonth,
} from '../utils/payroll.utils';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [ReactiveFormsModule, IonContent, IonIcon, IonModal, IonSpinner],
})
export class HomePage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly data = inject(WorkDataService);

  readonly registering = signal(false);
  readonly authLoading = signal(false);
  readonly authError = signal<string | null>(null);
  readonly settingsSaving = signal(false);
  readonly settingsError = signal<string | null>(null);
  readonly settingsModalOpen = signal(false);
  readonly sameRate = signal(false);
  readonly entryModalOpen = signal(false);
  readonly entrySaving = signal(false);
  readonly entryError = signal<string | null>(null);
  readonly editingDate = signal<string | null>(null);
  readonly confirmDeleteOpen = signal(false);

  readonly user = this.auth.user;
  readonly authReady = this.auth.ready;
  readonly settings = this.data.settings;
  readonly entries = this.data.entries;
  readonly selectedMonth = this.data.selectedMonth;
  readonly settingsLoading = this.data.settingsLoading;
  readonly entriesLoading = this.data.entriesLoading;
  readonly dataError = this.data.error;
  readonly today = getWarsawDate();
  readonly currentMonth = this.today.slice(0, 7);

  readonly summary = computed(() => calculateMonthlySummary(this.entries()));
  readonly canGoNext = computed(() => this.selectedMonth() < this.currentMonth);
  readonly isCurrentMonth = computed(() => this.selectedMonth() === this.currentMonth);
  readonly monthTitle = computed(() => this.formatMonth(this.selectedMonth()));
  readonly paymentDateLabel = computed(() =>
    new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', timeZone: 'UTC' })
      .format(getPaymentDate(this.selectedMonth())),
  );
  readonly calendarDays = computed<(number | null)[]>(() => {
    const [year, month] = this.selectedMonth().split('-').map(Number);
    const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return [
      ...Array.from({ length: firstWeekday }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ];
  });

  readonly weekdayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  readonly authForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmation: [''],
  });

  readonly settingsForm = this.formBuilder.nonNullable.group({
    grossHourlyRate: [null as number | null, [Validators.required, Validators.min(0.01)]],
    netHourlyRate: [null as number | null, [Validators.required, Validators.min(0.01)]],
  });

  readonly entryForm = this.formBuilder.nonNullable.group({
    date: [this.today, Validators.required],
    mode: ['manual' as EntryMode, Validators.required],
    manualHours: [null as number | null],
    manualMinutes: [null as number | null],
    startTime: [''],
    endTime: [''],
    breakMinutes: [null as number | null],
  });

  constructor() {
    addIcons({ add, calendarOutline, chevronBack, chevronForward, closeOutline, logOutOutline, settingsOutline });
  }

  // ---------- auth ----------
  setRegistering(value: boolean): void {
    if (this.registering() === value) return;
    this.registering.set(value);
    this.authError.set(null);
    this.authForm.controls.confirmation.reset();
  }

  async submitAuth(): Promise<void> {
    const { email, password, confirmation } = this.authForm.getRawValue();
    if (this.authForm.controls.email.invalid) {
      this.authError.set('Ingresa un correo con formato válido.');
      return;
    }
    if (this.authForm.controls.password.invalid) {
      this.authError.set('La contraseña debe tener mínimo 6 caracteres.');
      return;
    }
    if (this.registering() && password !== confirmation) {
      this.authError.set('Las contraseñas no coinciden.');
      return;
    }

    this.authError.set(null);
    this.authLoading.set(true);
    try {
      if (this.registering()) await this.auth.registerWithEmail(email, password);
      else await this.auth.signInWithEmail(email, password);
    } catch (error) {
      this.authError.set(this.auth.getErrorMessage(error));
    } finally {
      this.authLoading.set(false);
    }
  }

  async signInWithGoogle(): Promise<void> {
    this.authError.set(null);
    this.authLoading.set(true);
    try {
      await this.auth.signInWithGoogle();
    } catch (error) {
      this.authError.set(this.auth.getErrorMessage(error));
    } finally {
      this.authLoading.set(false);
    }
  }

  async logout(): Promise<void> {
    await this.auth.signOut();
    this.authForm.reset();
    this.registering.set(false);
  }

  // ---------- rates ----------
  toggleSameRate(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.sameRate.set(checked);
    const net = this.settingsForm.controls.netHourlyRate;
    if (checked) {
      net.setValue(this.settingsForm.controls.grossHourlyRate.value);
      net.disable();
    } else {
      net.enable();
    }
  }

  onGrossRateInput(): void {
    if (this.sameRate()) {
      this.settingsForm.controls.netHourlyRate.setValue(this.settingsForm.controls.grossHourlyRate.value);
    }
  }

  async saveSettings(): Promise<void> {
    const { grossHourlyRate, netHourlyRate } = this.settingsForm.getRawValue();
    if (!grossHourlyRate || !netHourlyRate || grossHourlyRate <= 0 || netHourlyRate <= 0) {
      this.settingsError.set('Ambas tarifas deben ser mayores que cero.');
      return;
    }
    if (netHourlyRate > grossHourlyRate) {
      this.settingsError.set('La tarifa neta no puede ser mayor que la bruta.');
      return;
    }

    this.settingsError.set(null);
    this.settingsSaving.set(true);
    try {
      await this.data.saveSettings(grossHourlyRate, netHourlyRate);
      this.settingsModalOpen.set(false);
    } catch {
      this.settingsError.set('No pudimos guardar las tarifas. Inténtalo de nuevo.');
    } finally {
      this.settingsSaving.set(false);
    }
  }

  openSettings(): void {
    const settings = this.settings();
    this.settingsForm.controls.netHourlyRate.enable();
    this.sameRate.set(false);
    if (settings) {
      this.settingsForm.setValue({
        grossHourlyRate: settings.grossHourlyRate,
        netHourlyRate: settings.netHourlyRate,
      });
    }
    this.settingsError.set(null);
    this.settingsModalOpen.set(true);
  }

  // ---------- entries ----------
  openEntry(date = this.today): void {
    if (date > this.today) return;
    const existing = this.entries().find((entry) => entry.date === date);
    this.editingDate.set(existing?.date ?? null);
    this.entryError.set(null);
    this.entryForm.reset({
      date,
      mode: existing?.mode ?? 'manual',
      manualHours: existing?.manualHours ?? null,
      manualMinutes: existing?.manualMinutes ?? null,
      startTime: existing?.startTime ?? '',
      endTime: existing?.endTime ?? '',
      breakMinutes: existing?.breakMinutes || null,
    });
    this.entryModalOpen.set(true);
  }

  closeEntry(): void {
    this.entryModalOpen.set(false);
    this.editingDate.set(null);
    this.entryError.set(null);
  }

  setEntryMode(mode: EntryMode): void {
    this.entryForm.controls.mode.setValue(mode);
    this.entryError.set(null);
  }

  entryPreviewMinutes(): number {
    const value = this.entryForm.getRawValue();
    if (value.mode === 'manual') {
      return (value.manualHours ?? 0) * 60 + (value.manualMinutes ?? 0);
    }
    if (!value.startTime || !value.endTime) return 0;
    return Math.max(0, calculateScheduleMinutes(value.startTime, value.endTime, value.breakMinutes ?? 0));
  }

  entryPreviewNet(): number {
    const editing = this.editingDate();
    const existing = editing ? this.entries().find((entry) => entry.date === editing) : undefined;
    const rate = existing?.netHourlyRate ?? this.settings()?.netHourlyRate ?? 0;
    return (this.entryPreviewMinutes() / 60) * rate;
  }

  entryDateLabel(): string {
    return this.formatDayLabel(this.entryForm.controls.date.value);
  }

  async saveEntry(): Promise<void> {
    const value = this.entryForm.getRawValue();
    if (value.mode === 'manual') {
      const minutes = value.manualMinutes ?? 0;
      if (minutes < 0 || minutes > 59) {
        this.entryError.set('Los minutos deben estar entre 0 y 59.');
        return;
      }
      if ((value.manualHours ?? 0) * 60 + minutes <= 0) {
        this.entryError.set('Ingresa horas o minutos trabajados.');
        return;
      }
    } else {
      if (!value.startTime || !value.endTime) {
        this.entryError.set('Ingresa la hora de entrada y de salida.');
        return;
      }
      if (calculateScheduleMinutes(value.startTime, value.endTime, value.breakMinutes ?? 0) <= 0) {
        this.entryError.set('La salida debe ser después de la entrada (no se admiten turnos que crucen la medianoche).');
        return;
      }
    }

    const workedMinutes = this.entryPreviewMinutes();
    this.entryError.set(null);
    this.entrySaving.set(true);
    try {
      await this.data.saveEntry({
        date: value.date,
        mode: value.mode,
        workedMinutes,
        breakMinutes: value.mode === 'schedule' ? value.breakMinutes ?? 0 : 0,
        ...(value.mode === 'manual'
          ? { manualHours: value.manualHours ?? 0, manualMinutes: value.manualMinutes ?? 0 }
          : { startTime: value.startTime, endTime: value.endTime }),
      });
      this.data.selectedMonth.set(value.date.slice(0, 7));
      this.closeEntry();
    } catch {
      this.entryError.set('No pudimos guardar la jornada. Inténtalo de nuevo.');
    } finally {
      this.entrySaving.set(false);
    }
  }

  requestDelete(): void {
    this.confirmDeleteOpen.set(true);
  }

  cancelDelete(): void {
    this.confirmDeleteOpen.set(false);
  }

  async confirmDelete(): Promise<void> {
    const date = this.editingDate();
    if (!date) return;

    this.entrySaving.set(true);
    try {
      await this.data.deleteEntry(date);
      this.confirmDeleteOpen.set(false);
      this.closeEntry();
    } catch {
      this.confirmDeleteOpen.set(false);
      this.entryError.set('No pudimos eliminar la jornada.');
    } finally {
      this.entrySaving.set(false);
    }
  }

  // ---------- calendar ----------
  changeMonth(offset: number): void {
    const month = shiftMonth(this.selectedMonth(), offset);
    if (month <= this.currentMonth) this.data.selectedMonth.set(month);
  }

  dateForDay(day: number): string {
    return `${this.selectedMonth()}-${String(day).padStart(2, '0')}`;
  }

  entryForDay(day: number): WorkEntry | undefined {
    const date = this.dateForDay(day);
    return this.entries().find((entry) => entry.date === date);
  }

  // ---------- formatting ----------
  formatHours(minutes: number): string {
    const total = Math.max(0, Math.round(minutes));
    const hours = Math.floor(total / 60);
    const rest = total % 60;
    if (hours && rest) return `${hours}h ${rest}m`;
    if (hours) return `${hours}h`;
    return `${rest}m`;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value);
  }

  formatDayLabel(date: string): string {
    return new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
      .format(new Date(`${date}T12:00:00Z`))
      .replace(',', '');
  }

  dayNumber(date: string): number {
    return Number(date.slice(8, 10));
  }

  private formatMonth(monthKey: string): string {
    const [year, month] = monthKey.split('-').map(Number);
    const label = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(Date.UTC(year, month - 1, 1, 12)));
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
}
