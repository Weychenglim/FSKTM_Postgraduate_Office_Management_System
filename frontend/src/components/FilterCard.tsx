/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PortalSelect } from './PortalSelect';
import React from 'react';
import { Upload, CheckCircle2 } from 'lucide-react';
import { PortalButton, StatusBadge } from './PortalPrimitives';

interface FilterCardProps {
  semester: string;
  setSemester: (sem: string) => void;
  stage: string;
  setStage: (stage: string) => void;
  statusText?: string;
  onExportAction?: () => void;
}

export const FilterCard: React.FC<FilterCardProps> = ({
  semester,
  setSemester,
  stage,
  setStage,
  statusText = 'READY',
  onExportAction
}) => {
  const semesters = [
    { value: 'Sem 1 2025/2026', label: 'Sem 1 2025/2026' },
    { value: 'Sem 2 2025/2026', label: 'Sem 2 2025/2026' },
    { value: 'Sem 1 2024/2025', label: 'Sem 1 2024/2025' }
  ];

  const stages = [
    { value: 'EE Evaluation', label: 'EE Evaluation' },
    { value: 'Proposal Evaluation', label: 'Proposal Evaluation' },
    { value: 'Viva Oral Defense', label: 'Viva Oral Defense' }
  ];

  return (
    <div id="rubrics-filter-panel" className="bg-white rounded-2xl border border-slate-200/80 p-5 md:px-6 md:py-5 flex flex-col md:flex-row md:items-center justify-between gap-5 text-left shadow-3xs">
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Semester Filter */}
        <div className="flex flex-col">
          <label className="form-label block label-semester">
            Semester
          </label>
          <div className="relative">
            <PortalSelect
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="form-control form-control-md appearance-none pr-10 cursor-pointer"
            >
              {semesters.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </PortalSelect>

          </div>
        </div>

        {/* Evaluation Stage Filter */}
        <div className="flex flex-col">
          <label className="form-label block label-evaluation-stage">
            Evaluation stage
          </label>
          <div className="relative">
            <PortalSelect
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              className="form-control form-control-md appearance-none pr-10 cursor-pointer"
            >
              {stages.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </PortalSelect>

          </div>
        </div>
      </div>

      {/* Right side: Status ready chip + Upload indicator */}
      <div className="flex items-center gap-4 shrink-0 justify-end pt-2 md:pt-4">
        <StatusBadge tone="success" icon={CheckCircle2}>{statusText}</StatusBadge>

        <PortalButton
          onClick={onExportAction}
          variant="secondary"
          size="icon"
          icon={Upload}
          title="Share/Upload configuration"
        />
      </div>
    </div>
  );
};
