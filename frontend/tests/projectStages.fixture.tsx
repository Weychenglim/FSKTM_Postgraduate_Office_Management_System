import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { ProjectStages } from '../src/components/ProjectStages';
import { StudentDashboard } from '../src/components/StudentDashboard';

// Production component and API client; every HTTP call is intercepted here.
const results: Array<{ name: string; error?: string }> = [];
const renderErrors: string[] = [];
window.addEventListener('error', event => renderErrors.push(event.message));
const check = (value: unknown, message: string) => { if (!value) throw new Error(message); };
const pause = () => new Promise(resolve => setTimeout(resolve, 30));
const until = async (test: () => unknown) => {
  for (let index = 0; index < 300; index++) { if (test()) return; await pause(); }
  throw new Error(`Timed out: ${document.body.innerText.slice(-1000)} ${renderErrors.at(-1) ?? ''}`);
};
const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent?.trim() === label || node.getAttribute('aria-label') === label)!;
const click = async (label: string) => { check(button(label), `Missing ${label}`); button(label).click(); await pause(); };
const selectReason = async () => {
  await click('Choose a reason');
  const option = () => [...document.querySelectorAll<HTMLElement>('[role="option"]')]
    .find(node => node.textContent?.trim() === 'Wrong answer');
  await until(option);
  option()!.click();
  await pause();
};
const studentTick = (name: string) => document.querySelector<HTMLInputElement>(`input[aria-label="${name}"]`)!;
const acknowledgement = () => document.querySelector<HTMLInputElement>('dialog input[type="checkbox"]')!;
const openChange = async (...names: string[]) => {
  await until(() => studentTick(names[0]));
  names.forEach(name => studentTick(name).click());
  await pause();
  await click(`Change ${names.length}`);
  await click('RP2');
  await selectReason();
};
let failImpact = false;
let pending: (() => void) | null = null;
let deferImpact = false;
let staleSave = false;
let previewVersion = 0;
const writes: Record<string, unknown>[] = [];
const person = { matric: 'S001', name: 'Stage Student', programme: 'Programme A', intake: '2026/2027', avatarText: 'SS', avatarBg: 'bg-blue-100',
  shown: 'P1', reason: '', noSupervisor: false, requestWaiting: false, notAnswered: false, setByCoordinator: false, correctionRequested: false, correctionNote: '' };
