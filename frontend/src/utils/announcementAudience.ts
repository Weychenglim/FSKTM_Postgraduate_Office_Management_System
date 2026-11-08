import type { AnnouncementItem, AnnouncementTarget } from '../types';

const ORDER: AnnouncementTarget[] = ['All', 'All Students', 'Lecturers', 'Staff', 'Coordinators'];

/** Everyone stands alone and picking a group replaces it. Nothing is chosen until the sender picks. */
export function toggleAudience(current: AnnouncementTarget[], audience: AnnouncementTarget): AnnouncementTarget[] {
  if (audience === 'All') return current.includes('All') ? [] : ['All'];
  const next = current.includes(audience)
    ? current.filter((item) => item !== audience)
    : [...current.filter((item) => item !== 'All'), audience];
  return ORDER.filter((item) => next.includes(item));
}

/** Every group an announcement goes to. Rows without the list go to `target` alone. */
export function audiencesOf(item: Pick<AnnouncementItem, 'target' | 'audiences'>): AnnouncementTarget[] {
  return item.audiences?.length ? item.audiences : [item.target];
}
