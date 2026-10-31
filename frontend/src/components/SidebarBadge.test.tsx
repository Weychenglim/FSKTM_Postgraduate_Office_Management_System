import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { SIDEBAR_ITEMS } from '../constants/navigation';
import { NotificationsProvider } from '../context/NotificationsContext';
import { toDoLabel } from '../context/fileToDo';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';

const HERE_DOT = 'w-1.5 h-1.5 rounded-full bg-indigo-300';
const badges = (count: number) => ({ [SIDEBAR_ITEMS.FILE_MANAGEMENT]: { count, label: toDoLabel(count) } });
const sidebar = (activeItem: string, count?: number) => renderToStaticMarkup(
  <Sidebar activeItem={activeItem} onNavigate={() => {}} isOpen onClose={() => {}} userRole="Student" badges={count === undefined ? undefined : badges(count)} />,
);

assert.equal(toDoLabel(1), '1 document to hand in');
assert.equal(toDoLabel(12), '12 documents to hand in');

const onDashboard = sidebar(SIDEBAR_ITEMS.DASHBOARD, 1);
assert.match(onDashboard, /aria-label="File Submission, 1 document to hand in"/);
assert.match(onDashboard, /bg-rose-600[^>]*>1<\/span>/);
assert.equal((onDashboard.match(/bg-rose-600/g) ?? []).length, 1, 'only File Submission gets a number');

const onFiles = sidebar(SIDEBAR_ITEMS.FILE_MANAGEMENT, 12);
assert.match(onFiles, />12<\/span>/, 'big numbers are shown in full');
assert.doesNotMatch(onFiles, new RegExp(HERE_DOT), 'the number takes the place of the "you are here" dot');

const none = sidebar(SIDEBAR_ITEMS.FILE_MANAGEMENT, 0);
assert.doesNotMatch(none, /bg-rose-600/);
assert.match(none, new RegExp(HERE_DOT));
assert.doesNotMatch(sidebar(SIDEBAR_ITEMS.FILE_MANAGEMENT), /bg-rose-600/);

const header = (menuAlert?: string) => renderToStaticMarkup(
  <MemoryRouter>
    <NotificationsProvider>
      <TopHeader userName="Ku Kian Xiang" userRole="Student" onLogout={() => {}} onHelpdeskTrigger={() => {}} onNotificationsTrigger={() => {}} onToggleSidebar={() => {}} menuAlert={menuAlert} />
    </NotificationsProvider>
  </MemoryRouter>,
);
const alerted = header(toDoLabel(1));
assert.match(alerted, /aria-label="Toggle sidebar\. 1 document to hand in"/);
assert.match(alerted, /bg-rose-600 ring-2 ring-white/);
const quiet = header('');
assert.match(quiet, /aria-label="Toggle sidebar"/);
assert.doesNotMatch(quiet, /bg-rose-600 ring-2/);

console.log('Sidebar to-do badge and menu button dot passed');
