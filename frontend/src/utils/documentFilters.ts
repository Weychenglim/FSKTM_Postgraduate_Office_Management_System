import type { DocumentCheckStatus, DocumentFilters, DocumentKind, DocumentSender, DocumentView } from '../types';

export const EMPTY_DOCUMENT_FILTERS: DocumentFilters = {
  view: 'all',
  q: '',
  type: '',
  group: '',
  semester: '',
  programme: '',
  intake: '',
  student: '',
  uploader: '',
  sender: '',
  required: '',
  status: '',
  kind: '',
  from: '',
  to: '',
  archived: '',
};

const VIEWS: DocumentView[] = ['all', 'check', 'staff', 'mine', 'required', 'letters'];
const UPLOADERS = ['me', 'students', 'staff'] as const;
const SENDERS: DocumentSender[] = ['student', 'lecturer', 'coordinator', 'office'];
const STATUSES: DocumentCheckStatus[] = ['NONE', 'WAITING', 'ACCEPTED', 'RETURNED'];
const KINDS: DocumentKind[] = ['PDF', 'DOCX', 'IMAGE', 'XLSX', 'PPTX'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const pick = <T extends string>(value: string | null, allowed: readonly T[]): T | '' =>
  value && (allowed as readonly string[]).includes(value) ? (value as T) : '';

/** Filters from the address bar, so a filtered list can be shared or bookmarked. */
export function filtersFromParams(params: URLSearchParams): DocumentFilters {
  const date = (key: string) => {
    const value = params.get(key) ?? '';
    return DATE.test(value) ? value : '';
  };
  return {
    view: pick(params.get('view'), VIEWS) || 'all',
    q: (params.get('q') ?? '').slice(0, 100),
    type: params.get('type') ?? '',
    group: params.get('group') ?? '',
    semester: params.get('semester') ?? '',
    programme: params.get('programme') ?? '',
    intake: params.get('intake') ?? '',
    student: params.get('student') ?? '',
    uploader: pick(params.get('uploader'), UPLOADERS),
    sender: pick(params.get('sender'), SENDERS),
    required: pick(params.get('required'), ['1'] as const),
    status: pick(params.get('status'), STATUSES),
    kind: pick(params.get('kind'), KINDS),
    from: date('from'),
    to: date('to'),
    archived: pick(params.get('archived'), ['1'] as const),
  };
}

/** Only the values that differ from the defaults, in a stable order. */
export function filtersToParams(filters: Partial<DocumentFilters>): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of Object.keys(EMPTY_DOCUMENT_FILTERS) as Array<keyof DocumentFilters>) {
    const value = (filters[key] ?? '').toString().trim();
    if (value && value !== EMPTY_DOCUMENT_FILTERS[key]) params.set(key, value);
  }
  return params;
}

export const documentQuery = filtersToParams;

/** How many of the filters under "More filters" are in use. */
export function moreFilterCount(filters: DocumentFilters): number {
  return [filters.intake, filters.sender, filters.uploader, filters.status, filters.kind, filters.from, filters.to, filters.archived].filter(Boolean).length;
}
