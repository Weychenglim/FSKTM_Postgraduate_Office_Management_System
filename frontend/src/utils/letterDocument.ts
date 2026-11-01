/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Letter document generation (UC40-UC42).
 *
 * Builds a self-contained, A4-styled HTML document for an official letter and
 * opens it in a new window to print or save as PDF. The output is intentionally
 * dependency-free (no PDF library): the browser's native print dialog produces
 * either a physical printout or a "Save as PDF" file, so it works on any machine
 * and looks exactly like what is rendered.
 *
 * The A4 pages shown in the portal (`LetterPages`) follow the same layout, so a
 * letter viewed on screen looks like its printout. The letterhead constants below
 * are shared by both, and by the PDF copy on the server.
 */

import type { GeneratedLetter, LetterPurpose } from '../types';

/** Static faculty letterhead details, shared by the preview and the printout. */
export const LETTERHEAD = {
  logoPath: '/um-logo.png',
  university: 'Universiti Malaya',
  faculty: 'Faculty of Computer Science & Information Technology',
  addressLines: [
    'Academic Affairs Office, Level 4',
    '50603 Kuala Lumpur, Malaysia',
    '+603-7967 6300  |  pg.fsktm@um.edu.my',
  ],
  malayFaculty: 'Fakulti Sains Komputer & Teknologi Maklumat',
  malayAddressLines: [
    'Pejabat Hal Ehwal Akademik, Aras 4',
    '50603 Kuala Lumpur, Malaysia',
    '+603-7967 6300  |  pg.fsktm@um.edu.my',
  ],
  recipient: 'TO WHOM IT MAY CONCERN',
  disclaimer:
    "This letter is issued upon the student's request for official purposes only. " +
    'Any alteration to this document shall render it invalid.',
  appointmentDisclaimer:
    'This letter is issued by the postgraduate office for official purposes only. ' +
    'Any alteration to this document shall render it invalid.',
  malayDisclaimer:
    'Surat ini dikeluarkan atas permintaan pelajar untuk urusan rasmi sahaja. ' +
    'Sebarang pindaan pada dokumen ini menjadikannya tidak sah.',
  malayAppointmentDisclaimer:
    'Surat ini dikeluarkan oleh pejabat pascasiswazah untuk urusan rasmi sahaja. ' +
    'Sebarang pindaan pada dokumen ini menjadikannya tidak sah.',
  signatoryName: 'Dean of Postgraduate Studies',
  signatoryOffice: 'FSKTM Office Executive Secretariat',
  malaySignatoryName: 'Dekan Pengajian Pascasiswazah',
  malaySignatoryOffice: 'Sekretariat Eksekutif Pejabat FSKTM',
} as const;

export type LetterLanguage = 'en' | 'ms';

/** The words printed around the body, on the English page and the Malay one. */
export const LETTER_WORDS = {
  en: { reference: 'Our Ref', date: 'Date', stamp: 'Computer-generated. Verify with the PG Office.', page: 'Page', of: 'of', continued: 'continued' },
  ms: { reference: 'Rujukan Kami', date: 'Tarikh', stamp: 'Dijana oleh komputer. Sahkan dengan Pejabat PG.', page: 'Muka surat', of: 'daripada', continued: 'sambungan' },
} as const;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MALAY_MONTHS = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];

/** A letter date in Malay: "23 October 2026" becomes "23 Oktober 2026". */
export function malayLetterDate(date: string): string {
  return date.replace(/[A-Za-z]+/g, (word) => {
    const index = MONTHS.findIndex((month) => month.toLowerCase() === word.toLowerCase());
    if (index < 0) return word;
    return word === word.toUpperCase() ? MALAY_MONTHS[index].toUpperCase() : MALAY_MONTHS[index];
  });
}

/** Everything needed to render one letter (body is already substituted). */
export interface LetterData {
  templateName: string;
  refNo: string;
  date: string;
  /** Letter body with placeholders already filled in. Blank lines = paragraphs. */
  bodyParagraphs: string;
  /** The Malay page's body, printed as a second page when there is one. */
  bodyParagraphsMs?: string;
  /** Used only to name the saved PDF file. */
  studentName: string;
  matricNumber: string;
  /** The closing lines; the faculty defaults when left out. */
  disclaimer?: string;
  malayDisclaimer?: string;
  signatoryName?: string;
  signatoryOffice?: string;
  malaySignatoryName?: string;
  malaySignatoryOffice?: string;
}

