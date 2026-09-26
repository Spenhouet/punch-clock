import type { DateKey, Segment } from '$lib/domain/types';

/** Global UI state for sheets that can open from any screen. */
class UIState {
  dayOpen = $state(false);
  day = $state<DateKey>('');
  segmentOpen = $state(false);
  segment = $state<Partial<Segment> | null>(null);
  absenceOpen = $state(false);
  absenceDates = $state<DateKey[]>([]);
  /** Called after the absence sheet saved or removed. */
  afterAbsence: (() => void) | undefined;

  openDay(date: DateKey) {
    this.day = date;
    this.dayOpen = true;
  }

  editSegment(segment: Partial<Segment>) {
    this.segment = segment;
    this.segmentOpen = true;
  }

  editAbsences(dates: DateKey[], after?: () => void) {
    this.absenceDates = dates;
    this.afterAbsence = after;
    this.absenceOpen = true;
  }
}

export const ui = new UIState();
