import { effect, inject, Injectable, signal } from '@angular/core';
import {
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  query,
  collection,
  orderBy,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  where,
} from 'firebase/firestore';
import { UserSettings, WorkEntry, WorkEntryInput } from '../models/payroll.models';
import { getWarsawDate } from '../utils/payroll.utils';
import { AuthService } from './auth.service';
import { FirebaseService } from './firebase.service';

@Injectable({ providedIn: 'root' })
export class WorkDataService {
  private readonly auth = inject(AuthService);
  private readonly firebase = inject(FirebaseService);

  readonly settings = signal<UserSettings | null>(null);
  readonly entries = signal<WorkEntry[]>([]);
  readonly selectedMonth = signal(getWarsawDate().slice(0, 7));
  readonly settingsLoading = signal(true);
  readonly entriesLoading = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    effect((onCleanup) => {
      const user = this.auth.user();
      const month = this.selectedMonth();
      let stopSettings: Unsubscribe | undefined;
      let stopEntries: Unsubscribe | undefined;

      if (!user) {
        this.settings.set(null);
        this.entries.set([]);
        this.settingsLoading.set(false);
        this.entriesLoading.set(false);
        return;
      }

      this.settingsLoading.set(true);
      this.entriesLoading.set(true);
      this.error.set(null);

      stopSettings = onSnapshot(
        doc(this.firebase.firestore, 'users', user.uid),
        (snapshot) => {
          this.settings.set(snapshot.exists() ? (snapshot.data() as UserSettings) : null);
          this.settingsLoading.set(false);
        },
        () => this.handleReadError('No pudimos cargar la configuración.'),
      );

      const entriesQuery = query(
        collection(this.firebase.firestore, 'users', user.uid, 'workEntries'),
        where('date', '>=', `${month}-01`),
        where('date', '<=', `${month}-31`),
        orderBy('date', 'asc'),
      );

      stopEntries = onSnapshot(
        entriesQuery,
        (snapshot) => {
          this.entries.set(snapshot.docs.map((entry) => entry.data() as WorkEntry));
          this.entriesLoading.set(false);
        },
        () => this.handleReadError('No pudimos cargar las jornadas.'),
      );

      onCleanup(() => {
        stopSettings?.();
        stopEntries?.();
      });
    });
  }

  async saveSettings(grossHourlyRate: number, netHourlyRate: number): Promise<void> {
    const uid = this.requireUid();
    await setDoc(
      doc(this.firebase.firestore, 'users', uid),
      {
        grossHourlyRate,
        netHourlyRate,
        currency: 'PLN',
        timezone: 'Europe/Warsaw',
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  async saveEntry(input: WorkEntryInput): Promise<void> {
    const uid = this.requireUid();
    const settings = this.settings();
    if (!settings) throw new Error('Configura primero las tarifas por hora.');

    const previous = this.entries().find((entry) => entry.date === input.date);
    const entryRef = doc(this.firebase.firestore, 'users', uid, 'workEntries', input.date);
    await setDoc(
      entryRef,
      {
        ...input,
        manualHours: input.mode === 'manual' ? input.manualHours : deleteField(),
        manualMinutes: input.mode === 'manual' ? input.manualMinutes : deleteField(),
        startTime: input.mode === 'schedule' ? input.startTime : deleteField(),
        endTime: input.mode === 'schedule' ? input.endTime : deleteField(),
        grossHourlyRate: previous?.grossHourlyRate ?? settings.grossHourlyRate,
        netHourlyRate: previous?.netHourlyRate ?? settings.netHourlyRate,
        updatedAt: serverTimestamp(),
        ...(previous ? {} : { createdAt: serverTimestamp() }),
      },
      { merge: true },
    );
  }

  async deleteEntry(date: string): Promise<void> {
    const uid = this.requireUid();
    await deleteDoc(doc(this.firebase.firestore, 'users', uid, 'workEntries', date));
  }

  private requireUid(): string {
    const uid = this.auth.user()?.uid;
    if (!uid) throw new Error('Debes iniciar sesión para continuar.');
    return uid;
  }

  private handleReadError(message: string): void {
    this.error.set(message);
    this.settingsLoading.set(false);
    this.entriesLoading.set(false);
  }
}