/** The placeholder tags a template author can use, with friendly labels. */
export const LETTER_PLACEHOLDERS: ReadonlyArray<{ tag: string; label: string }> = [
  { tag: '{{STUDENT_NAME}}', label: 'Student Name' },
  { tag: '{{STUDENT_ID}}', label: 'Matric Number' },
  { tag: '{{PROGRAMME_NAME}}', label: 'Programme' },
  { tag: '{{CURRENT_STATUS}}', label: 'Current Status' },
  { tag: '{{SUPERVISOR_NAME}}', label: 'Supervisor' },
  { tag: '{{REFERENCE_NUMBER}}', label: 'Reference No.' },
  { tag: '{{CURRENT_DATE}}', label: 'Date' },
  // Visa / immigration + programme fields. Filled from the student's registry
  // record (StudentRegistry) when available, else a blank fill-in line.
  { tag: '{{PASSPORT_NUMBER}}', label: 'Passport No.' },
  { tag: '{{COUNTRY}}', label: 'Country' },
  { tag: '{{PROGRAMME_MODE}}', label: 'Programme Mode' },
  { tag: '{{FIELD_OF_RESEARCH}}', label: 'Field of Research' },
  { tag: '{{MODE_OF_STUDY}}', label: 'Mode of Study' },
  { tag: '{{INITIAL_SEMESTER}}', label: 'Initial Semester' },
  { tag: '{{CURRENT_SEMESTER}}', label: 'Current Semester' },
  { tag: '{{MAX_SEMESTER}}', label: 'Maximum Semester' },
  { tag: '{{EXPECTED_COMPLETION}}', label: 'Expected Completion' },
];

const APPOINTMENT_LETTERS: ReadonlyArray<LetterPurpose> = ['SUPERVISOR_APPOINTMENT', 'PANEL_APPOINTMENT', 'CO_SUPERVISOR_APPOINTMENT'];

/** What each kind of template is called where its tags are explained. */
const PURPOSE_PLURAL: Record<LetterPurpose, string> = {
  REQUEST: 'student request letters',
  SUPERVISOR_APPOINTMENT: 'supervisor appointment letters',
  PANEL_APPOINTMENT: 'panel appointment letters',
  CO_SUPERVISOR_APPOINTMENT: 'supporting supervisor appointment letters',
};

export const isAppointmentLetter = (purpose: LetterPurpose | undefined) => !!purpose && APPOINTMENT_LETTERS.includes(purpose);

/**
 * Tags only some letter kinds may use: appointment letters' tags, filled from
 * the approved appointment, and request letters' tags, filled from who the
 * student said the letter is for.
 */
