import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import type { Ledger } from '$lib/domain/calc';
import { formatMinutes as fmt, toHHmm, type PeriodKind } from '$lib/domain/time';
import { absenceLabel } from '$lib/labels';
import { m } from '$lib/paraglide/messages.js';
import { formatDate, formatNumber } from '$lib/format';

// The standard PDF fonts lack U+2212, so use an ASCII minus
const formatMinutes = (v: number, opts?: { sign?: boolean }) => fmt(v, opts).replace('\u2212', '-');

const TEAL: [number, number, number] = [15, 118, 110];

function periodTitle(kind: PeriodKind, start: string): string {
  if (kind === 'year') return start.slice(0, 4);
  if (kind === 'month') return formatDate(start, 'LLLL yyyy');
  return `${m.week_number({ week: Number(formatDate(start, 'I')) })} ${formatDate(start, 'yyyy')}`;
}

/** Timesheet PDF. Month and week list every day, a year lists months. */
export function timesheetPdf(ledger: Ledger, kind: PeriodKind, start: string, end: string): Uint8Array {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const summary = ledger.period(start, end);
  const name = ledger.settings.name;
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(`${m.timesheet()} ${periodTitle(kind, start)}`, 14, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text([name, `${formatDate(start, 'P')} – ${formatDate(end, 'P')}`].filter(Boolean), 14, 25);
  doc.setTextColor(0);

  const dash = (v: number | undefined) => (v === undefined ? '' : formatMinutes(v, { sign: true }));

  if (kind === 'year') {
    const year = Number(start.slice(0, 4));
    const body = Array.from({ length: 12 }, (_, i) => {
      const ms = `${year}-${String(i + 1).padStart(2, '0')}-01`;
      const me = new Date(year, i + 1, 0).getDate();
      const p = ledger.period(ms, `${ms.slice(0, 8)}${String(me).padStart(2, '0')}`);
      const future = ms > ledger.today;
      return [
        formatDate(ms, 'LLLL'),
        String(p.daysWorked),
        formatMinutes(p.worked),
        formatMinutes(p.target),
        future ? '' : dash(p.delta),
        formatNumber(p.absenceDays.vacation),
        formatNumber(p.absenceDays.sick),
        future ? '' : formatMinutes(p.balanceAfter, { sign: true })
      ];
    });
    autoTable(doc, {
      startY: 32,
      head: [
        [
          m.month(),
          m.days_worked(),
          m.worked(),
          m.target(),
          m.difference(),
          m.absence_vacation(),
          m.absence_sick(),
          m.balance()
        ]
      ],
      body,
      theme: 'striped',
      headStyles: { fillColor: TEAL },
      styles: { fontSize: 9 },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' }
      }
    });
  } else {
    const body = summary.days.map((d) => {
      const remarks = [
        d.holiday,
        ...d.absences.map(
          (a) => `${absenceLabel(a.type)}${a.fraction === 0.5 ? ' ½' : ''}${a.label ? ` (${a.label})` : ''}`
        ),
        d.note
      ]
        .filter(Boolean)
        .join('; ');
      return [
        formatDate(d.date, 'EEEEEE dd.MM.'),
        d.first !== undefined ? toHHmm(d.first) : '',
        d.last !== undefined && !d.running ? toHHmm(d.last) : '',
        d.pause ? formatMinutes(d.pause) : '',
        d.worked ? formatMinutes(d.worked) : '',
        d.target ? formatMinutes(d.target) : '',
        d.counted && (d.target || d.worked) ? dash(d.delta) : '',
        remarks
      ];
    });
    autoTable(doc, {
      startY: 32,
      head: [[m.date(), m.from(), m.to(), m.pause(), m.worked(), m.target(), m.difference(), m.remarks()]],
      body,
      theme: 'striped',
      headStyles: { fillColor: TEAL },
      styles: { fontSize: 8.5, cellPadding: 1.1 },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { cellWidth: 60 }
      },
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        const day = summary.days[data.row.index];
        if (!day.isWorkday && !day.gross) data.cell.styles.textColor = [150, 150, 150];
      }
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let y = (doc as any).lastAutoTable.finalY + 8;
  const year = Number(start.slice(0, 4));
  const v = ledger.vacation(year);
  const rows: string[][] = [
    [
      m.worked(),
      formatMinutes(summary.worked),
      m.balance_before(),
      formatMinutes(summary.balanceBefore, { sign: true })
    ],
    [
      m.target(),
      formatMinutes(summary.targetToDate),
      m.balance_after(),
      formatMinutes(summary.balanceAfter, { sign: true })
    ],
    [
      m.difference(),
      formatMinutes(summary.delta, { sign: true }),
      m.absence_vacation(),
      `${formatNumber(summary.absenceDays.vacation)} · ${m.vacation_left_short({ left: formatNumber(v.left) })}`
    ],
    [
      m.absence_sick(),
      formatNumber(summary.absenceDays.sick),
      m.absence_comp_time(),
      formatNumber(summary.absenceDays.comp_time)
    ]
  ];
  if (y > 250) {
    doc.addPage();
    y = 20;
  }
  autoTable(doc, {
    startY: y,
    body: rows,
    theme: 'plain',
    styles: { fontSize: 9.5, cellPadding: 1 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 32 },
      1: { cellWidth: 40 },
      2: { fontStyle: 'bold', cellWidth: 44 }
    }
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 18;
  if (y > 275) {
    doc.addPage();
    y = 40;
  }
  doc.setDrawColor(120);
  doc.line(14, y, 90, y);
  doc.line(pageWidth - 90, y, pageWidth - 14, y);
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(`${m.date()}, ${m.signature_employee()}`, 14, y + 4);
  doc.text(`${m.date()}, ${m.signature_supervisor()}`, pageWidth - 90, y + 4);

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`PunchClock · ${formatDate(Date.now(), 'Pp')} · ${i}/${pages}`, 14, 290);
  }
  return new Uint8Array(doc.output('arraybuffer'));
}
