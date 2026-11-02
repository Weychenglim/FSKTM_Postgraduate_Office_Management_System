import React, {useState} from 'react';
import {X} from 'lucide-react';
import {PortalModal, useModalTitle} from './PortalModal';
import {PortalButton} from './PortalPrimitives';
import {OfficeToolViews} from './OfficeToolPrimitives';
import {AddTimelineEntryDrawer} from './AddTimelineEntryDrawer';
import {UploadTimelineDrawer} from './UploadTimelineDrawer';
import {DraftNavigationGuard} from './DraftNavigationGuard';
import {AlertMessage} from './AlertMessage';

type Props = {
  isOpen?: boolean;
  onClose: () => void;
  onSave: React.ComponentProps<typeof AddTimelineEntryDrawer>['onSave'];
  onImportSuccess: React.ComponentProps<typeof UploadTimelineDrawer>['onImportSuccess'];
  semesterId: number;
  semesterLabel: string;
  busy: boolean;
  error: string | null;
  completion?: {message: string; tone: 'success' | 'warning'} | null;
};

/** One entry point; both methods retain their draft while switching. */
export function TimelineAddEventsModal({isOpen = true, onClose, onSave, onImportSuccess, semesterId, semesterLabel, busy, error, completion}: Props) {
  const titleId = useModalTitle();
  const discardTitle = useModalTitle();
  const [method, setMethod] = useState<'create' | 'import'>('create');
  const [createDirty, setCreateDirty] = useState(false);
  const [importDirty, setImportDirty] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [createVersion, setCreateVersion] = useState(0);
  const [importVersion, setImportVersion] = useState(0);
  const pending = busy || importBusy;
  const close = () => {setCreateDirty(false); setImportDirty(false); setImportBusy(false); setDiscard(false); setMethod('create'); setCreateVersion(value => value + 1); setImportVersion(value => value + 1); onClose();};
  const created = async (entry: Parameters<Props['onSave']>[0]) => {
    const committed = await onSave(entry);
    if (!committed) return false;
    setCreateDirty(false); setCreateVersion(value => value + 1);
    if (importDirty) setMethod('import'); else close();
    return true;
  };
  const imported = () => {
    setImportDirty(false); setImportBusy(false); setImportVersion(value => value + 1);
    if (createDirty) setMethod('create'); else close();
  };
  const requestClose = () => {
    if (pending) return;
    if (createDirty || importDirty) setDiscard(true); else close();
  };
  return <>
    <DraftNavigationGuard dirty={isOpen && (createDirty || importDirty)} busy={isOpen && pending} onDiscard={close}/>
    <PortalModal isOpen={isOpen} onClose={requestClose} busy={pending} labelledBy={titleId} className="max-w-3xl p-0">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
        <div><h2 id={titleId} className="section-heading">Add events</h2><p className="card-description mt-1">{semesterLabel}</p></div>
        <PortalButton variant="ghost" icon={X} aria-label="Close add events" disabled={pending} onClick={requestClose} />
      </header>
      <div className="space-y-6 p-5 sm:p-6">
        {completion && <AlertMessage type={completion.tone} message={completion.message} />}
        <fieldset disabled={pending}>
          <OfficeToolViews<'create' | 'import'> label="How to add events" appearance="workspace" value={method} onChange={setMethod} options={[{value:'create',label:'Create one event'},{value:'import',label:'Import from Excel'}]} />
        </fieldset>
        <div hidden={method !== 'create'}>
          <AddTimelineEntryDrawer key={createVersion} embedded isOpen={isOpen} onClose={requestClose} onSave={created} timelineLabel={semesterLabel} busy={busy} error={error} onDirtyChange={setCreateDirty} />
        </div>
        <div hidden={method !== 'import'}>
          <UploadTimelineDrawer key={importVersion} embedded isOpen={isOpen} onClose={imported} onCancel={requestClose} onImportSuccess={onImportSuccess} semesterId={semesterId} semesterLabel={semesterLabel} onDirtyChange={setImportDirty} onBusyChange={setImportBusy} />
        </div>
      </div>
    </PortalModal>
    <PortalModal isOpen={discard} onClose={() => setDiscard(false)} labelledBy={discardTitle} className="max-w-md p-6">
      <h2 id={discardTitle} className="section-heading">Discard unsaved work?</h2>
      <p className="card-description mt-3">The event details and selected import file will be cleared.</p>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <PortalButton onClick={() => setDiscard(false)}>Keep editing</PortalButton>
        <PortalButton variant="danger" onClick={close}>Discard changes</PortalButton>
      </div>
    </PortalModal>
  </>;
}