export const APPOINTMENT_PLACEHOLDERS: ReadonlyArray<{ tag: string; label: string; purposes: ReadonlyArray<LetterPurpose> }> = [
  { tag: '{{RESEARCH_TITLE}}', label: 'Research Title', purposes: APPOINTMENT_LETTERS },
  { tag: '{{RESEARCH_AREA}}', label: 'Research Area', purposes: APPOINTMENT_LETTERS },
  { tag: '{{COURSE_CODES}}', label: 'Course Codes', purposes: APPOINTMENT_LETTERS },
  { tag: '{{SUPERVISOR_DEPARTMENT}}', label: 'Supervisor Department', purposes: APPOINTMENT_LETTERS },
  { tag: '{{SUPERVISOR_ACCEPTED_DATE}}', label: 'Supervisor Accepted On', purposes: ['SUPERVISOR_APPOINTMENT'] },
  { tag: '{{PANEL_NAME}}', label: 'Panel Member', purposes: ['PANEL_APPOINTMENT'] },
  { tag: '{{PANEL_DEPARTMENT}}', label: 'Panel Department', purposes: ['PANEL_APPOINTMENT'] },
  { tag: '{{PANEL_ACCEPTED_DATE}}', label: 'Panel Accepted On', purposes: ['PANEL_APPOINTMENT'] },
  { tag: '{{CO_SUPERVISOR_NAME}}', label: 'Supporting Supervisor', purposes: ['CO_SUPERVISOR_APPOINTMENT'] },
  { tag: '{{CO_SUPERVISOR_DEPARTMENT}}', label: 'Supporting Supervisor Department', purposes: ['CO_SUPERVISOR_APPOINTMENT'] },
  { tag: '{{CO_SUPERVISOR_ACCEPTED_DATE}}', label: 'Supporting Supervisor Accepted On', purposes: ['CO_SUPERVISOR_APPOINTMENT'] },
  { tag: '{{COORDINATOR_NAME}}', label: 'Approved By', purposes: APPOINTMENT_LETTERS },
  { tag: '{{APPROVED_DATE}}', label: 'Approved On', purposes: APPOINTMENT_LETTERS },
  { tag: '{{APPOINTMENT_DATE}}', label: 'Appointment Date', purposes: APPOINTMENT_LETTERS },
  { tag: '{{SEMESTER}}', label: 'Semester', purposes: APPOINTMENT_LETTERS },
  { tag: '{{RECIPIENT}}', label: 'Recipient', purposes: ['REQUEST'] },
  { tag: '{{VALID_UNTIL}}', label: 'Valid Until', purposes: ['REQUEST'] },
  { tag: '{{BALANCE_SEMESTERS_MIN}}', label: 'Semesters Left (Minimum)', purposes: ['REQUEST'] },
  { tag: '{{BALANCE_SEMESTERS_MAX}}', label: 'Semesters Left (Maximum)', purposes: ['REQUEST'] },
];

const KNOWN_TAGS = new Set(LETTER_PLACEHOLDERS.map((p) => p.tag));
const ALL_TAGS = new Set([...KNOWN_TAGS, ...APPOINTMENT_PLACEHOLDERS.map((p) => p.tag)]);
const TAG_PURPOSES = new Map(APPOINTMENT_PLACEHOLDERS.map((p) => [p.tag, p.purposes]));

/** The tags a template used for `purpose` may use, besides its own fields. */
export function placeholdersFor(purpose: LetterPurpose = 'REQUEST') {
  return [...LETTER_PLACEHOLDERS, ...APPOINTMENT_PLACEHOLDERS.filter((p) => p.purposes.includes(purpose))];
}

/** For a tag only some letter kinds may use, which ones; else null. Same wording as the server. */
export function placeholderPurposeHint(tag: string): string | null {
  const purposes = TAG_PURPOSES.get(tag);
  if (!purposes) return null;
  const kinds = purposes === APPOINTMENT_LETTERS ? 'appointment letters' : purposes.map((p) => PURPOSE_PLURAL[p]).join(' and ');
  return `${tag} works only in ${kinds}.`;
}
const TOKEN_RE = /\{\{([^{}]*)\}\}/g;
const TRIPLE_RE = /\{\{\{[^{}]*\}\}\}/g;
const STRAY_BRACES_RE = /\{\{[^{}\n]{0,40}|[^{}\n]{0,40}\}\}/g;
// A tag typed with single braces, e.g. {STUDENT_NAME}, would print literally.
// Ordinary braces in prose ("{text}") are left alone.
const SINGLE_TAG_RE = /(?<!\{)\{[A-Z_]+\}(?!\})/g;

/**
 * The same check the server runs before saving (`letters/placeholders.py`):
 * tags that are not supported, tags in triple or single braces, and
 * `{{`/`}}` pairs that are not a well-formed `{{NAME}}` tag. The template's own
 * office-filled fields (`customNames`) count as supported, and so do the
 * appointment tags its `purpose` allows.
 */
export function findPlaceholderProblems(
  content: string,
  customNames: readonly string[] = [],
  purpose: LetterPurpose = 'REQUEST',
): { unknown: string[]; malformed: string[] } {
  const own = new Set(customNames.map((name) => `{{${name}}}`));
  const allowed = new Set(placeholdersFor(purpose).map((p) => p.tag));
  const unknown: string[] = [];
  const malformed: string[] = [...(content.match(TRIPLE_RE) ?? [])];
  const rest = content.replace(TRIPLE_RE, ' ');
  for (const [token, name] of rest.matchAll(TOKEN_RE)) {
    if (!/^[A-Z_]+$/.test(name)) malformed.push(token);
    else if (!allowed.has(token) && !own.has(token)) unknown.push(token);
  }
  const leftover = rest.replace(TOKEN_RE, ' ');
  malformed.push(...(leftover.match(SINGLE_TAG_RE) ?? []));
  for (const stray of leftover.replace(SINGLE_TAG_RE, ' ').match(STRAY_BRACES_RE) ?? []) {
    malformed.push(stray.trim());
  }
  return { unknown: [...new Set(unknown)], malformed: [...new Set(malformed)] };
}

