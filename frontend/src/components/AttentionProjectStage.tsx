import {PortalSelect} from './PortalSelect';

const stageLabels: Record<string, string> = {
  P1: 'RP1',
  P2: 'RP2',
  NOT_CONFIRMED: 'Unconfirmed',
  NOT_STARTED: 'Not started',
  NOT_STUDYING: 'Not studying',
  COMPLETED: 'Completed',
};

export function projectStageLabel(stage?: string | null) {
  return stageLabels[stage ?? ''] ?? 'Unavailable';
}

export function ProjectStageFilter({value, onChange, semester, rp1Count, includeOtherStates, className = ''}: {
  value: string;
  onChange: (value: string) => void;
  semester?: string | null;
  rp1Count?: number | null;
  includeOtherStates?: boolean;
  className?: string;
}) {
  return <label className={`form-label min-w-0 ${className}`}>
    Project stage
    <PortalSelect className="form-control form-control-sm mt-1" aria-label="Project stage" disabled={!semester} value={semester ? value : ''} onChange={event => onChange(event.target.value)}>
      <option value="">{semester ? 'All project stages' : 'No active semester'}</option>
      <option value="P1">{semester && rp1Count != null ? `RP1 (${rp1Count})` : 'RP1'}</option>
      <option value="P2">RP2</option>
      <option value="NOT_CONFIRMED">Unconfirmed</option>
      {includeOtherStates ? ['NOT_STARTED', 'NOT_STUDYING', 'COMPLETED'].map(stage =>
        <option key={stage} value={stage}>{projectStageLabel(stage)}</option>) : null}
    </PortalSelect>
  </label>;
}
