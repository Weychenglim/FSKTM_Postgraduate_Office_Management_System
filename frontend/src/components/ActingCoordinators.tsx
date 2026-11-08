/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CoordinatorDelegations } from './CoordinatorDelegations';
import { PageHeader } from './PortalPrimitives';
import { RegistryModuleTabs } from './RegistryModuleTabs';

/** Registry's Acting coordinators tab: a coordinator also covers another programme for a set time. */
export const ActingCoordinators: React.FC = () => (
  <div className="space-y-6">
    <PageHeader title="Acting Coordinators" />
    <RegistryModuleTabs active="acting_coordinators" />
    <CoordinatorDelegations office />
  </div>
);
