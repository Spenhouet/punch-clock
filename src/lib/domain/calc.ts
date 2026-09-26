import { holidayName } from './holidays';
import { addDaysKey, daysBetween, HOUR, MINUTE, todayKey, weekdayIndex } from './time';
import type {
  Absence,
  AbsenceType,
  BalanceAdjustment,
  Data,
  DateKey,
  DayNote,
  Segment,
  Timestamp,
  VacationYear,
  WorkSchedule
} from './types';

/** Absence types that credit the day's target. Comp time does not, so it reduces the balance. */
export const CREDIT_TYPES: ReadonlySet<AbsenceType> = new Set(['vacation', 'sick', 'special', 'other']);

export type Warning = 'break_short' | 'auto_break' | 'over_10h' | 'rest_short' | 'overlap' | 'long_running';

export interface DaySummary {
  date: DateKey;
  /** Scheduled minutes for the weekday, before holidays and absences. */
  scheduled: number;
  holiday?: string;
  /** Minutes the day must be worked after holidays and credited absences. */
  target: number;
  /** Sum of work segments. */
  gross: number;
  /** Time between first start and last end that was not work (break segments and gaps). */
  pause: number;
  /** ArbZG break shortfall deducted from `gross`. */
  autoDeducted: number;
  /** Counted working time. */
  worked: number;
  delta: number;
  first?: Timestamp;
  last?: Timestamp;
  running: boolean;
  segments: Segment[];
  absences: Absence[];
  note?: string;
  /** Before tracking start or in the future: not part of the balance. */
  counted: boolean;
  isWorkday: boolean;
  compMinutes: number;
  warnings: Warning[];
}

export interface PeriodSummary {
  start: DateKey;
  end: DateKey;
  days: DaySummary[];
  target: number;
  targetToDate: number;
  worked: number;
  pause: number;
  delta: number;
  daysWorked: number;
  absenceDays: Record<AbsenceType, number>;
  holidays: number;
  avgStart?: number;
  avgEnd?: number;
  avgWorked?: number;
  balanceBefore: number;
  balanceAfter: number;
  adjustments: BalanceAdjustment[];
}

export interface VacationSummary {
  year: number;
  entitlement: number;
  carryOver: number;
  carryOverExpires?: DateKey;
  carryOverLost: number;
  taken: number;
  planned: number;
  left: number;
}

/** Minimum break per §4 ArbZG for a given amount of work. */
export function requiredBreak(workedMinutes: number): number {
  if (workedMinutes > 9 * 60) return 45;
  if (workedMinutes > 6 * 60) return 30;
  return 0;
}

/**
 * Deduct the missing break, but never below the threshold that triggered it:
 * 6:10 h without a break becomes 6:00 h, not 5:40 h.
 */
