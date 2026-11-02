import React from 'react';
import type {SupervisorAcceptanceCapacity} from '../types';
import {AlertMessage} from './AlertMessage';

export function PanelAcceptanceMessage({capacity}:{capacity?:SupervisorAcceptanceCapacity|null}) {
  const other=Math.max(0,(capacity?.pendingRequests??0)-1);
  return capacity?.state==='AVAILABLE'&&capacity.availableSlots===1
    ? <AlertMessage type="warning" title="Last available place" message={<>
        <p>Accepting reserves this place until Coordinator approval.</p>
        {other>0?<p className="mt-2">{other} other pending {other===1?'nomination':'nominations'} may close after final approval.</p>:null}
      </>}/>
    : <>Acceptance reserves a place while the Programme Coordinator makes the final decision.</>;
}
