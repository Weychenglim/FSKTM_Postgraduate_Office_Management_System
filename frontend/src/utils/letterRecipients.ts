/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Who a confirmation letter is for, as the student entered it. The labels
// mirror PURPOSES and OPTIONAL_DETAILS in backend/letters/recipients.py; a test
// fails if they drift apart.

import type { LetterRequestDetails } from '../types';
import { MALAYSIA } from './addressPlaces';

export const RECIPIENT_PURPOSE_LABELS: Record<string, string> = {
  BANKING: 'Banking',
  GOVERNMENT: 'Government agencies',
  MOBILITY: 'Mobility (exchange programme)',
  NGO: 'Non-government agencies',
  SPONSORSHIP: 'Sponsorship',
  TRANSPORTATION: 'Transportation',
};

export const OPTIONAL_DETAIL_LABELS: Record<string, string> = {
  MIN_PERIOD: 'Minimum period of study',
  MAX_PERIOD: 'Maximum period of study',
  CURRENT_SEMESTER: 'Current semester',
};

/** The letter tag each optional detail fills; a letter offers the details whose tag it uses. */
export const OPTIONAL_DETAIL_TAGS: Record<string, string> = {
  MIN_PERIOD: '{{BALANCE_SEMESTERS_MIN}}',
  MAX_PERIOD: '{{BALANCE_SEMESTERS_MAX}}',
  CURRENT_SEMESTER: '{{CURRENT_SEMESTER}}',
};

/** The optional details a letter's wording can show, in the order students see them. */
export function offeredDetails(content: string): string[] {
  return Object.keys(OPTIONAL_DETAIL_TAGS).filter((code) => content.includes(OPTIONAL_DETAIL_TAGS[code]));
}

export const EMPTY_REQUEST_DETAILS: LetterRequestDetails = {
  purpose: '',
  organisation: '',
  addressLine1: '',
  addressLine2: '',
  postcode: '',
  city: '',
  state: '',
  country: MALAYSIA,
  include: [],
};

/** The address under the organisation's name, one line each, with postcode and city together. */
export function recipientAddressLines(details: Partial<LetterRequestDetails> | undefined): string[] {
  if (!details) return [];
  const cityLine = [details.postcode, details.city].filter(Boolean).join(' ');
  const country = details.country === MALAYSIA ? '' : details.country;
  return [details.addressLine1, details.addressLine2, cityLine, details.state, country].filter((line): line is string => Boolean(line));
}

/** The optional details the student asked to show, as readable labels. */
export function chosenDetailLabels(details: Partial<LetterRequestDetails> | undefined): string[] {
  return (details?.include ?? []).map((code) => OPTIONAL_DETAIL_LABELS[code] ?? code);
}
