/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Centralized role → module access rules.
 *
 * Today this drives which sidebar entries each role sees. When backend auth
 * lands, the server's role/permission claims should map onto these same rules
 * (or replace ROLE_ALLOWED_MODULES with server-provided permissions) so the UI
 * and backend stay in sync.
 */
import { UserRole } from '../types';
import { SIDEBAR_ITEMS, SidebarItemId } from '../constants/navigation';

const STUDENT_MODULES: SidebarItemId[] = [
  SIDEBAR_ITEMS.DASHBOARD,
  SIDEBAR_ITEMS.FAQ_CHATBOT,
  SIDEBAR_ITEMS.SUPERVISOR_APPOINTMENTS,
  SIDEBAR_ITEMS.PANEL_APPOINTMENTS,
  SIDEBAR_ITEMS.FILE_MANAGEMENT,
  SIDEBAR_ITEMS.LETTER_GENERATION,
  SIDEBAR_ITEMS.NOTIFICATIONS,
  SIDEBAR_ITEMS.SETTINGS,
];

const LECTURER_MODULES: SidebarItemId[] = [
  SIDEBAR_ITEMS.DASHBOARD,
  SIDEBAR_ITEMS.REGISTRY,
  SIDEBAR_ITEMS.ANNOUNCEMENTS,
  SIDEBAR_ITEMS.FILE_MANAGEMENT,
  SIDEBAR_ITEMS.MARKS_ENTRY,
  SIDEBAR_ITEMS.PANEL_APPOINTMENTS,
  SIDEBAR_ITEMS.SUPERVISOR_APPOINTMENTS,
  SIDEBAR_ITEMS.NOTIFICATIONS,
  SIDEBAR_ITEMS.SETTINGS,
];

// Every module except the FAQ Chatbot, which is for students.
const COORDINATOR_MODULES = Object.values(SIDEBAR_ITEMS).filter((item) => item !== SIDEBAR_ITEMS.FAQ_CHATBOT);

/**
 * Modules each role may open. 'ALL' grants every module (Office Staff/Admin is
 * full-access in the current scope).
 */
export const ROLE_ALLOWED_MODULES: Record<UserRole, SidebarItemId[] | 'ALL'> = {
  'Office Staff/Admin': 'ALL',
  'Programme Coordinator': COORDINATOR_MODULES,
  Lecturer: LECTURER_MODULES,
  Student: STUDENT_MODULES,
};

/** Whether a role may access a given module id. Unknown role → denied. */
export function canAccessModule(role: string | undefined, moduleId: string): boolean {
  if (!role) return false;
  const allowed = ROLE_ALLOWED_MODULES[role as UserRole];
  if (!allowed) return false;
  if (allowed === 'ALL') return true;
  return (allowed as string[]).includes(moduleId);
}

export function canAccessMarksAdministration(
  role: string | undefined,
): boolean {
  return role === 'Office Staff/Admin';
}

/** Filters a list of modules down to those the role may access. */
export function allowedModulesFor(role: string | undefined, modules: SidebarItemId[]): SidebarItemId[] {
  if (!role) return modules;
  const allowed = ROLE_ALLOWED_MODULES[role as UserRole];
  if (!allowed || allowed === 'ALL') return modules;
  return modules.filter((m) => (allowed as string[]).includes(m));
}