export function autoBreakDeduction(gross: number, pause: number): number {
  const required = requiredBreak(gross);
  if (required === 0 || pause >= required) return 0;
  const threshold = required === 45 ? 9 * 60 : 6 * 60;
  return Math.max(0, Math.min(required - pause, gross - threshold));
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

export function scheduleFor(schedules: WorkSchedule[], date: DateKey): WorkSchedule | undefined {
  let match: WorkSchedule | undefined;
  for (const s of schedules) {
    if (s.validFrom <= date && (!match || s.validFrom > match.validFrom)) match = s;
  }
  return match ?? [...schedules].sort((a, b) => a.validFrom.localeCompare(b.validFrom))[0];
}

/**
 * Read-only view over all data at a point in time. Computes day, period,
 * balance and vacation figures and memoizes them.
 */
export class Ledger {
  readonly today: DateKey;
  private segmentsByDate: Map<DateKey, Segment[]>;
  private absencesByDate: Map<DateKey, Absence[]>;
  private notesByDate: Map<DateKey, DayNote>;
  private dayCache = new Map<DateKey, DaySummary>();
  private balanceCache = new Map<DateKey, number>();
  private sortedAdjustments: BalanceAdjustment[];

  constructor(
    readonly data: Data,
    readonly now: Timestamp = Date.now(),
    readonly lang: 'de' | 'en' = 'de'
  ) {
    this.today = todayKey(now);
    this.segmentsByDate = groupBy(data.segments, (s) => s.date);
    for (const list of this.segmentsByDate.values()) list.sort((a, b) => a.start - b.start);
    this.absencesByDate = groupBy(data.absences, (a) => a.date);
    this.notesByDate = new Map(data.notes.map((n) => [n.date, n]));
    this.sortedAdjustments = [...data.adjustments].sort((a, b) => a.date.localeCompare(b.date));
  }

  get settings() {
    return this.data.settings;
  }

  /** The running segment, if clocked in. */
  get running(): Segment | undefined {
    return this.data.segments.find((s) => s.end === null);
  }

  get status(): 'out' | 'working' | 'break' {
    const r = this.running;
    return r ? (r.kind === 'work' ? 'working' : 'break') : 'out';
  }

  private end(s: Segment): Timestamp {
    return s.end ?? Math.max(this.now, s.start);
  }

  day(date: DateKey): DaySummary {
    const cached = this.dayCache.get(date);
    if (cached) return cached;

    const segments = this.segmentsByDate.get(date) ?? [];
    const absences = this.absencesByDate.get(date) ?? [];
    const schedule = scheduleFor(this.data.schedules, date);
    const scheduled = schedule?.minutesPerWeekday[weekdayIndex(date)] ?? 0;
    const holiday = holidayName(date, this.settings.state, this.lang);
    const base = holiday ? 0 : scheduled;

    const creditFraction = Math.min(
      1,
      absences.filter((a) => CREDIT_TYPES.has(a.type)).reduce((sum, a) => sum + a.fraction, 0)
    );
    const compFraction = Math.min(
      1,
      absences.filter((a) => a.type === 'comp_time').reduce((sum, a) => sum + a.fraction, 0)
    );
    const target = Math.round(base * (1 - creditFraction));

    let gross = 0;
    let first: Timestamp | undefined;
    let last: Timestamp | undefined;
    let running = false;
    let overlap = false;
    let prevEnd = -Infinity;
    for (const s of segments) {
      const end = this.end(s);
      if (s.end === null) running = true;
      if (s.kind === 'work') gross += Math.max(0, (end - s.start) / MINUTE - (s.breakMinutes ?? 0));
      if (first === undefined || s.start < first) first = s.start;
      if (last === undefined || end > last) last = end;
      if (s.start < prevEnd - MINUTE / 2) overlap = true;
      prevEnd = Math.max(prevEnd, end);
    }
    gross = Math.round(gross);
    const span = first !== undefined && last !== undefined ? Math.round((last - first) / MINUTE) : 0;
    const pause = Math.max(0, span - gross);
    const autoDeducted = this.settings.autoBreak && !running ? autoBreakDeduction(gross, pause) : 0;
    const worked = gross - autoDeducted;
    // Days before tracking start only count when something was recorded for them
    const counted =
      date <= this.today && (date >= this.settings.trackingStart || segments.length > 0 || absences.length > 0);

    const warnings: Warning[] = [];
    if (this.settings.warnings) {
      if (autoDeducted > 0) warnings.push('auto_break');
      else if (!running && pause < requiredBreak(gross)) warnings.push('break_short');
      if (worked > 10 * 60) warnings.push('over_10h');
      if (first !== undefined) {
        const prevLast = this.lastEnd(addDaysKey(date, -1));
        if (prevLast !== undefined && first - prevLast < 11 * HOUR) warnings.push('rest_short');
      }
    }
    if (overlap) warnings.push('overlap');
    const r = segments.find((s) => s.end === null);
    if (r && this.now - r.start > 12 * HOUR) warnings.push('long_running');

    const summary: DaySummary = {
      date,
      scheduled,
      holiday,
      target,
      gross,
      pause,
      autoDeducted,
      worked,
      delta: worked - target,
      first,
      last,
      running,
      segments,
      absences,
      note: this.notesByDate.get(date)?.text,
      counted,
      isWorkday: base > 0,
      compMinutes: Math.round(base * compFraction),
      warnings
    };
    this.dayCache.set(date, summary);
    return summary;
  }

  private lastEnd(date: DateKey): Timestamp | undefined {
    const segs = this.segmentsByDate.get(date);
    if (!segs?.length) return undefined;
    return Math.max(...segs.map((s) => this.end(s)));
  }

  /**
   * What a day adds to the balance. Today only counts once it helps you:
   * surplus counts right away, a deficit only as far as comp time was booked.
   * The rest settles when the day is over.
   */
  contribution(day: DaySummary): number {
    if (!day.counted) return 0;
    if (day.date === this.today) return Math.max(day.delta, -day.compMinutes);
    return day.delta;
  }

  /** Earliest day relevant for the balance: tracking start or the first recorded day before it. */
  private _balanceStart?: DateKey;
  private get balanceStart(): DateKey {
    if (this._balanceStart === undefined) {
      let start = this.settings.trackingStart;
      for (const d of this.segmentsByDate.keys()) if (d < start) start = d;
      for (const d of this.absencesByDate.keys()) if (d < start) start = d;
      this._balanceStart = start;
    }
    return this._balanceStart;
  }

  /** Balance at the end of `date`, counting every day in full. */
  balanceAt(date: DateKey): number {
    const cached = this.balanceCache.get(date);
    if (cached !== undefined) return cached;

    let total = 0;
    for (const a of this.sortedAdjustments) if (a.date <= date) total += a.minutes;
    // Walk days in one pass and fill the cache for every day on the way
    const start = this.balanceStart;
    if (date >= start) {
      let running = 0;
      for (const d of daysBetween(start, date)) {
        running += this.contribution(this.day(d));
        let adj = 0;
        for (const a of this.sortedAdjustments) if (a.date <= d) adj += a.minutes;
        this.balanceCache.set(d, running + adj);
      }
      total += running;
    }
    this.balanceCache.set(date, total);
    return total;
  }

  /** Current balance, see `contribution` for how today counts. */
  balanceNow(): number {
    return this.balanceAt(this.today);
  }

  period(start: DateKey, end: DateKey): PeriodSummary {
    const days = daysBetween(start, end).map((d) => this.day(d));
    const absenceDays: Record<AbsenceType, number> = { vacation: 0, comp_time: 0, sick: 0, special: 0, other: 0 };
    let target = 0;
    let targetToDate = 0;
    let worked = 0;
    let pause = 0;
    let delta = 0;
    let daysWorked = 0;
    let holidays = 0;
    const starts: number[] = [];
    const ends: number[] = [];
    for (const d of days) {
      target += d.target;
      if (d.counted) targetToDate += d.target;
      delta += this.contribution(d);
      worked += d.worked;
      pause += d.pause;
      if (d.holiday && d.scheduled > 0) holidays++;
      if (d.gross > 0) {
        daysWorked++;
        if (d.first !== undefined) starts.push(minutesOfDay(d.first));
        if (d.last !== undefined && !d.running) ends.push(minutesOfDay(d.last));
      }
      if (d.isWorkday) for (const a of d.absences) absenceDays[a.type] += a.fraction;
    }
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);
    const lastCounted = end < this.today ? end : this.today;
    return {
      start,
      end,
      days,
      target,
      targetToDate,
      worked,
      pause,
      delta,
      daysWorked,
      absenceDays,
      holidays,
      avgStart: avg(starts),
      avgEnd: avg(ends),
      avgWorked: daysWorked ? worked / daysWorked : undefined,
      balanceBefore: this.balanceAt(addDaysKey(start, -1)),
      balanceAfter: lastCounted >= start ? this.balanceAt(lastCounted) : this.balanceAt(addDaysKey(start, -1)),
      adjustments: this.sortedAdjustments.filter((a) => a.date >= start && a.date <= end)
    };
  }

  vacationYear(year: number): VacationYear {
    return (
      this.data.vacationYears.find((v) => v.year === year) ?? {
        year,
        entitlementDays: this.settings.defaultVacationDays,
        carryOverDays: null
      }
    );
  }

  /** Vacation days booked on workdays of a year, split by taken and planned. */
  private vacationUsage(year: number, until?: DateKey) {
    let taken = 0;
    let planned = 0;
    for (const a of this.data.absences) {
      if (a.type !== 'vacation' || !a.date.startsWith(`${year}-`)) continue;
      if (until && a.date > until) continue;
      if (!this.day(a.date).isWorkday) continue;
      if (a.date <= this.today) taken += a.fraction;
      else planned += a.fraction;
    }
    return { taken, planned };
  }

  vacation(year: number, depth = 0): VacationSummary {
    const config = this.vacationYear(year);
    const firstYear = Number(this.settings.trackingStart.slice(0, 4));
    let carryOver = config.carryOverDays ?? 0;
    if (config.carryOverDays === null && year > firstYear && depth < 50) {
      carryOver = Math.max(0, this.vacation(year - 1, depth + 1).left);
    }
    const { taken, planned } = this.vacationUsage(year);
    let carryOverLost = 0;
    if (config.carryOverExpires && this.today > config.carryOverExpires && carryOver > 0) {
      const usedBefore = this.vacationUsage(year, config.carryOverExpires);
      carryOverLost = Math.max(0, carryOver - (usedBefore.taken + usedBefore.planned));
    }
    return {
      year,
      entitlement: config.entitlementDays,
      carryOver,
      carryOverExpires: config.carryOverExpires,
      carryOverLost,
      taken,
      planned,
      left: config.entitlementDays + carryOver - carryOverLost - taken - planned
    };
  }
}

export function minutesOfDay(ts: Timestamp): number {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
}
