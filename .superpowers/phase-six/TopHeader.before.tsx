/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Bell, HelpCircle, LogOut, User, Settings, Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import { useNotifications } from '../context/NotificationsContext';
import { APP_ROUTES } from '../constants/routes';
import { NotificationItem } from '../types';
import { latestNotifications, notificationRecordRoute, type OpenNotificationState } from '../utils/notificationLinks';
import { greetingFor } from '../utils/greeting';
import { THIN_SCROLLBAR } from '../utils/scrollbar';

interface TopHeaderProps {
  userName: string;
  userRole: string;
  onLogout: () => void;
  onHelpdeskTrigger: () => void;
  onNotificationsTrigger: () => void;
  onToggleSidebar: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  userName,
  userRole,
  onLogout,
  onHelpdeskTrigger,
  onNotificationsTrigger,
  onToggleSidebar
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const { items, unreadCount, markRead, markAllRead } = useNotifications();
  const navigate = useNavigate();
  const latest = latestNotifications(items);

  useEffect(() => {
    if (!bellOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setBellOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [bellOpen]);

  // Opening an item marks it read and goes to its record; announcements and
  // notes without a record open in the Notifications page's detail view.
  const openFromBell = (notification: NotificationItem) => {
    setBellOpen(false);
    if (notification.isUnread) void markRead(notification.id).catch(() => undefined);
    const route = notificationRecordRoute(notification);
    if (route) {
      navigate(route);
    } else {
      const state: OpenNotificationState = { openNotificationId: notification.id };
      navigate(APP_ROUTES.notifications, { state });
    }
  };
  const displayInitials = userName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'FS';

  return (
    <header
      id="portal-topheader"
      className="h-16 w-full bg-white border-b border-[#e2e8f0] px-4 md:px-8 flex items-center justify-between sticky top-0 z-40 font-sans"
    >
      {/* Left: sidebar toggle + greeting */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-all cursor-pointer shrink-0"
          title="Toggle sidebar"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-4.5 h-4.5" />
        </button>
        <div id="header-greeting-block" className="flex flex-col text-left min-w-0">
          <h4 id="header-greeting" className="text-slate-900 font-extrabold text-xs md:text-sm tracking-tight select-none truncate">
            {greetingFor()}, {userName}
          </h4>
        </div>
      </div>

      {/* Utilities Column */}
      <div id="header-utilities" className="flex items-center gap-2 sm:gap-3 md:gap-4 shrink-0">
        
        {/* Notifications bell: the latest few in a dropdown, the rest on the page */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setBellOpen((open) => !open)}
            aria-haspopup="dialog"
            aria-expanded={bellOpen}
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
            className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-all cursor-pointer relative"
            title={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'Notifications'}
          >
            <Bell className="w-4.5 h-4.5" />
            {/* Unread badge: driven by the shared notifications store, so it
                clears as soon as the user reads or marks all as read. */}
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center leading-none ring-2 ring-white select-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {bellOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setBellOpen(false)} />
                <motion.div
                  id="bell-dropdown"
                  role="dialog"
                  aria-label="Latest notifications"
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="fixed inset-x-4 top-[4.5rem] sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80 bg-white border border-slate-100 rounded-2xl shadow-sm z-50 text-left"
                >
                  <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2.5 border-b border-slate-100">
                    <span className="text-xs font-extrabold text-slate-800">Notifications</span>
                    <button
                      type="button"
                      disabled={unreadCount === 0}
                      onClick={() => void markAllRead().catch(() => undefined)}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 disabled:text-slate-300 disabled:cursor-default cursor-pointer"
                    >
                      Mark all as read
                    </button>
                  </div>
                  {latest.length === 0 ? (
                    <p className="px-4 py-8 text-center text-xs font-semibold text-slate-400">No new notifications</p>
                  ) : (
                    <ul className={`max-h-[360px] overflow-y-auto py-1 ${THIN_SCROLLBAR}`}>
                      {latest.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => openFromBell(item)}
                            className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex gap-2.5 cursor-pointer"
                          >
                            <span
                              aria-hidden="true"
                              className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${item.isUnread ? 'bg-blue-500' : 'bg-transparent'}`}
                            />
                            <span className="min-w-0 flex-1">
                              <span className={`block text-xs truncate ${item.isUnread ? 'font-extrabold text-slate-900' : 'font-semibold text-slate-600'}`}>
                                {item.title}
                              </span>
                              <span className="block text-[11px] text-slate-500 truncate">{item.description}</span>
                              <span className="block text-[10px] text-slate-400 mt-0.5">{item.timeAgo}</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="border-t border-slate-100 p-2">
                    <button
                      type="button"
                      onClick={() => { setBellOpen(false); onNotificationsTrigger(); }}
                      className="w-full py-2 rounded-xl text-xs font-bold text-brand-navy hover:bg-slate-50 cursor-pointer"
                    >
                      View all
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Global Manual Assistance Help Trigger */}
        <button
          type="button"
          onClick={onHelpdeskTrigger}
          className="hidden sm:flex w-10 h-10 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/60 items-center justify-center text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
          title="Administrative Manual Guide"
        >
          <HelpCircle className="w-4.5 h-4.5" />
        </button>

        {/* Divider separator */}
        <div className="hidden sm:block w-[1px] h-6 bg-slate-200" />

        {/* User profile dropdown column */}
        <div className="relative">
          <button 
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200/60 transition-all cursor-pointer group"
          >
            {/* Custom high-contrast profile picture avatar as specified in reference */}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#091124] to-[#1e2c54] flex items-center justify-center text-indigo-200 font-extrabold text-[13px] border border-slate-200 group-hover:scale-105 transition-transform duration-200">
              {displayInitials}
            </div>
            
            <div className="hidden lg:flex flex-col text-left">
              <span className="text-xs font-extrabold text-slate-800 tracking-tight leading-none">{userName}</span>
              <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest mt-1 leading-none">{userRole}</span>
            </div>
          </button>

          {/* User Option Dropdown items */}
          <AnimatePresence>
            {dropdownOpen && (
              <>
                {/* Backdrop dismiss overlay */}
                <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-56 bg-white border border-slate-100 rounded-2xl shadow-sm z-50 p-2 text-left"
                >
                  <div className="px-3 py-2 border-b border-slate-150 mb-1.5">
                    <span className="card-value text-slate-800 block">{userName}</span>
                    <span className="card-caption text-slate-400 block">{userRole}</span>
                  </div>

                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      // Students get their profile and linked records page; staff
                      // details live on the Settings page.
                      navigate(userRole === 'Student' ? APP_ROUTES.myProfile : APP_ROUTES.settings);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-600 hover:text-brand-navy hover:bg-slate-50 rounded-xl text-xs font-bold transition-all text-left cursor-pointer"
                  >
                    <User className="w-4 h-4 text-slate-400" />
                    <span>My Profile</span>
                  </button>

                  <button
                    onClick={() => { setDropdownOpen(false); navigate(APP_ROUTES.settings); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-600 hover:text-brand-navy hover:bg-slate-50 rounded-xl text-xs font-bold transition-all text-left cursor-pointer"
                  >
                    <Settings className="w-4 h-4 text-slate-400" />
                    <span>Settings</span>
                  </button>

                  <div className="h-[1px] bg-slate-100 my-1.5" />

                  {/* LOGOUT: swaps clean visual views */}
                  <button
                    onClick={() => { setDropdownOpen(false); onLogout(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-all text-left cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                    <span>Logout to Screen</span>
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};
