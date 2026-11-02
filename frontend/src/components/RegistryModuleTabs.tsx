/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useNavigate } from 'react-router';
import { SegmentedControl } from './PortalPrimitives';
import { APP_ROUTES } from '../constants/routes';

export type RegistryModuleTab = 'students' | 'staff_lecturers' | 'transfers';

const OFFICE_TABS: readonly RegistryModuleTab[] = ['students', 'staff_lecturers', 'transfers'];
const COORDINATOR_TABS: readonly RegistryModuleTab[] = ['students', 'transfers'];
const TAB_ROUTES: Record<RegistryModuleTab, string> = {
  students: APP_ROUTES.registry,
  staff_lecturers: APP_ROUTES.registryStaff,
  transfers: APP_ROUTES.registryTransfers,
};

// Registry tabs, under each list heading. Each tab is its own page, so the
// browser's Back button moves between them. Coordinators see no staff tab.
export const RegistryModuleTabs: React.FC<{ active: RegistryModuleTab; office?: boolean }> = ({ active, office = true }) => {
  const navigate = useNavigate();
  return (
    <SegmentedControl
      variant="tabs"
      options={office ? OFFICE_TABS : COORDINATOR_TABS}
      value={active}
      onChange={tab => {
        if (tab !== active) navigate(TAB_ROUTES[tab]);
      }}
      labels={{ students: 'Students', staff_lecturers: 'Staff & Lecturers', transfers: 'Programme transfers' }}
    />
  );
};
