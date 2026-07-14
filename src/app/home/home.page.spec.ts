import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '../services/auth.service';
import { WorkDataService } from '../services/work-data.service';
import { HomePage } from './home.page';

describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;

  beforeEach(async () => {
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
            entries: signal([]),
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
});
