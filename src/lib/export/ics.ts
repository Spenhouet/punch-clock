import type { Absence } from '$lib/domain/types';
import { addDaysKey } from '$lib/domain/time';
import { absenceLabel } from '$lib/labels';

function esc(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/[,;]/g, (c) => `\\${c}`)
    .replace(/\n/g, '\\n');
}

/** Absences as all-day calendar events. Consecutive days of the same kind merge into one event. */
export function absencesIcs(absences: Absence[]): string {
  const sorted = [...absences].sort((a, b) => a.date.localeCompare(b.date));
  const events: { start: string; end: string; a: Absence }[] = [];
  for (const a of sorted) {
    const last = events.at(-1);
    const sameKind = last && last.a.type === a.type && (last.a.label ?? '') === (a.label ?? '');
    // Days booked together as a range stay one event, even across a skipped weekend
    const joins = last && (a.groupId ? a.groupId === last.a.groupId : a.date === addDaysKey(last.end, 1));
    if (last && sameKind && joins) {
      last.end = a.date;
    } else {
      events.push({ start: a.date, end: a.date, a });
    }
  }
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PunchClock//EN', 'CALSCALE:GREGORIAN'];
  for (const e of events) {
    const summary = `${absenceLabel(e.a.type)}${e.a.fraction === 0.5 ? ' ½' : ''}${e.a.label ? `: ${e.a.label}` : ''}`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.a.id}@punchclock`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${e.start.replace(/-/g, '')}`,
      `DTEND;VALUE=DATE:${addDaysKey(e.end, 1).replace(/-/g, '')}`,
      `SUMMARY:${esc(summary)}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
