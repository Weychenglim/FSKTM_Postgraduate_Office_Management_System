/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// The Lists tab of Letter Generation: the purposes a letter can be for and the
// organisations under each (with an address that is filled in for the student),
// and simple lists for "Choose from a list" questions. An entry letters used can
// only be hidden, so issued letters keep what they said.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownAZ, ChevronDown, ChevronUp, ClipboardPaste, Eye, EyeOff, ListChecks, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { PortalButton, PortalConfirmModal, StatusBadge } from './PortalPrimitives';
import { PortalModal, useModalTitle } from './PortalModal';
import { AppointmentIcon } from './AppointmentPrimitives';
import { ToggleSwitch } from './ToggleSwitch';
import { SelectMenu } from './SelectMenu';
import { LoadingState, ErrorState, EmptyState } from './StateViews';
import type { ChoiceGroup, ChoiceItem, ChoiceListDetail, ChoiceListSummary } from '../types';
import { COUNTRIES, MALAYSIA, MALAYSIAN_STATES, asksState } from '../utils/addressPlaces';
import {
  createChoiceGroup,
  createChoiceItems,
  createChoiceList,
  deleteChoiceGroup,
  deleteChoiceItem,
  deleteChoiceList,
  getChoiceList,
  getChoiceLists,
  orderChoiceList,
  updateChoiceGroup,
  updateChoiceItem,
  updateChoiceList,
} from '../services';

type Selection = { listId: string; groupId: string | null };
type ItemForm = { id?: string; name: string; nameMs: string; addressLine1: string; addressLine2: string; postcode: string; city: string; state: string; country: string };
type GroupForm = { id?: string; name: string; nameMs: string; itemNoun: string; allowOther: boolean };
type ListForm = { id?: string; name: string; itemNoun: string; description: string };

const EMPTY_ITEM: ItemForm = { name: '', nameMs: '', addressLine1: '', addressLine2: '', postcode: '', city: '', state: '', country: '' };
const NOT_SAVED = { value: '', label: 'Not saved' };
const STATE_OPTIONS = [NOT_SAVED, ...MALAYSIAN_STATES.map((state) => ({ value: state, label: state }))];
const COUNTRY_OPTIONS = [NOT_SAVED, ...COUNTRIES.map((country) => ({ value: country, label: country }))];
const errorText = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);
const addressLine = (item: ChoiceItem) =>
  [item.addressLine1, item.addressLine2, [item.postcode, item.city].filter(Boolean).join(' '), item.state, item.country === MALAYSIA ? '' : item.country].filter(Boolean).join(', ');