// Chip colours in the preview: built-in placeholders, office-filled fields,
// and tags that are not supported.
const TAG_STYLES = {
  builtIn: { background: '#0c1424', color: '#a5b4fc', title: '' },
  office: { background: '#fef3c7', color: '#92400e', title: 'Filled in by the office when approving' },
  unknown: { background: '#fee2e2', color: '#b91c1c', title: 'Unknown placeholder' },
} as const;

/**
 * Apply the inline text markup to one line: `**bold**`, `__underline__`,
 * `*italic*`. The text is HTML-escaped first, then only our own safe tags are
 * added, so it's safe to inject with `dangerouslySetInnerHTML` / into the print
 * window. When `highlightPlaceholders` is on (the staff editor preview), any
 * leftover `{{TAG}}` is wrapped in a highlight chip.
 */
function applyInlineMarkup(raw: string, highlightPlaceholders: boolean, officeTags: ReadonlySet<string>, tagLabels?: ReadonlyMap<string, string>): string {
  let s = esc(raw);
  s = s.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>'); // bold (before italic)
  s = s.replace(/__([^_]+?)__/g, '<u>$1</u>'); // underline (double underscore)
  s = s.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>'); // italic (single asterisk)
  if (highlightPlaceholders) {
    s = s.replace(/\{\{[A-Z_]+\}\}/g, (tag) => {
      const look = ALL_TAGS.has(tag) ? TAG_STYLES.builtIn : officeTags.has(tag) ? TAG_STYLES.office : TAG_STYLES.unknown;
      return (
        `<span${look.title ? ` title="${look.title}"` : ''} style="background:${look.background};` +
        `color:${look.color};font-family:ui-monospace,monospace;` +
        `font-weight:800;font-size:.85em;padding:1px 6px;border-radius:4px;">${esc(tagLabels?.get(tag) ?? tag)}</span>`
      );
    });
  }
  return s;
}

/**
 * Render a letter body (with the lightweight markup authored in the template
 * editor) into a safe HTML string. Shared by the staff editor preview, the
 * student preview, and the printed PDF so all three look identical.
 *
 * Supported markup: `**bold**`, `*italic*`, `__underline__`, blank lines start a
 * new paragraph, lines beginning with `- ` become a bullet list, and lines like
 * `| Name | {{STUDENT_NAME}} |` become rows of a details table.
 */
const DETAIL_ROW_RE = /^\s*\|(.*)\|\s*$/;

export function renderLetterBodyHtml(
  body: string,
  opts?: { highlightPlaceholders?: boolean; officeFields?: readonly string[]; tagLabels?: ReadonlyMap<string, string> },
): string {
  const highlight = opts?.highlightPlaceholders ?? false;
  const officeTags = new Set((opts?.officeFields ?? []).map((name) => `{{${name}}}`));
  const labels = opts?.tagLabels;
  return body
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split('\n');
      const bulletLines = lines.filter((l) => /^\s*-\s+/.test(l));
      const nonEmpty = lines.filter((l) => l.trim() !== '');
      // A block is a bullet list when every non-empty line is a "- " item.
      if (bulletLines.length > 0 && bulletLines.length === nonEmpty.length) {
        const items = bulletLines
          .map(
            (l) =>
              `<li style="margin:0 0 4px;">${applyInlineMarkup(
                l.replace(/^\s*-\s+/, ''),
                highlight,
                officeTags,
                labels,
              )}</li>`,
          )
          .join('');
        return `<ul style="margin:0 0 14px;padding-left:22px;list-style:disc;">${items}</ul>`;
      }
      if (nonEmpty.length > 0 && nonEmpty.every((l) => DETAIL_ROW_RE.test(l))) {
        const rows = nonEmpty
          .map((l) => {
            const [label, ...rest] = (l.match(DETAIL_ROW_RE)?.[1] ?? '').split('|').map((cell) => cell.trim());
            const cell = 'padding:1px 0;vertical-align:top;';
            return (
              `<tr><td style="${cell}width:36%;padding-right:10px;">${applyInlineMarkup(label, highlight, officeTags, labels)}</td>` +
              `<td style="${cell}width:14px;">:</td>` +
              `<td style="${cell}">${applyInlineMarkup(rest.join(' '), highlight, officeTags, labels)}</td></tr>`
            );
          })
          .join('');
        return `<table style="width:100%;border-collapse:collapse;margin:0 0 14px;"><tbody>${rows}</tbody></table>`;
      }
      const html = lines.map((l) => applyInlineMarkup(l, highlight, officeTags, labels)).join('<br>');
      return `<p style="margin:0 0 14px;">${html}</p>`;
    })
    .join('');
}

