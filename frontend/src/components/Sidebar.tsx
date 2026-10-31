/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  GraduationCap,
  LayoutDashboard,
  MessageSquareCode,
  FolderMinus,
  Users,
  MailOpen,
  Megaphone,
  CheckSquare,
  Award,
  Settings as SettingsIcon,
  LucideIcon
} from 'lucide-react';
import { SIDEBAR_ITEMS, SIDEBAR_MENU_ORDER, resolveSidebarItem } from '../constants/navigation';
import { allowedModulesFor } from '../auth/permissions';

/** A number on a menu item, and what it means for screen readers, e.g. "1 document to hand in". */
export type SidebarBadges = Partial<Record<string, { count: number; label: string }>>;

interface SidebarProps {
  activeItem: string;
  onNavigate: (item: string) => void;
  isOpen: boolean;
  onClose: () => void;
  userRole?: string;
  badges?: SidebarBadges;
}

// Icon + label lookup for each sidebar entry (identities live in navigation.ts).
const ITEM_META: Record<string, { label: string; icon: LucideIcon }> = {
  [SIDEBAR_ITEMS.DASHBOARD]: { label: 'Dashboard Overview', icon: LayoutDashboard },
  [SIDEBAR_ITEMS.REGISTRY]: { label: 'Registry Management', icon: GraduationCap },
  [SIDEBAR_ITEMS.FAQ_CHATBOT]: { label: 'FAQ Chatbot', icon: MessageSquareCode },
  [SIDEBAR_ITEMS.FILE_MANAGEMENT]: { label: 'File Management', icon: FolderMinus },
  [SIDEBAR_ITEMS.SUPERVISOR_APPOINTMENTS]: { label: 'Supervisor Appointments', icon: Users },
  [SIDEBAR_ITEMS.LETTER_GENERATION]: { label: 'Letter Generation', icon: MailOpen },
  [SIDEBAR_ITEMS.ANNOUNCEMENTS]: { label: 'Announcements', icon: Megaphone },
  [SIDEBAR_ITEMS.MARKS_ENTRY]: { label: 'Marks Entry', icon: CheckSquare },
  [SIDEBAR_ITEMS.PANEL_APPOINTMENTS]: { label: 'Panel Appointments', icon: Award },
  [SIDEBAR_ITEMS.SETTINGS]: { label: 'Settings', icon: SettingsIcon },
};

export const Sidebar: React.FC<SidebarProps> = ({ activeItem, onNavigate, isOpen, onClose, userRole, badges }) => {
  // On mobile the sidebar is an overlay drawer; dismiss it after navigating.
  const handleNavigate = (item: string) => {
    onNavigate(item);
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      onClose();
    }
  };

  // Build the menu from the canonical order, scoped to the role's permissions.
  const filteredMenuItems = allowedModulesFor(userRole, SIDEBAR_MENU_ORDER).map((id) => ({
    id,
    label: ITEM_META[id].label,
    icon: ITEM_META[id].icon,
  }));

  const mappedActiveItem = resolveSidebarItem(activeItem);

  return (
    <div
      id="portal-sidebar"
      className={`fixed lg:sticky top-0 left-0 z-50 lg:z-30 h-screen w-[15.5rem] sm:w-64 shrink-0 bg-[#f8fafc] border-r border-[#e2e8f0] flex flex-col justify-between font-sans overflow-hidden transition-[width,transform] duration-300 ease-in-out ${
        isOpen ? 'translate-x-0 lg:w-72' : '-translate-x-full lg:w-0 lg:border-r-0'
      }`}
    >
      {/* Top Brand Block */}
      <div id="sidebar-brand-block" className="p-6 flex flex-col">
        <div id="sidebar-logo-row" className="flex items-center gap-3">
          <div 
            id="sidebar-logo-container" 
            className="w-10 h-10 bg-brand-navy rounded-xl flex items-center justify-center shadow-sm shadow-indigo-950/20"
          >
            <GraduationCap className="w-5.5 h-5.5 text-indigo-300" />
          </div>
          <div id="sidebar-logo-text" className="flex flex-col text-left">
            <span className="text-brand-navy font-extrabold text-sm tracking-widest font-sans">FSKTM</span>
            <span className="text-slate-500 text-[9px] font-bold tracking-[0.15em] uppercase leading-none mt-0.5">
              Postgraduate
            </span>
            <span className="text-slate-400 text-[8px] font-semibold tracking-wider uppercase leading-none mt-0.5">
              Administrative Portal
            </span>
          </div>
        </div>
      </div>

      {/* Navigation List items */}
      <div id="sidebar-nav-list" className="flex-1 px-4 py-2 overflow-y-auto space-y-1">
        {filteredMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = mappedActiveItem === item.id;
          const displayLabel = item.id === SIDEBAR_ITEMS.FILE_MANAGEMENT && userRole === 'Student'
            ? 'File Submission'
            : item.label;
          const badge = badges?.[item.id];
          const showBadge = Boolean(badge && badge.count > 0);
          return (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id)}
              aria-label={showBadge ? `${displayLabel}, ${badge?.label}` : undefined}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left cursor-pointer group ${
                isActive 
                  ? 'bg-brand-navy text-white shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'
              }`}
            >
              <Icon 
                className={`w-4.5 h-4.5 transition-colors ${
                  isActive ? 'text-indigo-300' : 'text-slate-400 group-hover:text-slate-600'
                }`} 
              />
              <span className="tracking-wide">{displayLabel}</span>
              {showBadge ? (
                <span aria-hidden="true" className="ml-auto min-w-[19px] h-[19px] px-1.5 rounded-full bg-rose-600 text-white text-[10.5px] font-extrabold leading-none flex items-center justify-center tabular-nums">
                  {badge?.count}
                </span>
              ) : isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-300" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
