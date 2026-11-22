import {getWindowScheduleStatus,type WindowScheduleState} from '../utils/periodPresentation';
import {StatusBadge,type BadgeTone} from './PortalPrimitives';

const tones:Record<ReturnType<typeof getWindowScheduleStatus>,BadgeTone>={
  Draft:'warning',
  Upcoming:'info',
  Open:'success',
  'Deadline passed':'warning',
  Closed:'neutral',
  Archived:'neutral',
  Published:'neutral',
};

export function WindowScheduleStatus(period:WindowScheduleState) {
  const label=getWindowScheduleStatus(period);
  return <StatusBadge tone={tones[label]} className="whitespace-nowrap">{label}</StatusBadge>;
}