/**
 * Fill each `{{NAME}}` in `content` that has a non-blank value in `values`
 * (keyed by placeholder name); the rest stay as tags, so a preview can show
 * what is still to be filled in.
 */
export function fillLetterTags(content: string, values: Readonly<Record<string, string | undefined>>): string {
  return content.replace(/\{\{([A-Z_]+)\}\}/g, (token, name: string) => {
    const value = values[name]?.trim();
    return value ? value : token;
  });
}

// Office-filled field names: capitals and underscores, as the server requires.
export const FIELD_NAME_PATTERN = /^[A-Z][A-Z_]{1,39}$/;
const BUILT_IN_NAMES = new Set([...LETTER_PLACEHOLDERS, ...APPOINTMENT_PLACEHOLDERS].map((p) => p.tag.slice(2, -2)));

/** Why a new office-filled field name cannot be used, or null. */
export function fieldNameProblem(name: string, taken: readonly string[]): string | null {
  if (!FIELD_NAME_PATTERN.test(name)) return 'Use 2 to 40 capital letters or underscores, for example ATTENDANCE.';
  if (BUILT_IN_NAMES.has(name)) return `{{${name}}} is already a built-in placeholder.`;
  if (taken.includes(name)) return `{{${name}}} is already one of this template's fields.`;
  return null;
}

/**
 * A tag name made from a field's label: "Attendance (%)" becomes ATTENDANCE.
 * Letters only (no digits, as the server requires); a name already in use gets
 * a letter suffix, e.g. ATTENDANCE_B.
 */
export function fieldNameFromLabel(label: string, taken: readonly string[]): string {
  const base =
    label
      .toUpperCase()
      .replace(/[^A-Z]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 36)
      .replace(/_+$/, '') || 'FIELD';
  const name = base.length < 2 ? `${base}_FIELD` : base;
  if (!fieldNameProblem(name, taken)) return name;
  for (const suffix of 'BCDEFGHIJKLMNOPQRSTUVWXYZ') {
    const candidate = `${name}_${suffix}`;
    if (!fieldNameProblem(candidate, taken)) return candidate;
  }
  return name;
}

