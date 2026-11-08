/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IconHeading } from './IconHeading';
import React from 'react';
import { AlertTriangle, CheckCircle, Download, X } from 'lucide-react';
import { PortalButton } from './PortalPrimitives';
import { THIN_SCROLLBAR } from '../utils/scrollbar';
import { derivedNotes, differenceWarning, rowExplanation } from '../utils/registryImport';
import type { ImportCommitResponse, ImportPreviewRow } from '../types';

interface RegistryImportResultProps {
  result: ImportCommitResponse;
  onDownloadReport: () => void;
  onClose: () => void;
}

const ResultList: React.FC<{ title: string; note?: string; rows: ImportPreviewRow[] }> = ({ title, note, rows }) => (
  <div className="space-y-2">
    <h4 className="text-[10px] uppercase font-black tracking-wider text-slate-500">
      {title} ({rows.length})
    </h4>
    {note && <p className="text-[11px] font-semibold text-slate-500">{note}</p>}
    <ul className={`max-h-56 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-150 ${THIN_SCROLLBAR}`}>
      {rows.map((row) => {
        const warning = differenceWarning(row);
        const explanation = rowExplanation(row);
        return (
          <li key={row.line} className="px-3 py-2.5 text-left">
            <p className="text-[11.5px] font-bold text-slate-800">
              <span className="font-mono text-slate-500 mr-2">{row.id || 'No ID'}</span>
              {row.name || 'No name'}
              <span className="ml-2 text-[10px] font-semibold text-slate-400">line {row.line}</span>
            </p>
            {explanation && <p className="text-[11px] font-semibold text-slate-500 mt-0.5">{explanation}</p>}
            {derivedNotes(row).map((note) => (
              <p key={note} className="text-[11px] font-bold text-indigo-600 mt-0.5 break-all">
                {note}
              </p>
            ))}
            {warning && (
              <p className="text-[11px] font-bold text-amber-700 mt-0.5 flex items-start gap-1">
                <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
                <span>{warning}</span>
              </p>
            )}
          </li>
        );
      })}
    </ul>
  </div>
);

/** What an import did, row by row, so nothing is skipped without the office seeing it. */
export const RegistryImportResult: React.FC<RegistryImportResultProps> = ({
  result,
  onDownloadReport,
  onClose,
}) => {
  const { batch, rows } = result;
  const registered = rows.filter((row) => row.result === 'skipped' && row.status === 'Already Registered');
  const repeated = rows.filter((row) => row.result === 'skipped' && row.status === 'Duplicate In File');
  const programmeSkipped = rows.filter((row) => row.result === 'skipped' && row.status === 'Programme Skipped');
  const notImported = rows.filter((row) => row.result === 'failed');
  const emailNotSent = rows.filter(
    (row) => row.result === 'created' && row.invitationSent === false,
  );
  const filled = rows.filter((row) => row.result === 'created' && row.emailFilled);
  const counts = [
    { label: 'Created', value: batch.created, tone: 'text-emerald-700' },
    { label: 'Already registered', value: registered.length, tone: 'text-sky-700' },
    { label: 'Repeated in file', value: repeated.length, tone: 'text-slate-600' },
    { label: 'Programme skipped', value: programmeSkipped.length, tone: 'text-slate-600' },
    { label: 'Not imported', value: notImported.length, tone: 'text-rose-700' },
    { label: 'Emails filled', value: filled.length, tone: 'text-indigo-700' },
    { label: 'Emails not sent', value: emailNotSent.length, tone: 'text-amber-700' },
  ].filter((count, index) => index === 0 || count.value > 0);

  return (
    <section
      id="registry-import-result"
      aria-labelledby="registry-import-result-title"
      className="bg-white border border-emerald-200 rounded-2xl p-6 shadow-3xs space-y-5 text-left"
    >
      <div className="flex items-start justify-between gap-3">
        <IconHeading as="h3" titleId="registry-import-result-title" title="Import Finished" description={batch.fileName}
          descriptionClassName="text-[11px] text-slate-500 font-semibold mt-0.5 break-all"
          icon={<span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0"><CheckCircle className="w-5 h-5" /></span>}
        />
        <PortalButton variant="ghost" size="icon" icon={X} aria-label="Close the import result" onClick={onClose} />
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {counts.map((count) => (
          <div key={count.label} className="rounded-xl border border-slate-150 bg-slate-50/60 px-3 py-2.5">
            <dt className="text-[9.5px] uppercase font-black tracking-wider text-slate-400">{count.label}</dt>
            <dd className={`text-xl font-extrabold mt-0.5 ${count.tone}`}>{count.value}</dd>
          </div>
        ))}
      </dl>

      {registered.length > 0 && (
        <ResultList
          title="Already registered, so skipped"
          note="Already have an account. Not changed."
          rows={registered}
        />
      )}
      {repeated.length > 0 && <ResultList title="Repeated in this file, so skipped" rows={repeated} />}
      {programmeSkipped.length > 0 && (
        <ResultList
          title="Programme skipped"
          note="Skipped programmes."
          rows={programmeSkipped}
        />
      )}
      {notImported.length > 0 && (
        <ResultList
          title="Not imported"
          note="Fix them below and import again."
          rows={notImported}
        />
      )}
      {filled.length > 0 && (
        <ResultList
          title="Emails filled from the Student ID"
          note="Emails go to their SiswaMail address."
          rows={filled}
        />
      )}
      {emailNotSent.length > 0 && (
        <ResultList
          title="Created, but the activation email was not sent"
          note="Send them from each student's record."
          rows={emailNotSent}
        />
      )}

      <div className="flex justify-end">
        <PortalButton variant="secondary" size="sm" icon={Download} onClick={onDownloadReport}>
          Download Import Report
        </PortalButton>
      </div>
    </section>
  );
};
