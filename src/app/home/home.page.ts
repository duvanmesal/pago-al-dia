import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { App } from '@capacitor/app';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { IonContent, IonIcon, IonModal, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  add,
  calendarOutline,
  chevronBack,
  chevronForward,
  closeOutline,
  copyOutline,
  logOutOutline,
  settingsOutline,
} from 'ionicons/icons';
import { EntryMode, WorkEntry } from '../models/payroll.models';
import { AuthService } from '../services/auth.service';
import { NativeSecurityService } from '../services/native-security.service';
import { NativeWidgetService } from '../services/native-widget.service';
import { PlatformService } from '../services/platform.service';
import { WorkDataService } from '../services/work-data.service';
import {
  calculateCurrentWeekSummary,
  calculateDashboardInsights,
  calculateMonthlySummary,
  calculateScheduleMinutes,
  calculateWeeklySummaries,
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
  private readonly platform = inject(PlatformService);
  private readonly nativeSecurity = inject(NativeSecurityService);
  private readonly nativeWidget = inject(NativeWidgetService);
  private lockedForUid: string | null = null;

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
  readonly biometricAvailable = signal(false);
  readonly biometricEnabled = signal(false);
  readonly securityLocked = signal(false);
  readonly securityError = signal<string | null>(null);
  readonly widgetShowAmounts = signal(false);

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
  readonly isNativeAndroid = this.platform.isNative && this.platform.isAndroid;

  readonly summary = computed(() => calculateMonthlySummary(this.entries()));
  readonly weeklySummaries = computed(() => calculateWeeklySummaries(this.entries(), this.selectedMonth()));
  readonly currentWeekSummary = computed(() => calculateCurrentWeekSummary(this.entries(), this.today));
  readonly insights = computed(() => calculateDashboardInsights(this.entries(), this.selectedMonth(), this.today));
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
    addIcons({
      add,
      calendarOutline,
      chevronBack,
      chevronForward,
      closeOutline,
      copyOutline,
      logOutOutline,
      settingsOutline,
    });
    void this.initMobileFeatures();
    effect(() => {
      const user = this.user();
      this.entries();
      this.summary();
      this.currentWeekSummary();
      this.insights();
      this.paymentDateLabel();
      this.widgetShowAmounts();

      if (!user) {
        this.lockedForUid = null;
        this.securityLocked.set(false);
        return;
      }

      void this.lockForCurrentUserIfNeeded(user.uid);
      void this.syncWidget();
    });
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
    await this.nativeSecurity.setBiometricEnabled(false);
    this.biometricEnabled.set(false);
    this.securityLocked.set(false);
    this.lockedForUid = null;
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
      await this.syncWidget();
      this.settingsModalOpen.set(false);
    } catch {
      this.settingsError.set('No pudimos guardar las tarifas. Inténtalo de nuevo.');
    } finally {
      this.settingsSaving.set(false);
    }
  }

  async toggleBiometric(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const enabled = input.checked;
    this.securityError.set(null);

    if (enabled) {
      const authenticated = await this.nativeSecurity.authenticate().catch(() => false);
      if (!authenticated) {
        input.checked = false;
        this.biometricEnabled.set(false);
        this.securityError.set('No se pudo activar la biometría.');
        return;
      }
    }

    try {
      await this.nativeSecurity.setBiometricEnabled(enabled);
      this.biometricEnabled.set(enabled);
      this.lockedForUid = enabled ? this.user()?.uid ?? null : null;
    } catch {
      input.checked = this.biometricEnabled();
      this.securityError.set('No se pudo guardar la configuración biométrica.');
    }
  }

  async toggleWidgetAmounts(event: Event): Promise<void> {
    const showAmounts = (event.target as HTMLInputElement).checked;
    this.widgetShowAmounts.set(showAmounts);
    await this.nativeWidget.setShowAmounts(showAmounts);
    await this.syncWidget();
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

  useLastSchedule(): void {
    const lastSchedule = this.insights().lastScheduleEntry;
    if (!lastSchedule?.startTime || !lastSchedule.endTime) return;

    this.entryForm.patchValue({
      mode: 'schedule',
      startTime: lastSchedule.startTime,
      endTime: lastSchedule.endTime,
      breakMinutes: lastSchedule.breakMinutes || null,
      manualHours: null,
      manualMinutes: null,
    });
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
      await Haptics.notification({ type: NotificationType.Success }).catch(() => undefined);
      await this.syncWidget();
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
      await Haptics.notification({ type: NotificationType.Warning }).catch(() => undefined);
      await this.syncWidget();
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

  dayIntensity(day: number): 'short-shift' | 'normal-shift' | 'long-shift' | null {
    const entry = this.entryForDay(day);
    if (!entry) return null;
    if (entry.workedMinutes < 240) return 'short-shift';
    if (entry.workedMinutes >= 480) return 'long-shift';
    return 'normal-shift';
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

  formatDateRange(startDate: string, endDate: string): string {
    const start = Number(startDate.slice(8, 10));
    const end = Number(endDate.slice(8, 10));
    return `${start}-${end}`;
  }

  async unlockWithBiometrics(): Promise<void> {
    this.securityError.set(null);
    const authenticated = await this.nativeSecurity.authenticate().catch(() => false);
    if (!authenticated) {
      this.securityError.set('No pudimos desbloquear la app.');
      return;
    }

    this.lockedForUid = this.user()?.uid ?? null;
    this.securityLocked.set(false);
  }

  private async initMobileFeatures(): Promise<void> {
    const [status, biometricEnabled, widgetShowAmounts] = await Promise.all([
      this.nativeSecurity.getBiometricStatus(),
      this.nativeSecurity.getBiometricEnabled(),
      this.nativeWidget.getShowAmounts(),
    ]);
    this.biometricAvailable.set(status.available);
    this.biometricEnabled.set(biometricEnabled);
    this.widgetShowAmounts.set(widgetShowAmounts);

    if (this.isNativeAndroid) {
      await App.addListener('appStateChange', ({ isActive }) => {
        if (isActive && this.user() && this.biometricEnabled()) {
          this.securityLocked.set(true);
        }
      });
    }
  }

  private async lockForCurrentUserIfNeeded(uid: string): Promise<void> {
    if (!this.isNativeAndroid || !this.biometricEnabled() || this.lockedForUid === uid) return;
    this.securityLocked.set(true);
  }

  private async syncWidget(): Promise<void> {
    const snapshot = this.nativeWidget.createSnapshot(
      this.today,
      this.insights(),
      this.currentWeekSummary(),
      this.summary(),
      this.paymentDateLabel(),
      this.widgetShowAmounts(),
    );
    await this.nativeWidget.updateWidget(snapshot).catch(() => undefined);
  }

  private formatMonth(monthKey: string): string {
    const [year, month] = monthKey.split('-').map(Number);
    const label = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(Date.UTC(year, month - 1, 1, 12)));
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
}
