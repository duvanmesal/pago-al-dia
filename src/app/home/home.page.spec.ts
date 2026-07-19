import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WorkEntry } from '../models/payroll.models';
import { AuthService } from '../services/auth.service';
import { WorkDataService } from '../services/work-data.service';
import { HomePage } from './home.page';

describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;
  let entries: ReturnType<typeof signal<WorkEntry[]>>;

  beforeEach(async () => {
    entries = signal<WorkEntry[]>([]);

    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [
        {
          provide: AuthService,
          useValue: {
            user: signal(null),
            ready: signal(true),
            signInWithEmail: jasmine.createSpy(),
            registerWithEmail: jasmine.createSpy(),
            signInWithGoogle: jasmine.createSpy(),
            signOut: jasmine.createSpy(),
            getErrorMessage: () => 'Error',
          },
        },
        {
          provide: WorkDataService,
          useValue: {
            settings: signal(null),
            entries,
            selectedMonth: signal('2026-07'),
            settingsLoading: signal(false),
            entriesLoading: signal(false),
            error: signal(null),
            saveSettings: jasmine.createSpy(),
            saveEntry: jasmine.createSpy(),
            deleteEntry: jasmine.createSpy(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('reuses the last schedule entry in the entry form', () => {
    entries.set([
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
        date: '2026-07-03',
        mode: 'schedule',
        workedMinutes: 420,
        breakMinutes: 15,
        grossHourlyRate: 30,
        netHourlyRate: 24,
        startTime: '09:00',
        endTime: '16:15',
      },
    ]);

    component.useLastSchedule();

    expect(component.entryForm.getRawValue()).toEqual(
      jasmine.objectContaining({
        mode: 'schedule',
        startTime: '09:00',
        endTime: '16:15',
        breakMinutes: 15,
        manualHours: null,
        manualMinutes: null,
      }),
    );
  });

  it('classifies calendar day intensity from worked minutes', () => {
    entries.set([
      {
        date: '2026-07-01',
        mode: 'manual',
        workedMinutes: 180,
        breakMinutes: 0,
        grossHourlyRate: 30,
        netHourlyRate: 24,
      },
      {
        date: '2026-07-02',
        mode: 'manual',
        workedMinutes: 360,
        breakMinutes: 0,
        grossHourlyRate: 30,
        netHourlyRate: 24,
      },
      {
        date: '2026-07-03',
        mode: 'manual',
        workedMinutes: 480,
        breakMinutes: 0,
        grossHourlyRate: 30,
        netHourlyRate: 24,
      },
    ]);

    expect(component.dayIntensity(1)).toBe('short-shift');
    expect(component.dayIntensity(2)).toBe('normal-shift');
    expect(component.dayIntensity(3)).toBe('long-shift');
    expect(component.dayIntensity(4)).toBeNull();
  });
});
