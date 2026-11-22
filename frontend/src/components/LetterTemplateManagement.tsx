/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Letter Generation for office staff: Requests (deciding what students asked
// for), Issued letters (the register), Letter types (their forms, wording and
// settings) and Lists (who letters can be for, and other lists questions use).

import React, { useCallback, useEffect, useState } from 'react';
import { FileCheck2, FileText, Inbox, ListChecks, Plus } from 'lucide-react';
import { PageHeader, PortalButton } from './PortalPrimitives';
import { useDecisionFeedback, type FeedbackTone } from './DecisionFeedback';
import { OfficeToolViews } from './OfficeToolPrimitives';
import { IssuedLettersRegister } from './IssuedLetters';
import { OfficeLetterRequests } from './OfficeLetterRequests';
import { LetterTypesList } from './LetterTypesList';
import { LetterTypeEditor } from './LetterTypeEditor';
import { LetterListsManager } from './LetterListsManager';
import type { LetterPlaceholder, LetterRequestCounts, LetterTemplate } from '../types';
import { getLetterPlaceholders, getLetterRequestCounts, getLetterTemplates } from '../services';

export type OfficeLetterView = 'requests' | 'issued' | 'templates' | 'lists';

interface LetterTemplateManagementProps {
  /** Office staff also get requests, the register of issued letters and the lists. */
  canViewIssuedLetters?: boolean;
  /** Which tab is open; driven by the route when the app provides it. */
  view?: OfficeLetterView;
  onViewChange?: (view: OfficeLetterView) => void;
  /** The request open for review on the Requests tab, from the route. */
  requestId?: string | null;
  onOpenRequest?: (id: string) => void;
  onCloseRequest?: () => void;
}

export const LetterTemplateManagement: React.FC<LetterTemplateManagementProps> = ({
  canViewIssuedLetters = false,
  view,
  onViewChange,
  requestId,
  onOpenRequest,
  onCloseRequest,
}) => {
  const [localView, setLocalView] = useState<OfficeLetterView>(canViewIssuedLetters ? 'requests' : 'templates');
  const [localRequestId, setLocalRequestId] = useState<string | null>(null);
  const activeView: OfficeLetterView = canViewIssuedLetters ? view ?? localView : 'templates';
  const changeView = (next: OfficeLetterView) => (onViewChange ? onViewChange(next) : setLocalView(next));
  const openRequestId = onOpenRequest ? requestId ?? null : localRequestId;

  const feedback = useDecisionFeedback();
  const showToast = (message: string, tone: FeedbackTone = 'success') => feedback?.(message, tone);

  // How many requests wait for a decision, for the tab label.
  const [requestCounts, setRequestCounts] = useState<LetterRequestCounts | null>(null);
  const loadRequestCounts = useCallback(() => {
    if (!canViewIssuedLetters) return;
    getLetterRequestCounts().then(setRequestCounts).catch(() => setRequestCounts(null));
  }, [canViewIssuedLetters]);
  useEffect(() => {
    loadRequestCounts();
  }, [loadRequestCounts]);

  const [templates, setTemplates] = useState<LetterTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [placeholders, setPlaceholders] = useState<LetterPlaceholder[] | null>(null);
  // The letter type open in the editor; 'new' is one not saved yet.
  const [editing, setEditing] = useState<LetterTemplate | 'new' | null>(null);

  const loadTemplates = useCallback(() => {
    setLoading(true);
    setError(null);
    getLetterTemplates()
      .then(setTemplates)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load letter types.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadTemplates();
    getLetterPlaceholders().then(setPlaceholders).catch(() => setPlaceholders(null));
  }, [loadTemplates]);

  // Leaving the Letter types tab closes the editor (its unsaved changes were confirmed away).
  useEffect(() => {
    if (activeView !== 'templates') setEditing(null);
  }, [activeView]);

  if (activeView === 'templates' && editing) {
    return (
      <div id="letter-template-management" className="text-left font-sans text-brand-navy text-xs">
        <LetterTypeEditor
          key={editing === 'new' ? 'new' : editing.id}
          template={editing === 'new' ? null : editing}
          placeholders={placeholders}
          onClose={() => setEditing(null)}
          onSaved={(saved, created) => {
            setTemplates((rows) => (created ? [saved, ...rows] : rows.map((row) => (row.id === saved.id ? saved : row))));
            if (created) setEditing(null);
          }}
          onDeleted={(deleted) => {
            setTemplates((rows) => rows.filter((row) => row.id !== deleted.id));
            setEditing(null);
            showToast(`Deleted "${deleted.name}".`);
          }}
          onOpenLists={() => changeView('lists')}
          onMessage={showToast}
        />
      </div>
    );
  }

  const pending = requestCounts?.Pending ?? 0;

  return (
    <div id="letter-template-management" className="space-y-6 text-left font-sans text-brand-navy text-xs pb-12">
      {!(activeView === 'requests' && openRequestId) && (
        <>
          <PageHeader
            title="Letter Generation"
            actions={
              activeView === 'templates' ? (
                <PortalButton variant="primary" icon={Plus} onClick={() => setEditing('new')}>New letter type</PortalButton>
              ) : undefined
            }
          />
          {canViewIssuedLetters && (
            <OfficeToolViews<OfficeLetterView>
              label="Letter Generation views"
              appearance="workspace"
              value={activeView}
              onChange={(next) => {
                if (next === 'requests') loadRequestCounts();
                changeView(next);
              }}
              options={[
                { value: 'requests', label: pending ? `Requests (${pending})` : 'Requests', icon: Inbox },
                { value: 'issued', label: 'Issued letters', icon: FileCheck2 },
                { value: 'templates', label: 'Letter types', icon: FileText },
                { value: 'lists', label: 'Lists', icon: ListChecks },
              ]}
            />
          )}
        </>
      )}

      {activeView === 'requests' && (
        <OfficeLetterRequests
          requestId={openRequestId}
          onOpenRequest={(id) => (onOpenRequest ? onOpenRequest(id) : setLocalRequestId(id))}
          onCloseRequest={() => (onCloseRequest ? onCloseRequest() : setLocalRequestId(null))}
          counts={requestCounts}
          onCountsStale={loadRequestCounts}
          onMessage={showToast}
          templates={templates}
        />
      )}

      {activeView === 'issued' && <IssuedLettersRegister onMessage={showToast} onOpenTemplates={() => changeView('templates')} />}

      {activeView === 'templates' && (
        <LetterTypesList templates={templates} loading={loading} error={error} onRetry={loadTemplates} onOpen={setEditing} onCreate={() => setEditing('new')} />
      )}

      {activeView === 'lists' && <LetterListsManager onMessage={showToast} />}
    </div>
  );
};
