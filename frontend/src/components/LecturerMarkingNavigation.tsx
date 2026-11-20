import React from 'react';
import { ContactRound, UsersRound } from 'lucide-react';
import type { EvaluationTask, EvaluationTaskRole } from '../types/marks';
import { markingWorkspaces, tasksForMarkingRole } from '../utils/lecturerMarking';

export function LecturerMarkingNavigation({ tasks, role, onChange, controls, history = false, countsKnown = true }: {
  tasks: EvaluationTask[]; role: EvaluationTaskRole; onChange: (role: EvaluationTaskRole) => void;
  controls: string; history?: boolean; countsKnown?: boolean;
}) {
  const roles: EvaluationTaskRole[] = ['SUPERVISOR', 'PANEL'];
  return <nav aria-label="Marking responsibility" className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
    {roles.map(value => {
      const Icon = value === 'SUPERVISOR' ? UsersRound : ContactRound;
      const count = tasksForMarkingRole(tasks, value).filter(task => history ? task.status === 'SUBMITTED' : task.status !== 'SUBMITTED').length;
      return <button type="button" key={value} aria-current={role === value ? 'page' : undefined}
        aria-controls={controls} onClick={() => onChange(value)}
        className={`card-value inline-flex flex-wrap items-center gap-2 rounded-lg px-4 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy ${role === value ? 'bg-brand-navy text-white' : 'text-slate-600 hover:bg-white'}`}>
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.75} />
        <span>{markingWorkspaces[value].label}</span>
        {countsKnown && count > 0 ? <>
          <span aria-hidden="true" className={`inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums ${role === value ? 'bg-white/15 text-white' : 'bg-slate-200 text-slate-700'}`}>{count}</span>
          <span className="sr-only">{count} {history ? count === 1 ? 'submission' : 'submissions' : count === 1 ? 'pending marking task' : 'pending marking tasks'}</span>
        </> : null}
      </button>;
    })}
  </nav>;
}
