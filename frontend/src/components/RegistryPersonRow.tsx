/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { shortProgramme } from '../utils/programmeTransfers';

export interface RegistryPerson {
  matric: string;
  name: string;
  programme: string;
  avatarText: string;
  avatarBg: string;
}

/** One student in a list: who they are, an optional line about them, and what you can do about them. */
export const PersonRow: React.FC<{ person: RegistryPerson; detail?: React.ReactNode; action?: React.ReactNode; muted?: boolean }> = ({ person, detail, action, muted }) => (
  <li className={`flex flex-wrap items-start gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0 ${muted ? 'opacity-55' : ''}`}>
    <span aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-[12px] font-extrabold ${person.avatarBg}`}>{person.avatarText}</span>
    <div className="min-w-0 flex-[1_1_12rem]">
      <p className="text-[14px] font-bold text-slate-900 [overflow-wrap:anywhere]">{person.name}</p>
      <p className="text-[12.5px] text-slate-500 [overflow-wrap:anywhere]">{person.matric} &middot; {shortProgramme(person.programme) || 'No programme'}</p>
      {detail}
    </div>
    {action && <div className="ml-12 shrink-0 sm:ml-0">{action}</div>}
  </li>
);