const second = { ...person, matric: 'S002', name: 'Second Student' };
const token = () => String(previewVersion).padStart(64, '0');
const unanswered = { semester: 'Semester I 2026/2027', code: 'WQD7025', name: 'Data Science Research Project', answer: null, canChange: true, correction: null };
let studentQuestion: (Omit<typeof unanswered, 'answer'> & { answer: 'YES' | 'NO' | null }) | null = null;
let projectStatus = { semesterId: 7, state: 'NOT_STARTED', stage: null as string | null };
let studentReads = 0;
const studentAnswers: string[] = [];
const timelineEntry = (id: number, level: 'P1' | 'P2', title: string, deadlineEnd: string, extra = {}) => ({
  id, level, title, deadlineStart: deadlineEnd, deadlineEnd, status: 'Upcoming',
  step: id, detail: '', action: '', weekLabel: '', targetRoles: ['STUDENT'], displayOrder: id, ...extra,
});
window.fetch = async (input, init) => {
  const url = new URL(String(input), location.origin);
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
  if (url.pathname.endsWith('/project-stages/mine/')) {
    if (init?.method === 'POST') {
      const { answer } = JSON.parse(String(init.body));
      if (!studentQuestion?.canChange || !['YES', 'NO'].includes(answer)) return json({ error: 'Invalid answer' }, 409);
      studentAnswers.push(answer);
      studentQuestion = { ...studentQuestion, answer, canChange: false };
      projectStatus = { ...projectStatus, state: answer === 'YES' ? 'ON_PROJECT' : 'NOT_STARTED', stage: answer === 'YES' ? 'P1' : null };
    } else {
      studentReads++;
    }
    return json({ question: studentQuestion, projectStatus });
  }
  if (url.pathname.endsWith('/academics/semesters/active/')) return json({ semester: {
    id: 7, label: 'Semester I 2026/2027', effectiveStatus: 'ACTIVE',
    startsOn: '2026-10-30', endsOn: '2027-06-01',
  } });
  if (url.pathname.endsWith('/dashboard/timeline/active/')) return json({ available: true, semesterId: 7, levels: [
    { level: 'P1', entries: [timelineEntry(1, 'P1', 'RP1 proposal', '2099-02-01')] },
    { level: 'P2', entries: [
      timelineEntry(2, 'P2', 'RP2 final report', '2099-04-01'),
      timelineEntry(3, 'P2', 'RP2 presentation', '2099-03-01'),
      timelineEntry(4, 'P2', 'Past RP2 event', '2020-01-02', { status: 'Ended' }),
    ] },
  ] });
  if (url.pathname.endsWith('/dashboard/tasks/')) return json({ tasks: [] });
  if (url.pathname.endsWith('/appointments/supervisor/applications/')) return json([]);
  if (url.pathname.endsWith('/appointments/panel/student/')) return json({ status: 'PENDING', readinessState: 'SUPERVISOR_REQUIRED' });
  if (url.pathname.endsWith('/impact/')) {
    if (deferImpact) await new Promise<void>(resolve => { pending = resolve; });
    if (failImpact) return json({ error: 'Synthetic impact failure' }, 503);
    previewVersion++;
    return json({ notStarted: 1, draft: 1, submitted: 1, token: token() });
  }
  if (url.pathname.endsWith('/change/')) {
    const body = JSON.parse(String(init?.body));
    writes.push(body);
    if (body.students.length > 1) {
      return json({ changed: ['S002'], leftOut: [{ matric: 'S001', name: person.name, why: 'Has Marks tasks. Change this student on their own.' }] });
    }
    return staleSave ? json({ error: 'Marks has changed since you checked. Look again.' }, 409)
      : json({ changed: ['S001'], leftOut: [] });
  }
  if (url.pathname.endsWith('/project-stages/')) {
    return json({ semester: { id: 7, label: '2026/2027 Semester I', current: true },
      semesters: [{ id: 7, label: '2026/2027 Semester I' }], rows: [person, second],
      notStudying: 0, canChange: true, reasons: [{ value: 'WRONG_ANSWER', label: 'Wrong answer' }] });
  }
  throw new Error(`Unexpected HTTP request: ${url.pathname}`);
};
const root = createRoot(document.getElementById('root')!);
root.render(<MemoryRouter><ProjectStages /></MemoryRouter>);
const scenario = async (name: string, run: () => Promise<void>) => {
  try { await run(); results.push({ name }); } catch (error) { results.push({ name, error: String(error) }); }
};
await scenario('Bulk skipped rows stay actionable', async () => {
  await openChange(person.name, second.name);
  await click('Save');
  await until(() => document.body.innerText.includes('Change this student on their own.'));
  check(studentTick(person.name), 'Individual review unavailable');
});
await scenario('Failed preview blocks save and can retry', async () => {
  failImpact = true;
  await openChange(person.name);
  await until(() => document.body.innerText.includes('Synthetic impact failure'));
  check(button('Save').disabled, 'Failed preview allowed save');
  failImpact = false;
  await click('Retry preview');
  await until(acknowledgement);
  check(button('Save').disabled, 'Unchecked impact allowed save');
  acknowledgement().click(); await pause();
  check(!button('Save').disabled, 'Reviewed impact cannot save');
});
await scenario('Stale save forces a fresh impact acknowledgement', async () => {
  const reviewed = token();
  staleSave = true; await click('Save');
  await until(() => document.body.innerText.includes('Marks has changed since you checked'));
  check(button('Save').disabled, 'Stale acknowledgement remained usable');
  check(writes[1].token === reviewed && writes[1].checked === true, 'Reviewed token or acknowledgement missing');
  await click('Retry preview');
  await until(acknowledgement);
  check(!acknowledgement().checked, 'Fresh impact reused the acknowledgement');
});
await scenario('Changed proposed stage cannot reuse previous impact', async () => {
  deferImpact = true;
  acknowledgement().click(); await pause();
  await click('Not started');
  check(button('Save').disabled, 'Stage switch reused old impact');
  await until(() => pending); deferImpact = false; pending!(); await until(acknowledgement);
  check(!acknowledgement().checked, 'Stage switch reused old acknowledgement');
  check(document.documentElement.scrollWidth <= innerWidth + 1, 'Page overflows viewport');
});
await scenario('Retry sends the fresh preview token', async () => {
  staleSave = false;
  const reviewed = token();
  acknowledgement().click(); await pause();
  await click('Save');
  await until(() => !document.querySelector('dialog[open]'));
  check(writes.length === 3 && writes[2].stage === 'NONE' && writes[2].token === reviewed && reviewed !== writes[1].token,
    'Save did not use the new stage and fresh token');
});
const studentCard = () => document.querySelector('section[aria-label="Research Project Registration"]');
const showStudentDashboard = (key: string) => {
  root.render(<MemoryRouter key={key}><StudentDashboard studentName="Coursework Student" studentId="S001" onNavigateToTab={() => {}} onNavigateToRoute={() => {}} /></MemoryRouter>);
};
await scenario('First-semester students see no declaration when Registry returns no question', async () => {
  showStudentDashboard('first-semester');
  await until(() => studentReads === 1);
  await pause();
  check(document.getElementById('student-dashboard-container'), 'Student dashboard failed to render');
  check(!studentCard(), 'Declaration shown without a question');
});
for (const [answer, label, savedText] of [
  ['YES', 'Yes, I have registered', 'Registered: WQD7025'],
  ['NO', 'No, not this semester', 'Not registered for the Research Project this semester'],
] as const) {
  await scenario(`Eligible coursework student can answer ${answer} once and see the saved answer`, async () => {
    studentQuestion = { ...unanswered };
    showStudentDashboard(answer);
    await until(() => button(label));
    check(studentCard()?.textContent?.includes('WQD7025 Data Science Research Project in MAYA'), 'Course or MAYA question missing');
    const before = studentAnswers.length;
    await click(label);
    check(studentAnswers.length === before, 'Answer sent before confirmation');
    await click('Confirm');
    await until(() => button('Request a correction'));
    check(studentAnswers.length === before + 1 && studentAnswers.at(-1) === answer, 'Wrong answer submitted');
    check(!button('Yes, I have registered') && !button('No, not this semester'), 'Question still available after answering');
    check(studentCard()?.textContent?.includes(savedText), 'Saved answer missing');
    const stage = () => document.querySelector('header[aria-label="Dashboard overview"] [aria-label="Project stage"]');
    await until(() => stage()?.textContent?.includes(answer === 'YES' ? 'RP1' : 'Not started'));
    const deadline = document.querySelector('[aria-label="Next deadline"]');
    check(answer === 'YES' ? deadline?.textContent?.includes('RP1 proposal') : !deadline, 'Wrong deadline for saved answer');
    showStudentDashboard(`${answer}-reopened`);
    await until(() => button('Request a correction'));
    check(studentCard()?.textContent?.includes(savedText) && !button(label), 'Reopening showed an editable answer');
  });
}
await scenario('RP2 shows its next deadline and both timeline tabs stay available', async () => {
  studentQuestion = null;
  projectStatus = { semesterId: 7, state: 'ON_PROJECT', stage: 'P2' };
  showStudentDashboard('rp2');
  await until(() => button('Research Project 2')?.getAttribute('aria-pressed') === 'true');
  const timeline = document.getElementById('dashboard-semester-timeline-container');
  check(!/\b\d+ items?\b/.test(timeline?.innerText ?? ''), 'RP2 timeline shows an item count');
  const stage = document.querySelector('header[aria-label="Dashboard overview"] [aria-label="Project stage"]');
  check(stage?.textContent?.includes('RP2'), 'RP2 stage is missing from the dashboard header');
  const semester = document.querySelector('[aria-label="Active academic semester"]');
  check(stage && semester, 'Dashboard context is incomplete');
  check([...stage!.children].every(child => parseFloat(getComputedStyle(child).fontSize) >= 14), 'Project stage label or value is too small');
  const stageBounds = stage!.getBoundingClientRect();
  const semesterBounds = semester!.getBoundingClientRect();
  const recordBounds = button('View My Academic Record').getBoundingClientRect();
  if (innerWidth >= 768) {
    check(stageBounds.left >= semesterBounds.right && stageBounds.top < semesterBounds.bottom, 'Stage does not share the semester row');
    check(Math.abs(stageBounds.right - recordBounds.right) < 2 && stageBounds.top >= recordBounds.bottom, 'Stage is not aligned below the academic record button');
  } else {
    check(stageBounds.top >= semesterBounds.bottom, 'Stage overlaps the semester details on mobile');
  }
  check(!timeline?.querySelector('[aria-label="Project stage"]'), 'Stage repeated inside the timeline');
  const summary = timeline?.querySelector('[aria-label="Next deadline"]');
  check(summary?.textContent?.includes('RP2 presentation') && summary.textContent.includes('01 Mar 2099'), 'Nearest RP2 deadline missing');
  check(!summary?.textContent?.includes('RP1 proposal'), 'RP1 deadline featured for RP2 student');
  await click('Research Project 1');
  check(!/\b\d+ items?\b/.test(timeline?.innerText ?? ''), 'RP1 timeline shows an item count');
  check(button('Research Project 1').getAttribute('aria-pressed') === 'true', 'Student could not select RP1');
  check(stage?.textContent?.includes('RP2'), 'Browsing RP1 changed the displayed project stage');
  check(summary?.textContent?.includes('RP2 presentation'), 'Browsing RP1 changed the featured RP2 deadline');
  check(document.documentElement.scrollWidth <= innerWidth + 1, 'Student dashboard overflows viewport');
});
window.parent.postMessage({ type: 'project-stages-results', results }, location.origin);
