/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Demo data for letter templates (UC40). Used only as an offline fallback when
// the backend is unreachable; the real source is the Django `letters` API.
// The body content uses the same {{PLACEHOLDER}} tags the frontend substitutes.

import { LetterTemplate } from '../types';

export const MOCK_LETTER_TEMPLATES: LetterTemplate[] = [
  {
    id: 'tpl-1',
    name: 'Confirmation of Enrolment',
    type: 'Academic Certification',
    status: 'Active',
    lastModified: '12 Oct 2023',
    modifiedBy: 'Dr. Azwan',
    description: 'Official status verification for currently registered students.',
    referencePrefix: 'UMF/PG/ENR',
    content: `To Whom It May Concern,\n\nThis is to certify that {{STUDENT_NAME}} (Matric No: {{STUDENT_ID}}) is a bona fide postgraduate student at the Faculty of Computer Science & Information Technology, Universiti Malaya.\n\nThe student is currently pursuing the {{PROGRAMME_NAME}} and their present registration status is {{CURRENT_STATUS}}. This letter is issued upon the student's request for official purposes.`,
  },
  {
    id: 'tpl-2',
    name: 'Visa Support Letter',
    type: 'Visa & Immigration',
    status: 'Active',
    lastModified: '28 Sep 2023',
    modifiedBy: 'Admin',
    description: 'Supports a student visa application at an embassy.',
    referencePrefix: 'UMF/PG/VS',
    content: `To Whom It May Concern,\n\nThis letter is issued to support the student visa application of {{STUDENT_NAME}} (Matric No: {{STUDENT_ID}}) with the Immigration Department of Malaysia.\n\n{{STUDENT_NAME}} is a full-time candidate of the {{PROGRAMME_NAME}} and is currently {{CURRENT_STATUS}}. The Faculty fully supports the continuation of their studies.`,
  },
  {
    id: 'tpl-3',
    name: 'Supervisor Confirmation Letter',
    type: 'Academic Certification',
    status: 'Active',
    lastModified: '05 Aug 2023',
    modifiedBy: 'Prof. Lim',
    description: "Confirms the student's appointed research supervisor.",
    referencePrefix: 'UMF/PG/SUP',
    content: `To Whom It May Concern,\n\nThis is to confirm that {{STUDENT_NAME}} (Matric No: {{STUDENT_ID}}), a candidate of the {{PROGRAMME_NAME}}, is currently under the supervision of {{SUPERVISOR_NAME}} at the Faculty of Computer Science & Information Technology, Universiti Malaya.\n\nThe candidate's registration status is {{CURRENT_STATUS}}.`,
  },
  {
    id: 'tpl-5',
    name: 'Confirmation Letter for Student Pass Renewal',
    type: 'Visa & Immigration',
    status: 'Active',
    lastModified: '05 Jun 2026',
    modifiedBy: 'Postgraduate Office',
    description: 'EMGS / Immigration confirmation letter supporting a student pass (visa) renewal.',
    referencePrefix: 'UM.W/606/2',
    // Auto-filled fields use the standard placeholders; immigration-specific
    // fields have no system data source, so they render as blank fill-in lines.
    content: `HEAD OF STUDENT PASS UNIT
Immigration Department of Malaysia
Wilayah Persekutuan Kuala Lumpur EMGS Branch
Menara TA One
No 22 Jalan P. Ramlee
50250 Kuala Lumpur

Dear Sir/Madam,

CONFIRMATION LETTER FOR STUDENT PASS RENEWAL

This is to confirm that the following student is currently pursuing studies at the Faculty of Computer Science & Information Technology, Universiti Malaya. The details of this candidate are as follows:

STUDENT DETAILS

NAME: {{STUDENT_NAME}}
MATRIC NUMBER: {{STUDENT_ID}}
PASSPORT NUMBER: {{PASSPORT_NUMBER}}
COUNTRY: {{COUNTRY}}
STATUS: {{CURRENT_STATUS}}

PROGRAMME OF STUDY DETAILS

PROGRAMME: {{PROGRAMME_NAME}}
PROGRAMME MODE: {{PROGRAMME_MODE}}
FIELD OF RESEARCH: {{FIELD_OF_RESEARCH}}
MODE OF STUDY: {{MODE_OF_STUDY}}
INITIAL SEMESTER: {{INITIAL_SEMESTER}}
CURRENT SEMESTER: {{CURRENT_SEMESTER}}
MAXIMUM SEMESTER: {{MAX_SEMESTER}}
SUPERVISOR(S): {{SUPERVISOR_NAME}}
EXPECTED COMPLETION OF STUDY: {{EXPECTED_COMPLETION}}

Should you require any further enquiries, please do not hesitate to contact us at +603-7967 6316.

Thank you.`,
  },
  {
    id: 'tpl-4',
    name: 'Completion Letter',
    type: 'Academic Certification',
    status: 'Draft',
    lastModified: '19 Jul 2023',
    modifiedBy: 'Admin',
    description: 'Confirms that the student has completed the programme.',
    referencePrefix: 'UMF/PG/CMP',
    content: `To Whom It May Concern,\n\nWe are pleased to verify that {{STUDENT_NAME}} (Matric No: {{STUDENT_ID}}) has satisfactorily fulfilled all academic requirements for the {{PROGRAMME_NAME}}.\n\nThe final Senate approval is pending formal conferral at the upcoming university graduation ceremony.`,
  },
];
