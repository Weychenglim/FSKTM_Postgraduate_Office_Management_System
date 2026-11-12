import React from 'react';
import type { QuickLogin, QuickLoginGroup } from '../config/quickLogins';

interface QuickLoginPanelProps {
  groups: QuickLoginGroup[];
  selected: string;
  onPick: (login: QuickLogin) => void;
}

export const QuickLoginPanel: React.FC<QuickLoginPanelProps> = ({ groups, selected, onPick }) => (
  <div id="quick-login-panel" className="w-full rounded-2xl border border-[#1a2c54]/30 bg-[#0c1424]/90 p-4 text-left shadow-lg backdrop-blur-sm sm:p-5">
    <p className="mb-3 text-[10px] font-extrabold uppercase tracking-widest text-indigo-300">Quick sign-in (testing only)</p>
    <div className="space-y-3">
      {groups.map(group => (
        <div key={group.course || 'staff'}>
          {group.course && <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{group.course}</p>}
          <div className={`grid gap-1.5 ${group.logins.length === 1 ? 'grid-cols-1' : 'grid-cols-3'}`}>
            {group.logins.map(login => {
              const active = selected === login.email;
              return (
                <button
                  key={login.email}
                  type="button"
                  aria-pressed={active}
                  title={`${login.name} (${login.email})`}
                  onClick={() => onPick(login)}
                  className={`min-w-0 cursor-pointer rounded-lg border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${active ? 'border-indigo-500 bg-indigo-950 ring-1 ring-indigo-500' : 'border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08]'}`}
                >
                  <span className="block truncate text-[11px] font-bold text-indigo-200">{login.role}</span>
                  <span className="block truncate text-[10px] text-slate-400">{login.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  </div>
);
