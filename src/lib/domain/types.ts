/** Local calendar day, `YYYY-MM-DD`. */
export type DateKey = string;

/** Milliseconds since epoch. */
export type Timestamp = number;

export type SegmentKind = 'work' | 'break';
export type SegmentSource = 'manual' | 'button' | 'wifi' | 'notification';

/**
 * A contiguous span of work or break. Starting a break closes the running work
 * segment and opens a break segment; ending the break opens a new work segment.
 */
export interface Segment {
  id: string;
  /** Day the segment counts toward (the start day). */
  date: DateKey;
  kind: SegmentKind;
  start: Timestamp;
  /** `null` while running. */
  end: Timestamp | null;
  /** Unrounded stamp, kept when rounding changed the stored value. */
  rawStart?: Timestamp;
  rawEnd?: Timestamp;
  /** Timed break: ends by itself at this point. */
  plannedEnd?: Timestamp;
  /** Work only: break taken somewhere inside this entry, when its exact time is unknown. */
  breakMinutes?: number;
  note?: string;
  source: SegmentSource;
}

export type AbsenceType = 'vacation' | 'comp_time' | 'sick' | 'special' | 'other';

export const ABSENCE_TYPES: AbsenceType[] = ['vacation', 'comp_time', 'sick', 'special', 'other'];

/** Full or half day that is not regular work. */
export interface Absence {
  id: string;
  date: DateKey;
  type: AbsenceType;
  fraction: 1 | 0.5;
  label?: string;
  /** Shared by all days created together as a range. */
  groupId?: string;
}

export interface DayNote {
  date: DateKey;
  text: string;
}

/** Manual balance change: starting overtime, paid-out overtime, corrections. */
export interface BalanceAdjustment {
  id: string;
  date: DateKey;
  minutes: number;
  reason: string;
}

/** Target minutes per weekday, Monday first. */
export type WeekMinutes = [number, number, number, number, number, number, number];

/** Versioned so that changing hours never rewrites history. */
export interface WorkSchedule {
  id: string;
  validFrom: DateKey;
  minutesPerWeekday: WeekMinutes;
}

export interface VacationYear {
  year: number;
  entitlementDays: number;
  /** Days carried over from last year or set as a correction. `null` means computed. */
  carryOverDays: number | null;
  /** Carry-over days not used by this date are lost. */
  carryOverExpires?: DateKey;
}

export type Rounding = 0 | 5 | 10 | 15;
export type RoundingMode = 'nearest' | 'employer';

export interface Settings {
  setupDone: boolean;
  name: string;
  theme: 'system' | 'light' | 'dark';
  /** German state code for public holidays, or `none`. */
  state: string;
  /** Days before this date do not count toward the balance. */
  trackingStart: DateKey;
  breakPresets: number[];
  /** Usual start of the working day, used when filling a day with its target time. */
  defaultStart: string;
  rounding: Rounding;
  roundingMode: RoundingMode;
  autoBreak: boolean;
  warnings: boolean;
  defaultVacationDays: number;
  notifications: boolean;
  reminderAfterMinutes: number;
  /** Android: write a weekly backup file to the Documents folder. */
  autoBackup: boolean;
  lastBackup?: string;
  wifi: {
    enabled: boolean;
    ssid: string;
    mode: 'ask' | 'auto';
    clockOutOnDisconnect: boolean;
    graceMinutes: number;
  };
}

export interface Data {
  settings: Settings;
  segments: Segment[];
  absences: Absence[];
  notes: DayNote[];
  adjustments: BalanceAdjustment[];
  schedules: WorkSchedule[];
  vacationYears: VacationYear[];
}
