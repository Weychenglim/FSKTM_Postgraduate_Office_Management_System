import { useId, useState, type ChangeEvent } from 'react';
import { FilePenLine } from 'lucide-react';
import type { AmendmentInput, ResearchAmendmentOptions, ResearchSnapshot } from '../services/researchAmendmentsApi';
import { PortalButton } from './PortalPrimitives';
import { useRecordDraft } from './RecordDraft';
import { RequestedChangesComparison } from './RequestedChangesComparison';
import { SupervisionDetailSection } from './SupervisionDetailLayout';

const groups = [
  { label: 'Project details', fields: [
    { key: 'title', label: 'Research title', rows: 0, limit: 500 },
    { key: 'researchArea', label: 'Research area', rows: 0, limit: 255 },
    { key: 'abstract', label: 'Research abstract', rows: 6, limit: undefined },
  ] },
  { label: 'Purpose and scope', fields: [
    { key: 'aim', label: 'Statement of aim', rows: 4, limit: 10000 },
    { key: 'researchQuestions', label: 'Research questions', rows: 4, limit: 10000 },
    { key: 'researchObjectives', label: 'Research objectives', rows: 4, limit: 10000 },
  ] },
  { label: 'Research plan', fields: [
    { key: 'methodology', label: 'Methodology', rows: 6, limit: 10000 },
    { key: 'timeline', label: 'Research timeline', rows: 4, limit: 10000 },
  ] },
] as const;
type FieldOption = typeof groups[number]['fields'][number];
const fields = groups.flatMap<FieldOption>(group => group.fields);
type Field = FieldOption['key'];
type Values = Omit<AmendmentInput, 'kind' | 'expectedRevision'>;

export function StudentResearchChangeForm({ profile, busy, blocked, onSave }: {
  profile: NonNullable<ResearchAmendmentOptions['profile']>;
  busy: boolean;
  blocked: boolean;
  onSave: (values: Values) => void;
}) {
  const id = useId();
  const [selected, setSelected] = useState<Field[]>([]);
  const [entered, setEntered] = useState<Partial<Record<Field, string>>>({});
  const [reason, setReason] = useState('');
  const baseline: ResearchSnapshot = { ...profile, ...(profile.currentIntent ?? profile.submittedIntent?.record) };
  const selectedFields = fields.filter(field => selected.includes(field.key));
  const valueFor = (key: Field) => entered[key] ?? baseline[key] ?? '';
  const changed = selectedFields.filter(({ key }) => valueFor(key).trim() !== (baseline[key] ?? '').trim());
  const updates = Object.fromEntries(changed.map(({ key }) => [key, valueFor(key).trim()])) as Partial<Record<Field, string>>;
  const { title, abstract, ...planChanges } = updates;
  const hasBlank = selectedFields.some(({ key }) => !valueFor(key).trim());
  const canSubmit = changed.length > 0 && !hasBlank && !!reason.trim() && !busy && !blocked;
  useRecordDraft(Object.keys(entered).some(key => {
    const field = key as Field;
    return valueFor(field) !== (baseline[field] ?? '');
  }) || !!reason.trim(), busy);

  return <form data-research-change-form onSubmit={event => {
    event.preventDefault();
    if (canSubmit) onSave({ title, abstract, ...(Object.keys(planChanges).length && { planChanges }), reason: reason.trim() });
  }}>
    <SupervisionDetailSection title="Choose fields to change" icon={FilePenLine}>
      <fieldset disabled={busy || blocked} className="min-w-0 space-y-6">
        <legend className="sr-only">Research change details</legend>
        <p className="text-sm leading-6 text-slate-600">Select the fields you want to update. Each editor starts with the current research profile value.</p>
        <div className="grid gap-3 lg:grid-cols-3">
          {groups.map(group => <fieldset key={group.label} className="min-w-0 rounded-xl border border-slate-200 px-3 pb-3 sm:px-4">
            <legend className="px-1 text-sm font-semibold text-brand-navy">{group.label}</legend>
            {group.fields.map(({ key, label }) => {
              const checked = selected.includes(key);
              return <label key={key} className={`mt-1 flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm leading-5 ${checked
                ? 'bg-blue-50 font-semibold text-blue-900' : 'text-slate-700 hover:bg-slate-50'}`}>
                <input type="checkbox" className="size-4 shrink-0 accent-blue-700" checked={checked} onChange={event => {
                  const include = event.target.checked;
                  setSelected(current => include ? [...current, key] : current.filter(field => field !== key));
                }}/>
                {label}
              </label>;
            })}
          </fieldset>)}
        </div>
        {selectedFields.length > 0 && <section className="min-w-0 space-y-5 border-t border-slate-200 pt-5" aria-labelledby={`${id}-edits`}>
          <h3 id={`${id}-edits`} className="text-base font-semibold text-brand-navy">Proposed changes</h3>
          {changed.some(({ key }) => key === 'aim') && (!selected.includes('researchQuestions') || !selected.includes('researchObjectives'))
            && <p className="text-sm leading-6 text-slate-600">Check whether your research questions or objectives also need to change.</p>}
          {selectedFields.map(({ key, label, rows, limit }) => {
            const editor = {
              id: `${id}-${key}`, required: true, maxLength: limit, value: valueFor(key),
              className: 'form-control form-control-md mt-2 text-sm! font-normal! leading-6!',
              onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                const value = event.target.value;
                setEntered(current => ({ ...current, [key]: value }));
              },
            };
            return <div key={key} className="min-w-0">
              <label htmlFor={editor.id} className="block text-sm font-semibold text-brand-navy">{label}</label>
              {!baseline[key]?.trim() && <p className="mt-1 text-sm text-slate-600">Current value is not recorded.</p>}
              {rows ? <textarea {...editor} rows={rows} /> : <input {...editor} />}
            </div>;
          })}
        </section>}
        <div className="border-t border-slate-200 pt-5">
          <label htmlFor={`${id}-reason`} className="block text-sm font-semibold text-brand-navy">Reason for change</label>
          <textarea id={`${id}-reason`} required rows={3} className="form-control form-control-md mt-2 text-sm! font-normal! leading-6!"
            value={reason} onChange={event => setReason(event.target.value)}/>
          <p className="mt-2 text-sm leading-6 text-slate-600">Explain why you’re requesting these changes. Your primary supervisor makes the final decision.</p>
        </div>
      </fieldset>
      {changed.length > 0 && !hasBlank && <section className="space-y-3 border-t border-slate-200 pt-5" aria-labelledby={`${id}-preview`} data-change-preview>
        <h3 id={`${id}-preview`} className="text-base font-semibold text-brand-navy">Preview changes</h3>
        <RequestedChangesComparison before={baseline} after={{ ...baseline, ...updates }} disclosure="preview"/>
      </section>}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-5">
        <p className="text-sm text-slate-600" role="status">{hasBlank ? 'Complete or deselect empty fields.' : changed.length
          ? `${changed.length} ${changed.length === 1 ? 'field changed' : 'fields changed'}` : 'No changes yet.'}</p>
        <PortalButton type="submit" variant="primary" isLoading={busy} disabled={!canSubmit}>Submit request</PortalButton>
      </div>
    </SupervisionDetailSection>
  </form>;
}
