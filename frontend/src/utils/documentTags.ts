/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// The tags the system gives every file (nobody types them), and the document
// type a file's name points to on the upload page.

import type { DocumentAutoTag, DocumentTypeOption } from '../types';
import { titleCase } from './programmeLabel';

/** How a tag reads on a chip: programme names come in capitals from the registry. */
export function tagText(tag: DocumentAutoTag): string {
  return tag.kind === 'programme' ? titleCase(tag.label) : tag.label;
}

// Words that say what kind of paper it is rather than which one.
const GENERIC = new Set(['form', 'report', 'document', 'file', 'copy', 'the', 'and', 'of', 'for']);

const words = (text: string) =>
  text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(word => word.length > 1);

/**
 * The type a file name points to: every telling word of the type's name is in
 * the file name ("Turnitin_report_final.pdf" is a Turnitin Report). The type
 * with the most such words wins; null when none fits.
 */
export function suggestTypeForFile(fileName: string, types: readonly DocumentTypeOption[]): DocumentTypeOption | null {
  const inName = new Set(words(fileName.replace(/\.[^.]+$/, '')));
  let best: DocumentTypeOption | null = null;
  let bestCount = 0;
  for (const type of types) {
    const telling = words(type.label).filter(word => !GENERIC.has(word));
    if (!telling.length || !telling.every(word => inName.has(word))) continue;
    if (telling.length > bestCount) {
      best = type;
      bestCount = telling.length;
    }
  }
  return best;
}

const FROM_LABELS: Record<string, string> = {
  Student: 'Student',
  Lecturer: 'Lecturer',
  'Programme Coordinator': 'Programme coordinator',
  'Office Staff/Admin': 'PG office',
};

/** The tags a file will get, worked out the same way as the server does, for the upload summary. */
export function uploadTags(options: {
  type: DocumentTypeOption | null;
  semester: string | null;
  role: string;
  programmes: string[];
  intakes: string[];
}): DocumentAutoTag[] {
  const { type, semester, role, programmes, intakes } = options;
  if (!type) return [];
  const tags: DocumentAutoTag[] = [{ kind: 'category', label: type.groupLabel, filter: {} }];
  if (type.required) tags.push({ kind: 'required', label: 'Required', filter: {} });
  if (semester) tags.push({ kind: 'semester', label: semester, filter: {} });
  if (FROM_LABELS[role]) tags.push({ kind: 'from', label: FROM_LABELS[role], filter: {} });
  for (const programme of new Set(programmes.map(name => name.trim()).filter(Boolean))) tags.push({ kind: 'programme', label: programme, filter: {} });
  for (const intake of new Set(intakes.map(name => name.trim()).filter(Boolean))) tags.push({ kind: 'intake', label: `Intake ${intake}`, filter: {} });
  return tags;
}