/** Today's date, formatted for a letter ("05 June 2026"). */
export function formatLetterDate(date: Date = new Date()): string {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

/** What the reference line shows before the office approves a request. */
export const PENDING_REFERENCE = 'Assigned on approval';

/**
 * The closing lines of a letter: the template's own signatory, else the faculty
 * default. The Malay page takes its own lines, then the English ones, then the
 * Malay default.
 */
export function letterClosing(letter: Pick<GeneratedLetter, 'purpose' | 'signatoryName' | 'signatoryTitle' | 'signatoryNameMs' | 'signatoryTitleMs'>) {
  const appointment = isAppointmentLetter(letter.purpose);
  const name = letter.signatoryName?.trim();
  const title = letter.signatoryTitle?.trim();
  return {
    disclaimer: appointment ? LETTERHEAD.appointmentDisclaimer : LETTERHEAD.disclaimer,
    malayDisclaimer: appointment ? LETTERHEAD.malayAppointmentDisclaimer : LETTERHEAD.malayDisclaimer,
    signatoryName: name || LETTERHEAD.signatoryName,
    signatoryOffice: title || LETTERHEAD.signatoryOffice,
    malaySignatoryName: letter.signatoryNameMs?.trim() || name || LETTERHEAD.malaySignatoryName,
    malaySignatoryOffice: letter.signatoryTitleMs?.trim() || title || LETTERHEAD.malaySignatoryOffice,
  };
}

/** Print data for a letter the server has issued (needs its `content`). */
export function letterDataFromIssued(letter: GeneratedLetter): LetterData {
  return {
    templateName: letter.templateName,
    refNo: letter.referenceNumber,
    date: letter.date,
    bodyParagraphs: letter.content ?? '',
    ...(letter.contentMs?.trim() ? { bodyParagraphsMs: letter.contentMs } : {}),
    studentName: letter.studentName,
    matricNumber: letter.matricNumber,
    ...letterClosing(letter),
  };
}

/** Escape text so it is safe to drop into the generated HTML. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Build a filesystem-friendly file name (the saved PDF and the Word download). */
export function letterFileName(data: LetterData): string {
  const slug = data.templateName.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
  const id = data.matricNumber.replace(/[^a-z0-9]+/gi, '');
  return `UM_${slug}${id ? `_${id}` : ''}`;
}

/**
 * Return a complete, standalone HTML document string for the given letter.
 * Exposed (not just used internally) so it can be unit-tested or reused.
 */
export function buildLetterHtml(data: LetterData): string {
  // Same-origin absolute URL so the logo resolves inside the new window.
  const logoUrl = `${window.location.origin}${LETTERHEAD.logoPath}`;
  const title = letterFileName(data);

  // The body goes through the shared markup formatter, so the printed letter
  // matches the on-screen preview exactly.
  const sheet = (body: string, language: LetterLanguage) => {
    const words = LETTER_WORDS[language];
    const malay = language === 'ms';
    const disclaimer = malay ? data.malayDisclaimer ?? LETTERHEAD.malayDisclaimer : data.disclaimer ?? LETTERHEAD.disclaimer;
    const name = malay ? data.malaySignatoryName ?? LETTERHEAD.malaySignatoryName : data.signatoryName ?? LETTERHEAD.signatoryName;
    const office = malay ? data.malaySignatoryOffice ?? LETTERHEAD.malaySignatoryOffice : data.signatoryOffice ?? LETTERHEAD.signatoryOffice;
    const addressHtml = (malay ? LETTERHEAD.malayAddressLines : LETTERHEAD.addressLines).map((line) => esc(line)).join('<br>');
    return `<div class="sheet">
    <div class="header">
      <div class="brand">
        <img src="${logoUrl}" alt="Universiti Malaya" />
        <div class="faculty">${esc(malay ? LETTERHEAD.malayFaculty : LETTERHEAD.faculty)}</div>
      </div>
      <div class="address">${addressHtml}</div>
    </div>

    <div class="meta">
      <div>${words.reference}: <span class="value">${esc(data.refNo)}</span></div>
      <div>${words.date}: <span class="value">${esc(malay ? malayLetterDate(data.date) : data.date)}</span></div>
    </div>

    ${renderLetterBodyHtml(body)}

    <p class="disclaimer">${esc(disclaimer)}</p>

    <div class="signature">
      <div>
        <div class="line"></div>
        <div class="name">${esc(name)}</div>
        <div class="office">${esc(office)}</div>
      </div>
      <div class="stamp">${esc(words.stamp)}</div>
    </div>
  </div>`;
  };
  const sheets = [sheet(data.bodyParagraphs, 'en'), ...(data.bodyParagraphsMs?.trim() ? [sheet(data.bodyParagraphsMs, 'ms')] : [])];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>
  <style>
    @page { size: A4; margin: 18mm 16mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Calibri, Arial, sans-serif;
      color: #1e293b;
      font-size: 12px;
      line-height: 1.6;
      background: #f1f5f9;
    }
    .sheet {
      background: #ffffff;
      width: 210mm;
      margin: 0 auto;
      padding: 18mm 16mm;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      border-bottom: 2.5px solid #0c1424;
      padding-bottom: 14px;
    }
    .header .brand { display: flex; align-items: center; gap: 12px; }
    .header img { height: 46px; width: auto; }
    .header .faculty {
      font-size: 9px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .4px; color: #475569; max-width: 150px; line-height: 1.3;
    }
    .header .address {
      text-align: right; font-size: 8.5px; font-weight: 600;
      color: #64748b; line-height: 1.7; max-width: 230px;
    }
    .meta {
      display: flex; justify-content: space-between;
      font-family: 'Courier New', monospace; font-size: 10px;
      color: #475569; margin: 22px 0 18px;
    }
    .meta .value { color: #0f172a; font-weight: 700; }
    .recipient {
      text-align: center; font-weight: 800; text-transform: uppercase;
      letter-spacing: 1px; font-size: 13px; color: #0f172a;
      border-top: 1px dashed #cbd5e1; border-bottom: 1px dashed #cbd5e1;
      padding: 6px 0; margin-bottom: 20px;
    }
    p.body { margin: 0 0 16px; font-weight: 500; color: #1e293b; }
    table.details {
      width: 100%; border-collapse: collapse; margin: 0 0 18px;
      border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;
    }
    table.details th, table.details td {
      text-align: left; padding: 9px 12px; border-bottom: 1px solid #eef2f6;
      vertical-align: middle;
    }
    table.details tr:last-child th, table.details tr:last-child td { border-bottom: 0; }
    table.details th {
      width: 34%; font-size: 9.5px; font-weight: 800; text-transform: uppercase;
      letter-spacing: .5px; color: #64748b; background: #f8fafc;
    }
    table.details td { font-size: 12px; font-weight: 700; color: #0f172a; }
    .disclaimer { font-size: 10px; color: #64748b; font-weight: 600; margin: 4px 0 0; }
    .signature {
      display: flex; justify-content: space-between; align-items: flex-end;
      border-top: 1px solid #e2e8f0; padding-top: 18px; margin-top: 56px;
      /* Keep the whole signature block together; never split it across pages. */
      break-inside: avoid; page-break-inside: avoid;
    }
    .signature .line { width: 150px; border-bottom: 1px solid #94a3b8; height: 22px; margin-bottom: 6px; }
    .signature .name { font-weight: 800; color: #0f172a; }
    .signature .office {
      font-size: 8px; font-weight: 800; text-transform: uppercase;
      letter-spacing: 1px; color: #94a3b8; margin-top: 2px;
    }
    .signature .stamp {
      font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px;
      color: #4f46e5; border: 1px solid #c7d2fe; background: #eef2ff;
      border-radius: 8px; padding: 6px 10px; text-align: center; line-height: 1.5;
      max-width: 170px;
    }
    .sheet + .sheet { margin-top: 12px; break-before: page; page-break-before: always; }
    @media print {
      body { background: #ffffff; }
      .sheet { width: auto; margin: 0; padding: 0; box-shadow: none; }
      .sheet + .sheet { margin-top: 0; }
    }
  </style>
</head>
<body>
  ${sheets.join('\n  ')}
</body>
</html>`;
}

/**
 * Open an empty window for a letter during the click itself, so pop-up
 * blockers allow it even though the letter arrives from the server a moment
 * later. Null when the browser blocked it.
 */
export function openLetterWindow(): Window | null {
  return window.open('', '_blank', 'width=900,height=1040');
}

/**
 * Open the letter in a new window and trigger the print / Save-as-PDF dialog.
 * Returns `false` if the browser blocked the pop-up so the caller can prompt the
 * user to allow pop-ups for this site.
 */
export function openLetterDocument(data: LetterData): boolean {
  const win = openLetterWindow();
  if (!win) return false;
  printLetterInWindow(win, data);
  return true;
}

/** Write the letter into `win` (from `openLetterWindow`) and show the print dialog. */
export function printLetterInWindow(win: Window, data: LetterData): void {
  win.document.open();
  win.document.write(buildLetterHtml(data));
  // Register from the trusted application bundle so the generated document
  // needs no inline script under the production Content Security Policy.
  win.addEventListener(
    'load',
    () => {
      win.focus();
      win.print();
    },
    { once: true },
  );
  win.addEventListener('afterprint', () => win.close(), { once: true });
  win.document.close();
}
