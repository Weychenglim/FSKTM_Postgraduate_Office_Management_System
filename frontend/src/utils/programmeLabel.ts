/**
 * Programme names arrive in two styles: "MASTER OF DATA SCIENCE (COURSEWORK)"
 * from the approved list, and older records like "Master of Computer Science
 * (By Coursework)". Split them into the field and the level/mode so the
 * registry can show "Data Science" with "Master · Coursework" beneath it.
 */

const SMALL_WORDS = new Set(['of', 'and', 'in', 'by', 'for', 'the']);

export function titleCase(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => (index > 0 && SMALL_WORDS.has(word) ? word : word.replace(/[a-z]/, letter => letter.toUpperCase())))
    .join(' ');
}

export function describeProgramme(label: string): { field: string; detail: string } {
  const cleaned = label.trim();
  const match = cleaned.match(/^(master|doctor|bachelor)\s+of\s+(.+?)\s*\((?:by\s+)?([^)]+)\)$/i);
  if (!match) return { field: cleaned || 'Not set', detail: '' };
  return { field: titleCase(match[2]), detail: `${titleCase(match[1])} · ${titleCase(match[3])}` };
}