export const LetterListsManager: React.FC<{ onMessage: (message: string) => void }> = ({ onMessage }) => {
  const [summaries, setSummaries] = useState<ChoiceListSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<ChoiceListDetail | null>(null);
  const [detail, setDetail] = useState<ChoiceListDetail | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [search, setSearch] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [itemForm, setItemForm] = useState<ItemForm | null>(null);
  const [groupForm, setGroupForm] = useState<GroupForm | null>(null);
  const [listForm, setListForm] = useState<ListForm | null>(null);
  const [pasting, setPasting] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<{ kind: 'item' | 'group' | 'list'; id: string; name: string } | null>(null);
  const itemTitle = useModalTitle();
  const groupTitle = useModalTitle();
  const listTitle = useModalTitle();
  const pasteTitle = useModalTitle();

  const load = useCallback(async (keep?: Selection | null) => {
    setLoading(true);
    setError(null);
    try {
      const lists = await getChoiceLists();
      setSummaries(lists);
      const recipientList = lists.find((list) => list.kind === 'RECIPIENTS');
      const recipientDetail = recipientList ? await getChoiceList(recipientList.id) : null;
      setRecipients(recipientDetail);
      const next = keep ?? (recipientDetail ? { listId: recipientDetail.id, groupId: recipientDetail.groups[0]?.id ?? null } : lists[0] ? { listId: lists[0].id, groupId: null } : null);
      setSelection(next);
      setDetail(next && next.listId !== recipientDetail?.id ? await getChoiceList(next.listId) : recipientDetail);
    } catch (err) {
      setError(errorText(err, 'Could not load the lists.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = async (keep: Selection | null = selection) => {
    if (!keep) return load(null);
    const fresh = await getChoiceList(keep.listId);
    if (fresh.kind === 'RECIPIENTS') setRecipients(fresh);
    setDetail(fresh);
    setSelection(keep);
    setSummaries(await getChoiceLists());
  };

  const choose = async (next: Selection) => {
    setSearch('');
    setSelection(next);
    if (detail?.id === next.listId) return;
    if (recipients?.id === next.listId) {
      setDetail(recipients);
      return;
    }
    try {
      setDetail(await getChoiceList(next.listId));
    } catch (err) {
      onMessage(errorText(err, 'Could not open this list.'));
    }
  };

  const run = async (action: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setFormError(null);
    try {
      await action();
      if (done) onMessage(done);
      return true;
    } catch (err) {
      setFormError(errorText(err, 'That change could not be saved.'));
      onMessage(errorText(err, 'That change could not be saved.'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const isRecipients = detail?.kind === 'RECIPIENTS';
  const group: ChoiceGroup | null = isRecipients ? detail?.groups.find((g) => g.id === selection?.groupId) ?? null : null;
  const noun = (isRecipients ? group?.itemNoun : detail?.itemNoun) || 'Item';
  const entries = useMemo(
    () => (detail?.items ?? []).filter((item) => (isRecipients ? item.groupId === group?.id : true)),
    [detail, isRecipients, group],
  );
  const shown = entries.filter((item) => (showHidden || !item.hidden) && item.name.toLowerCase().includes(search.trim().toLowerCase()));
  const hiddenCount = entries.filter((item) => item.hidden).length;
  // Entries can be moved only while every one of them is on screen.
  const canOrder = !search.trim() && (showHidden || hiddenCount === 0);

  const saveItem = async () => {
    if (!detail || !itemForm) return;
    const input = isRecipients ? { ...itemForm } : { name: itemForm.name, nameMs: itemForm.nameMs };
    const ok = await run(
      () => (itemForm.id ? updateChoiceItem(itemForm.id, input) : createChoiceItems(detail.id, { ...input, groupId: group?.id ?? null })),
      itemForm.id ? `Saved "${itemForm.name.trim()}".` : `Added "${itemForm.name.trim()}".`,
    );
    if (ok) {
      setItemForm(null);
      await refresh();
    }
  };

  const savePaste = async () => {
    if (!detail || pasting === null) return;
    setBusy(true);
    setFormError(null);
    try {
      const result = await createChoiceItems(detail.id, { groupId: group?.id ?? null, names: pasting });
      onMessage(
        `Added ${result.created.length} ${noun.toLowerCase()}${result.created.length === 1 ? '' : 's'}.` +
          (result.skipped.length ? ` Already listed: ${result.skipped.join(', ')}.` : ''),
      );
      setPasting(null);
      await refresh();
    } catch (err) {
      setFormError(errorText(err, 'Those names could not be added.'));
    } finally {
      setBusy(false);
    }
  };

  const saveGroup = async () => {
    if (!recipients || !groupForm) return;
    let saved: ChoiceGroup | null = null;
    const ok = await run(async () => {
      saved = groupForm.id ? await updateChoiceGroup(groupForm.id, groupForm) : await createChoiceGroup(recipients.id, groupForm);
    }, groupForm.id ? `Saved "${groupForm.name.trim()}".` : `Added the purpose "${groupForm.name.trim()}".`);
    if (ok && saved) {
      setGroupForm(null);
      await refresh({ listId: recipients.id, groupId: (saved as ChoiceGroup).id });
    }
  };

  const saveList = async () => {
    if (!listForm) return;
    let saved: ChoiceListDetail | null = null;
    const ok = await run(async () => {
      saved = listForm.id ? await updateChoiceList(listForm.id, listForm) : await createChoiceList(listForm);
    }, listForm.id ? `Saved "${listForm.name.trim()}".` : `Made the list "${listForm.name.trim()}".`);
    if (ok && saved) {
      setListForm(null);
      await refresh({ listId: (saved as ChoiceListDetail).id, groupId: null });
    }
  };

  const toggleHidden = (item: ChoiceItem) =>
    void run(() => updateChoiceItem(item.id, { hidden: !item.hidden }), item.hidden ? `"${item.name}" is offered again.` : `"${item.name}" is hidden from new requests.`).then(
      (ok) => ok && refresh(),
    );

  const move = (index: number, by: -1 | 1) => {
    if (!detail) return;
    const ids = entries.map((item) => item.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + by, 0, moved);
    void run(() => orderChoiceList(detail.id, { groupId: group?.id ?? null, itemIds: ids })).then((ok) => ok && refresh());
  };

  const sortAZ = () => {
    if (!detail) return;
    const ids = [...entries].sort((a, b) => a.name.localeCompare(b.name)).map((item) => item.id);
    void run(() => orderChoiceList(detail.id, { groupId: group?.id ?? null, itemIds: ids }), 'Sorted A to Z.').then((ok) => ok && refresh());
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const target = deleting;
    const ok = await run(
      () => (target.kind === 'item' ? deleteChoiceItem(target.id) : target.kind === 'group' ? deleteChoiceGroup(target.id) : deleteChoiceList(target.id)),
      `Deleted "${target.name}".`,
    );
    setDeleting(null);
    if (!ok) return;
    if (target.kind === 'item') await refresh();
    else await load(null);
  };

  if (loading) return <LoadingState message="Loading the lists…" />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  const simpleLists = summaries.filter((list) => list.kind === 'SIMPLE');
  const navButton = (active: boolean) =>
    `flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-[13px] cursor-pointer ${active ? 'bg-brand-navy text-white' : 'text-slate-700 hover:bg-slate-50'}`;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
      <aside className="lg:col-span-4 xl:col-span-3 space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {recipients && (
          <section aria-labelledby="lists-purposes-heading" className="space-y-2">
            <div className="flex items-center justify-between gap-2 px-1">
              <h2 id="lists-purposes-heading" className="card-label">Who a letter is for</h2>
              <PortalButton size="sm" variant="ghost" icon={Plus} aria-label="Add a purpose" onClick={() => setGroupForm({ name: '', nameMs: '', itemNoun: 'Organisation', allowOther: true })}>
                Purpose
              </PortalButton>
            </div>
            <ul className="space-y-1">
              {recipients.groups.map((item) => {
                const count = recipients.items.filter((entry) => entry.groupId === item.id && !entry.hidden).length;
                const active = selection?.listId === recipients.id && selection.groupId === item.id;
                return (
                  <li key={item.id}>
                    <button type="button" aria-current={active ? 'true' : undefined} onClick={() => void choose({ listId: recipients.id, groupId: item.id })} className={navButton(active)}>
                      <span className={`min-w-0 truncate font-semibold ${item.hidden ? 'line-through opacity-70' : ''}`}>{item.name}</span>
                      <span className={`shrink-0 font-mono text-[11px] ${active ? 'text-slate-200' : 'text-slate-400'}`}>{count}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        <section aria-labelledby="lists-other-heading" className="space-y-2 border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between gap-2 px-1">
            <h2 id="lists-other-heading" className="card-label">Other lists</h2>
            <PortalButton size="sm" variant="ghost" icon={Plus} aria-label="Make a list" onClick={() => setListForm({ name: '', itemNoun: '', description: '' })}>
              List
            </PortalButton>
          </div>
          {simpleLists.length === 0 ? (
            <p className="card-caption px-1">For "Choose from a list" questions, such as embassies.</p>
          ) : (
            <ul className="space-y-1">
              {simpleLists.map((list) => {
                const active = selection?.listId === list.id;
                return (
                  <li key={list.id}>
                    <button type="button" aria-current={active ? 'true' : undefined} onClick={() => void choose({ listId: list.id, groupId: null })} className={navButton(active)}>
                      <span className="min-w-0 truncate font-semibold">{list.name}</span>
                      <span className={`shrink-0 font-mono text-[11px] ${active ? 'text-slate-200' : 'text-slate-400'}`}>{list.itemCount - list.hiddenCount}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </aside>

      <section aria-labelledby="list-detail-heading" className="lg:col-span-8 xl:col-span-9 rounded-2xl border border-slate-200 bg-white shadow-sm">
        {!detail || (isRecipients && !group) ? (
          <EmptyState icon={ListChecks} title="Choose a list" description="Pick a purpose or a list on the left to see its entries." />
        ) : (
          <div className="space-y-5 p-5 sm:py-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <AppointmentIcon icon={isRecipients ? Users : ListChecks} tone="info" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 id="list-detail-heading" className="section-heading">{isRecipients ? group?.name : detail.name}</h2>
                    {group?.hidden && <StatusBadge tone="warning">Hidden</StatusBadge>}
                  </div>
                  <p className="card-description mt-1">
                    {isRecipients
                      ? `${group?.nameMs ? `On the Malay page: ${group.nameMs}. ` : ''}One entry is called a "${group?.itemNoun}". ${group?.usedCount ? `Used by ${group.usedCount} letter${group.usedCount === 1 ? '' : 's'}.` : 'Not used by any letter yet.'}`
                      : `${detail.description ? `${detail.description} ` : ''}${detail.usedBy.length ? `Asked in ${detail.usedBy.join(', ')}.` : 'No letter asks from this list yet.'}`}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {isRecipients && group ? (
                  <>
                    <PortalButton size="sm" icon={Pencil} onClick={() => setGroupForm({ id: group.id, name: group.name, nameMs: group.nameMs, itemNoun: group.itemNoun, allowOther: group.allowOther })}>Edit purpose</PortalButton>
                    <PortalButton size="sm" icon={group.hidden ? Eye : EyeOff} disabled={busy} onClick={() => void run(() => updateChoiceGroup(group.id, { hidden: !group.hidden }), group.hidden ? `"${group.name}" is offered again.` : `"${group.name}" is hidden from new requests.`).then((ok) => ok && refresh())}>
                      {group.hidden ? 'Show purpose' : 'Hide purpose'}
                    </PortalButton>
                    <PortalButton size="sm" variant="ghost" icon={Trash2} disabled={busy || entries.length > 0 || group.usedCount > 0} title={entries.length || group.usedCount ? 'Only a purpose with no entries and no letters can be deleted. Hide it instead.' : undefined} onClick={() => setDeleting({ kind: 'group', id: group.id, name: group.name })}>
                      Delete
                    </PortalButton>
                  </>
                ) : (
                  <>
                    <PortalButton size="sm" icon={Pencil} onClick={() => setListForm({ id: detail.id, name: detail.name, itemNoun: detail.itemNoun, description: detail.description })}>Edit list</PortalButton>
                    <PortalButton size="sm" variant="ghost" icon={Trash2} disabled={busy || detail.usedBy.length > 0} title={detail.usedBy.length ? 'A letter still asks from this list.' : undefined} onClick={() => setDeleting({ kind: 'list', id: detail.id, name: detail.name })}>
                      Delete
                    </PortalButton>
                  </>
                )}
              </div>
            </div>

            {isRecipients && group && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="min-w-0">
                  <p id="allow-other-label" className="card-value text-slate-800">Students may type a {group.itemNoun.toLowerCase()} that is not listed</p>
                  <p className="card-caption mt-0.5">Turn off to keep students to this list.</p>
                </div>
                <ToggleSwitch id="allow-other-switch" checked={group.allowOther} labelledBy="allow-other-label" className="py-0" onChange={(on) => void run(() => updateChoiceGroup(group.id, { allowOther: on })).then((ok) => ok && refresh())} />
              </div>
            )}

            <div data-workspace-filter-card className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-end gap-3">
                <label className="form-label min-w-48 flex-1">
                  Find a {noun.toLowerCase()}
                  <span className="relative mt-1 block">
                    <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input type="search" className="form-control form-control-sm pl-9" value={search} placeholder="Type a name" onChange={(event) => setSearch(event.target.value)} />
                  </span>
                </label>
                {hiddenCount > 0 && (
                  <label className="flex items-center gap-2 pb-2 text-[12.5px] font-semibold text-slate-600 cursor-pointer">
                    <input type="checkbox" className="h-4 w-4 accent-brand-navy" checked={showHidden} onChange={(event) => setShowHidden(event.target.checked)} />
                    Show hidden ({hiddenCount})
                  </label>
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-start justify-between gap-3 border-t border-slate-200 pt-3">
                <PortalButton size="sm" icon={ArrowDownAZ} disabled={busy || entries.length < 2} onClick={sortAZ}>Sort A to Z</PortalButton>
                <div className="flex flex-wrap gap-2">
                  <PortalButton size="sm" icon={ClipboardPaste} onClick={() => { setFormError(null); setPasting(''); }}>Paste many</PortalButton>
                  <PortalButton size="sm" variant="primary" icon={Plus} onClick={() => { setFormError(null); setItemForm({ ...EMPTY_ITEM }); }}>Add {noun.toLowerCase()}</PortalButton>
                </div>
              </div>
            </div>

            {shown.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-4 py-6 text-center card-description">
                {entries.length === 0 ? `No ${noun.toLowerCase()} yet. Add one, or paste many at once.` : 'Nothing matches this search.'}
              </p>
            ) : (
              <table aria-label={`${isRecipients ? group?.name : detail.name} entries`} className="data-table block table-fixed lg:table">
                <colgroup className="hidden lg:table-column-group">
                  {(isRecipients ? [32, 30, 12, 26] : [56, 16, 28]).map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}
                </colgroup>
                <thead className="hidden lg:table-header-group">
                  <tr className="data-thead bg-slate-50">
                    <th scope="col" className="data-th">{noun}</th>
                    {isRecipients && <th scope="col" className="data-th">Saved address</th>}
                    <th scope="col" className="data-th">Used in</th>
                    <th scope="col" className="data-th text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="block space-y-3 lg:table-row-group lg:space-y-0">
                  {shown.map((item) => {
                    const index = entries.indexOf(item);
                    return (
                      <tr key={item.id} className={`data-row block rounded-xl border border-slate-200 lg:table-row lg:rounded-none lg:border-x-0 lg:border-t-0 ${item.hidden ? 'bg-slate-50/70' : ''}`}>
                        <td className="data-td-strong block px-3 py-2 lg:table-cell lg:pl-3 lg:pr-5 lg:py-3 [overflow-wrap:anywhere]">
                          <div className="flex items-start gap-2">
                            {canOrder && (
                              <span className="flex shrink-0 flex-col">
                                <button type="button" aria-label={`Move ${item.name} up`} disabled={busy || index === 0} onClick={() => move(index, -1)} className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 cursor-pointer disabled:cursor-default">
                                  <ChevronUp aria-hidden="true" className="h-4 w-4" />
                                </button>
                                <button type="button" aria-label={`Move ${item.name} down`} disabled={busy || index === entries.length - 1} onClick={() => move(index, 1)} className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 cursor-pointer disabled:cursor-default">
                                  <ChevronDown aria-hidden="true" className="h-4 w-4" />
                                </button>
                              </span>
                            )}
                            <div className="min-w-0 pt-0.5">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className={item.hidden ? 'text-slate-500' : ''}>{item.name}</span>
                                {item.hidden && <StatusBadge tone="warning">Hidden</StatusBadge>}
                              </span>
                              {item.nameMs && <span className="card-caption mt-0.5 block">Malay: {item.nameMs}</span>}
                            </div>
                          </div>
                        </td>
                        {isRecipients && (
                          <td className="data-td block px-3 py-1 lg:table-cell lg:px-5 lg:py-3 [overflow-wrap:anywhere]">
                            <span className="card-label mb-1 block lg:hidden">Saved address</span>
                            {addressLine(item) || <span className="text-slate-400">None</span>}
                          </td>
                        )}
                        <td className="data-td block px-3 py-1 lg:table-cell lg:px-5 lg:py-3 whitespace-nowrap">
                          <span className="card-label mb-1 block lg:hidden">Used in</span>
                          {item.usedCount ? `${item.usedCount} letter${item.usedCount === 1 ? '' : 's'}` : <span className="text-slate-400">Not used</span>}
                        </td>
                        <td className="data-td block px-3 py-2 lg:table-cell lg:px-5 lg:py-3">
                          <div className="flex flex-wrap items-center gap-1 lg:flex-nowrap lg:justify-end">
                            <PortalButton size="sm" icon={Pencil} onClick={() => { setFormError(null); setItemForm({ id: item.id, name: item.name, nameMs: item.nameMs, addressLine1: item.addressLine1, addressLine2: item.addressLine2, postcode: item.postcode, city: item.city, state: item.state, country: item.country }); }}>Edit</PortalButton>
                            <PortalButton size="sm" icon={item.hidden ? Eye : EyeOff} disabled={busy} onClick={() => toggleHidden(item)}>{item.hidden ? 'Show' : 'Hide'}</PortalButton>
                            <PortalButton
                              size="icon"
                              variant="ghost"
                              icon={Trash2}
                              disabled={busy || item.usedCount > 0}
                              title={item.usedCount ? 'Letters used this entry. Hide it instead.' : 'Delete'}
                              aria-label={`Delete ${item.name}`}
                              onClick={() => setDeleting({ kind: 'item', id: item.id, name: item.name })}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <p className="card-caption">
              Hidden entries are not offered on new requests but stay on letters already asked for. Only entries no letter used can be deleted.
              {hiddenCount > 0 && !showHidden ? ' Show hidden entries to put them in order.' : ''}
            </p>
          </div>
        )}
      </section>

      <PortalModal isOpen={itemForm !== null} onClose={() => !busy && setItemForm(null)} busy={busy} labelledBy={itemTitle} className="max-w-lg p-6">
        {itemForm && (
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void saveItem(); }}>
            <h2 id={itemTitle} className="section-heading">{itemForm.id ? `Edit ${noun.toLowerCase()}` : `Add a ${noun.toLowerCase()}`}</h2>
            <label className="form-label block">Name<input autoFocus className="form-control form-control-md mt-1" maxLength={160} value={itemForm.name} onChange={(event) => setItemForm({ ...itemForm, name: event.target.value })} /></label>
            <label className="form-label block">Name on the Malay page (optional)<input className="form-control form-control-md mt-1" maxLength={160} value={itemForm.nameMs} placeholder="Leave blank to use the same name" onChange={(event) => setItemForm({ ...itemForm, nameMs: event.target.value })} /></label>
            {isRecipients && (
              <fieldset className="space-y-3 border-t border-slate-100 pt-4">
                <legend className="card-value text-slate-800">Saved address (optional)</legend>
                <p className="card-caption">Filled in for the student, who can still change it.</p>
                <input aria-label="Address line 1" className="form-control form-control-sm" maxLength={120} placeholder="Address line 1" value={itemForm.addressLine1} onChange={(event) => setItemForm({ ...itemForm, addressLine1: event.target.value })} />
                <input aria-label="Address line 2" className="form-control form-control-sm" maxLength={120} placeholder="Address line 2" value={itemForm.addressLine2} onChange={(event) => setItemForm({ ...itemForm, addressLine2: event.target.value })} />
                <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3">
                  <input aria-label="Postcode" className="form-control form-control-sm" maxLength={20} placeholder="Postcode" value={itemForm.postcode} onChange={(event) => setItemForm({ ...itemForm, postcode: event.target.value })} />
                  <input aria-label="City" className="form-control form-control-sm" maxLength={80} placeholder="City" value={itemForm.city} onChange={(event) => setItemForm({ ...itemForm, city: event.target.value })} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {asksState(itemForm.country) && (
                    <SelectMenu<string>
                      aria-label="State"
                      size="sm"
                      value={itemForm.state}
                      placeholder="State"
                      options={STATE_OPTIONS}
                      onChange={(state) => setItemForm({ ...itemForm, state })}
                    />
                  )}
                  <SelectMenu<string>
                    aria-label="Country"
                    size="sm"
                    value={itemForm.country}
                    placeholder="Country"
                    searchPlaceholder="Search"
                    options={COUNTRY_OPTIONS}
                    onChange={(country) => setItemForm({ ...itemForm, country, state: asksState(country) ? itemForm.state : '' })}
                  />
                </div>
              </fieldset>
            )}
            {formError && <p role="alert" className="text-sm text-rose-800">{formError}</p>}
            <div className="flex justify-end gap-2">
              <PortalButton type="button" disabled={busy} onClick={() => setItemForm(null)}>Cancel</PortalButton>
              <PortalButton type="submit" variant="primary" isLoading={busy}>{itemForm.id ? 'Save' : 'Add'}</PortalButton>
            </div>
          </form>
        )}
      </PortalModal>

      <PortalModal isOpen={pasting !== null} onClose={() => !busy && setPasting(null)} busy={busy} labelledBy={pasteTitle} className="max-w-lg p-6">
        {pasting !== null && (
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void savePaste(); }}>
            <div>
              <h2 id={pasteTitle} className="section-heading">Paste many {noun.toLowerCase()}s</h2>
              <p className="card-description mt-1">One name per line, for example copied from a column in Excel. Names already listed are skipped.</p>
            </div>
            <textarea autoFocus rows={8} aria-label="Names, one per line" className="form-control form-control-md resize-y" value={pasting} onChange={(event) => setPasting(event.target.value)} />
            <p className="card-caption">{pasting.split('\n').filter((line) => line.trim()).length} name{pasting.split('\n').filter((line) => line.trim()).length === 1 ? '' : 's'}</p>
            {formError && <p role="alert" className="text-sm text-rose-800">{formError}</p>}
            <div className="flex justify-end gap-2">
              <PortalButton type="button" disabled={busy} onClick={() => setPasting(null)}>Cancel</PortalButton>
              <PortalButton type="submit" variant="primary" isLoading={busy}>Add them</PortalButton>
            </div>
          </form>
        )}
      </PortalModal>

      <PortalModal isOpen={groupForm !== null} onClose={() => !busy && setGroupForm(null)} busy={busy} labelledBy={groupTitle} className="max-w-lg p-6">
        {groupForm && (
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void saveGroup(); }}>
            <h2 id={groupTitle} className="section-heading">{groupForm.id ? 'Edit purpose' : 'Add a purpose'}</h2>
            <label className="form-label block">Purpose, as students see it<input autoFocus className="form-control form-control-md mt-1" maxLength={120} placeholder="For example: Insurance" value={groupForm.name} onChange={(event) => setGroupForm({ ...groupForm, name: event.target.value })} /></label>
            <label className="form-label block">In Malay (optional)<input className="form-control form-control-md mt-1" maxLength={120} placeholder="For example: Insurans" value={groupForm.nameMs} onChange={(event) => setGroupForm({ ...groupForm, nameMs: event.target.value })} /></label>
            <label className="form-label block">One entry is called<input className="form-control form-control-md mt-1" maxLength={60} placeholder="For example: Insurer" value={groupForm.itemNoun} onChange={(event) => setGroupForm({ ...groupForm, itemNoun: event.target.value })} /></label>
            <label className="flex items-center gap-2 text-[13px] font-semibold text-slate-700 cursor-pointer">
              <input type="checkbox" className="h-4 w-4 accent-brand-navy" checked={groupForm.allowOther} onChange={(event) => setGroupForm({ ...groupForm, allowOther: event.target.checked })} />
              Students may type one that is not listed
            </label>
            {formError && <p role="alert" className="text-sm text-rose-800">{formError}</p>}
            <div className="flex justify-end gap-2">
              <PortalButton type="button" disabled={busy} onClick={() => setGroupForm(null)}>Cancel</PortalButton>
              <PortalButton type="submit" variant="primary" isLoading={busy}>{groupForm.id ? 'Save' : 'Add purpose'}</PortalButton>
            </div>
          </form>
        )}
      </PortalModal>

      <PortalModal isOpen={listForm !== null} onClose={() => !busy && setListForm(null)} busy={busy} labelledBy={listTitle} className="max-w-lg p-6">
        {listForm && (
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void saveList(); }}>
            <div>
              <h2 id={listTitle} className="section-heading">{listForm.id ? 'Edit list' : 'Make a list'}</h2>
              <p className="card-description mt-1">A letter's "Choose from a list" question offers its entries.</p>
            </div>
            <label className="form-label block">Name<input autoFocus className="form-control form-control-md mt-1" maxLength={120} placeholder="For example: Embassies" value={listForm.name} onChange={(event) => setListForm({ ...listForm, name: event.target.value })} /></label>
            <label className="form-label block">One entry is called<input className="form-control form-control-md mt-1" maxLength={60} placeholder="For example: Embassy" value={listForm.itemNoun} onChange={(event) => setListForm({ ...listForm, itemNoun: event.target.value })} /></label>
            <label className="form-label block">Description (optional)<input className="form-control form-control-md mt-1" maxLength={300} value={listForm.description} onChange={(event) => setListForm({ ...listForm, description: event.target.value })} /></label>
            {formError && <p role="alert" className="text-sm text-rose-800">{formError}</p>}
            <div className="flex justify-end gap-2">
              <PortalButton type="button" disabled={busy} onClick={() => setListForm(null)}>Cancel</PortalButton>
              <PortalButton type="submit" variant="primary" isLoading={busy}>{listForm.id ? 'Save' : 'Make list'}</PortalButton>
            </div>
          </form>
        )}
      </PortalModal>

      <PortalConfirmModal
        isOpen={deleting !== null}
        title={`Delete "${deleting?.name ?? ''}"?`}
        message={deleting?.kind === 'list' ? 'The list and all its entries are deleted for good.' : 'It is deleted for good. To keep it on record instead, hide it.'}
        confirmLabel="Delete"
        tone="danger"
        isLoading={busy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
};
