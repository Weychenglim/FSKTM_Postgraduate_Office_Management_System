/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useNavigate } from 'react-router';
import { SegmentedControl } from './PortalPrimitives';
import { APP_ROUTES } from '../constants/routes';

export type RegistryModuleTab = 'students' | 'staff_lecturers' | 'programmes' | 'acting_coordinators';

const TABS: readonly RegistryModuleTab[] = ['students', 'staff_lecturers', 'programmes', 'acting_coordinators'];
const TAB_ROUTES: Record<RegistryModuleTab, string> = {
  students: APP_ROUTES.registry,
  staff_lecturers: APP_ROUTES.registryStaff,
  programmes: APP_ROUTES.registryProgrammes,
  acting_coordinators: APP_ROUTES.registryActingCoordinators,
};

// Registry tabs, under each list heading. Each tab is its own page, so the
// browser's Back button moves between them. Office staff only.
export const RegistryModuleTabs: React.FC<{ active: RegistryModuleTab }> = ({ active }) => {
  const navigate = useNavigate();
  return (
    <SegmentedControl
      variant="tabs"
      options={TABS}
      value={active}
      onChange={tab => {
        if (tab !== active) navigate(TAB_ROUTES[tab]);
      }}
      labels={{ students: 'Students', staff_lecturers: 'Staff & Lecturers', programmes: 'Programmes', acting_coordinators: 'Acting coordinators' }}
    />
  );
};
