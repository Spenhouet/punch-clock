import { m } from '$lib/paraglide/messages.js';
import type { AbsenceType } from '$lib/domain/types';
import type { Warning } from '$lib/domain/calc';

export function absenceLabel(type: AbsenceType): string {
  return {
    vacation: m.absence_vacation,
    comp_time: m.absence_comp_time,
    sick: m.absence_sick,
    special: m.absence_special,
    other: m.absence_other
  }[type]();
}

/** Background class for an absence type. */
export const absenceBg: Record<AbsenceType, string> = {
  vacation: 'bg-vacation',
  comp_time: 'bg-comp',
  sick: 'bg-sick',
  special: 'bg-special',
  other: 'bg-muted-foreground'
};

export const absenceText: Record<AbsenceType, string> = {
  vacation: 'text-vacation',
  comp_time: 'text-comp',
  sick: 'text-sick',
  special: 'text-special',
  other: 'text-muted-foreground'
};

export function warningLabel(w: Warning): string {
  return {
    break_short: m.warning_break_short,
    auto_break: m.warning_auto_break,
    over_10h: m.warning_over_10h,
    rest_short: m.warning_rest_short,
    overlap: m.warning_overlap,
    long_running: m.warning_long_running
  }[w]();
}
