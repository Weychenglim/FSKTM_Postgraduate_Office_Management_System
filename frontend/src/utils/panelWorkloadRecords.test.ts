import { PanelWorkloadRecord } from '../types';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getPanelWorkloadSummary, getPanelWorkloadUtilization } from './panelWorkloadRecords';

const rows: PanelWorkloadRecord[] = [
  {
    id: 'L1',
    name: 'Available Lecturer',
    department: 'Data Science',
    currentStudents: 2,
    workloadLimit: 5,
    availability: 'Available',
    initials: 'AL',
    confirmedAppointments: 2,
    pendingNominations: 0,
    workloadItems: [],
  },
  {
    id: 'L2',
    name: 'Near Lecturer',
    department: 'Software Engineering',
    currentStudents: 4,
    workloadLimit: 5,
    availability: 'Near Limit',
    initials: 'NL',
    confirmedAppointments: 2,
    pendingNominations: 2,
    workloadItems: [],
  },
  {
    id: 'L3',
    name: 'Full Lecturer',
    department: 'Artificial Intelligence',
    currentStudents: 5,
    workloadLimit: 5,
    availability: 'Full Load',
    initials: 'FL',
    confirmedAppointments: 1,
    pendingNominations: 4,
    workloadItems: [],
  },
];

const summary = getPanelWorkloadSummary(rows);

if (summary.totalPanels !== 3) throw new Error(`Expected 3 panels, got ${summary.totalPanels}`);
if (summary.available !== 1) throw new Error(`Expected 1 available, got ${summary.available}`);
if (summary.nearLimit !== 1) throw new Error(`Expected 1 near limit, got ${summary.nearLimit}`);
if (summary.fullLoad !== 1) throw new Error(`Expected 1 full load, got ${summary.fullLoad}`);

if (getPanelWorkloadUtilization({ ...rows[0], currentStudents: 6, workloadLimit: 5 }) !== 100) {
  throw new Error('Utilization should clamp overloaded panel members to 100%.');
}

if (getPanelWorkloadUtilization({ ...rows[0], currentStudents: 2, workloadLimit: 0 }) !== 0) {
  throw new Error('Utilization should be 0% when workload limit is zero.');
}

if (getPanelWorkloadUtilization({ ...rows[0], currentStudents: Number.NaN }) !== 0) {
  throw new Error('Utilization should be 0% when workload is malformed.');
}

for (const component of [
  'src/components/SupervisorWorkloadMonitoring.tsx',
  'src/components/PanelWorkloadMonitoring.tsx',
]) {
  const source = readFileSync(resolve(component), 'utf8');
  for (const header of [
    'Semester Code',
    'Plan Version',
    'Capacity State',
    'Active Load',
    'Reserved Load',
    'Available Slots',
    'Unavailable Until',
  ]) {
    if (!source.includes(header)) {
      throw new Error(`${component} must export ${header}.`);
    }
  }
  if (/availabilityReason|internalReason/.test(source)) {
    throw new Error(`${component} must not expose Office-internal availability reasons.`);
  }
}

const lecturerDashboardSource = readFileSync(
  resolve('src/components/LecturerDashboard.tsx'),
  'utf8',
);
for (const token of [
  'getOwnSupervisorWorkload',
  'getOwnPanelWorkload',
  'capacityStateLabel',
  'capacityUtilization',
  'AppointmentWorkloadDetails',
]) {
  if (!lecturerDashboardSource.includes(token)) {
    throw new Error(`Lecturer Dashboard must render persisted ${token} capacity metadata.`);
  }
}

const lecturerPanelSource = readFileSync(
  resolve('src/components/LecturerPanelAppointments.tsx'),
  'utf8',
);
if (!lecturerPanelSource.includes('getOwnPanelWorkload')) {
  throw new Error('Lecturer Panel Appointments must load the current Lecturer panel capacity.');
}
if (/currentUserCandidate[\s\S]{0,250}\?\s*currentUserCandidate\.workloadLimit\s*:\s*10/.test(lecturerPanelSource)) {
  throw new Error('Lecturer panel capacity must not fall back to an invented limit of 10.');
}

const lecturerSupervisorSource = readFileSync(
  resolve('src/components/LecturerAppointmentRequests.tsx'),
  'utf8',
);
for (const token of ['capacityState', 'workloadLimit', 'unavailableUntil']) {
  if (!lecturerSupervisorSource.includes(token)) {
    throw new Error(`Lecturer Supervisor Appointments must show ${token}.`);
  }
}

console.log('panelWorkloadRecords tests passed');
