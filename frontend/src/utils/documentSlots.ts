// A student's File Submission as one row per document: grouped by research
// project stage, their own stage first, each row with its due date or the time it
// was sent and the one thing to do next.

import type { DocumentTypeOption, PortalDocument } from '../types';
import type { MySubmission } from '../services/submissionsApi';
import { historyTime, shortDocumentDate } from './documentDisplay';
import { durationText, timeLeftText } from './submissions';
import { typeGroups } from './documentUpload';

export type SlotTone = 'due' | 'late' | 'sent' | 'plain' | 'closed';
export type SlotAction = 'Upload' | 'Replace' | null;

export interface DocumentSlot {
  key: string;
  name: string;
  line: string;
  tone: SlotTone;
  action: SlotAction;
  type: DocumentTypeOption | null;
  submission: MySubmission | null;
  document: PortalDocument | null;
}

export interface SlotGroup {
  key: string;
  label: string;
  now: boolean;
  rows: DocumentSlot[];
  addType: DocumentTypeOption | null;
}

const STAGE_GROUP: Record<string, string> = { P1: 'RP1', P2: 'RP2' };

function submissionRow(submission: MySubmission, name: string, type: DocumentTypeOption, document: PortalDocument | null, now: number): DocumentSlot {
  const base = { key: `s${submission.id}`, name, type, submission, document };
  if (submission.state !== 'NOT_SENT') {
    const late = submission.lateBySeconds ? `, ${durationText(submission.lateBySeconds)} late` : ', on time';
    return {
      ...base,
      line: `Sent ${historyTime(submission.sentAt ?? '')}${late}`,
      tone: submission.state === 'LATE' ? 'late' : 'sent',
      action: submission.canSend ? 'Replace' : null,
    };
  }
  if (!submission.canSend) return { ...base, line: submission.why || 'Closed', tone: 'closed', action: null };
  if (submission.lateIfSentNow) return { ...base, line: `Due ${historyTime(submission.dueAt)} · will be marked late`, tone: 'late', action: 'Upload' };
  return { ...base, line: `Due ${historyTime(submission.dueAt)} · ${timeLeftText(submission.dueAt, now)}`, tone: 'due', action: 'Upload' };
}

function fileRow(document: PortalDocument, name: string, type: DocumentTypeOption | null, action: SlotAction): DocumentSlot {
  return { key: `d${document.id}`, name, line: `Sent ${shortDocumentDate(document.uploadedAt)}`, tone: 'sent', action, type, submission: null, document };
}

/** The rows of the student's Documents view. */
export function documentSlots(
  types: DocumentTypeOption[],
  stage: string,
  files: PortalDocument[],
  submissions: MySubmission[],
  now: number,
): SlotGroup[] {
  const used = new Set<number>();
  const byId = new Map(files.map(file => [file.id, file]));
  const groups = typeGroups(types, stage).map((group): SlotGroup => {
    const rows: DocumentSlot[] = [];
    let addType: DocumentTypeOption | null = null;
    for (const type of group.types) {
      const asked = submissions.filter(item => item.type.code === type.code);
      const own = files.filter(file => file.type.code === type.code);
      if (type.onePerStudent) {
        const current = own[0] ?? null;
        if (current) used.add(current.id);
        if (asked.length) {
          for (const submission of asked) {
            const sent = submission.documentId ? byId.get(submission.documentId) ?? current : current;
            if (sent) used.add(sent.id);
            rows.push(submissionRow(submission, asked.length > 1 ? submission.title : type.label, type, sent, now));
          }
        } else if (current) {
          rows.push({ ...fileRow(current, type.label, type, 'Replace'), key: `t${type.code}` });
        } else {
          rows.push({ key: `t${type.code}`, name: type.label, line: 'Not sent', tone: 'plain', action: 'Upload', type, submission: null, document: null });
        }
        continue;
      }
      for (const submission of asked) {
        const sent = submission.documentId ? byId.get(submission.documentId) ?? null : null;
        if (sent) used.add(sent.id);
        rows.push(submissionRow(submission, submission.title, type, sent, now));
      }
      for (const file of own) {
        if (used.has(file.id)) continue;
        used.add(file.id);
        rows.push(fileRow(file, file.title, type, null));
      }
      addType = type;
    }
    return { key: group.group, label: group.label, now: STAGE_GROUP[stage] === group.group, rows, addType };
  });
  const others = files.filter(file => !used.has(file.id));
  if (others.length) {
    groups.push({ key: 'OTHER', label: 'Other files', now: false, rows: others.map(file => fileRow(file, file.title, null, null)), addType: null });
  }
  return groups.filter(group => group.rows.length || group.addType);
}

/** "Add a supporting document" */
export const addLabel = (type: DocumentTypeOption) => `Add a ${type.label.toLowerCase()}`;
