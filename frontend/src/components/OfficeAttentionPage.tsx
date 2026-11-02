import React,{useCallback,useEffect,useState} from 'react';
import {useLocation,useSearchParams} from 'react-router';
import {getOfficeAttention} from '../services/officeAttentionApi';
import {officeAttentionRecordRoute} from '../utils/officeAttention';
import {formatWaitingText} from '../utils/workflowAgeing';
import {PageHeader,PortalButton,StatusBadge} from './PortalPrimitives';
import {PortalSelect} from './PortalSelect';
import {OfficeToolSection} from './OfficeToolPrimitives';
import {CoordinatorDataTable} from './CoordinatorBrowsePrimitives';
import {WorkspacePagination,WorkspaceFilterActions} from './RequestWorkspacePrimitives';
import {LoadingState,ErrorState,EmptyState} from './StateViews';
import {useOfficeRead} from './useOfficeRead';
import {useListState} from './ListState';
import {useReturnToFocusReload} from '../utils/returnToFocus';

export function OfficeAttentionPage({onBack,onOpen}:{onBack:()=>void;onOpen:(route:string)=>void}) {
  const location=useLocation();
  const [,setParams]=useSearchParams();
  const [savedSearch,setSavedSearch]=useListState('OfficeAttention','search','');
  const query=location.search||savedSearch;
  const values=new URLSearchParams(query);
  const search=values.get('q')||'';
  const [debouncedSearch,setDebouncedSearch]=useState(search);
  useEffect(()=>{
    if(search===debouncedSearch)return;
    const timer=window.setTimeout(()=>setDebouncedSearch(search),200);
    return ()=>window.clearTimeout(timer);
  },[search,debouncedSearch]);
  const searchPending=search!==debouncedSearch;
  const requestKey=JSON.stringify(Object.fromEntries(['q','category','responsibility','programme','page','size'].map(key=>[key,key==='q'?debouncedSearch:values.get(key)||''])));
  const read=useCallback(()=>getOfficeAttention(JSON.parse(requestKey)),[requestKey]);
  const result=useOfficeRead(read);
  useReturnToFocusReload(()=>void result.reload(),!result.loading&&!searchPending);
  useEffect(()=>{
    if(!location.search&&savedSearch)setParams(savedSearch,{replace:true});
    else if(location.search)setSavedSearch(location.search);
  },[location.search,savedSearch,setSavedSearch,setParams]);
  const change=(key:string,value:string)=>{
    const next=new URLSearchParams(query);next.delete('view');
    if(value)next.set(key,value);else next.delete(key);
    if(key!=='page')next.delete('page');
    // An explicit all-view keeps remembered filters from restoring after Clear filters.
    if(!next.size)next.set('view','all');
    setParams(next,{replace:true});
  };
  const data=result.data;
  const categoryLabel=(key:string)=>data?.categories.find(category=>category.value===key)?.label||key;
  return <div className="space-y-6" id="office-attention-workspace">
    <PageHeader className="office-tool-heading" title="Needs attention" subtitle="Review outstanding issues and monitor records waiting on others." backLabel="Back to Dashboard" onBack={onBack}/>
    <OfficeToolSection title="Attention records" description="Requests include ongoing work from earlier semesters. Capacity uses the active semester; evaluations include active completion windows. Waiting time alone does not mean overdue.">
      <div className="office-tool-filters m-4 grid gap-3 rounded-xl border border-slate-200 sm:m-5 sm:grid-cols-2 lg:grid-cols-3">
        <label className="form-label sm:col-span-2 lg:col-span-3">Find a record<input type="search" className="form-control form-control-sm mt-1" placeholder="Name, record number or programme" value={values.get('q')||''} onChange={event=>change('q',event.target.value)}/></label>
        <label className="form-label">Responsibility<PortalSelect className="form-control form-control-sm mt-1" value={values.get('responsibility')||''} onChange={event=>change('responsibility',event.target.value)}><option value="">All responsibilities</option><option value="review">For Office review</option><option value="waiting">Waiting on others</option></PortalSelect></label>
        <label className="form-label">Category<PortalSelect className="form-control form-control-sm mt-1" value={values.get('category')||''} onChange={event=>change('category',event.target.value)}><option value="">All categories</option>{data?.categories.map(category=><option key={category.value} value={category.value}>{category.label}</option>)}</PortalSelect></label>
        <label className="form-label">Programme<PortalSelect className="form-control form-control-sm mt-1" value={values.get('programme')||''} onChange={event=>change('programme',event.target.value)}><option value="">All programmes / faculty-wide</option>{data?.programmes.map(programme=><option key={programme} value={programme}>{programme}</option>)}</PortalSelect></label>
        <div className="sm:col-span-2 lg:col-span-3"><WorkspaceFilterActions onReset={()=>setParams({view:'all'},{replace:true})}/></div>
      </div>
      <div className="p-4 sm:p-5 space-y-5">
        {result.loading||searchPending?<LoadingState message="Loading attention records…"/>:result.error?<ErrorState message={result.error} onRetry={result.reload}/>:!data?.results.length?<EmptyState title="No matching attention records" description="Try another category or clear the filters."/>:<>
          <div className="office-attention-records"><CoordinatorDataTable label="Office attention records" columns={['Record','Reason for attention','Responsibility','Programme','Action']} rows={data.results.map(row=>({key:row.id,cells:[
            <><p>{row.name}</p>{row.category!=='documents'&&<p className="card-caption mt-1">{row.semester||'Faculty-wide'}{row.recordId&&row.recordType!=='RECONCILIATION_ISSUE'?` · ${row.category==='capacity'?'Staff':'Record'} ${row.recordId}`:''}</p>}</>,
            row.category==='documents'
              ? <div className="space-y-2"><p>No active document requirements.</p><StatusBadge tone="warning">Setup required</StatusBadge></div>
              : <div className="space-y-2"><p>{categoryLabel(row.category)}</p><StatusBadge tone={row.urgency==='overdue'||row.urgency==='blocking'?'danger':row.urgency==='due'?'warning':'neutral'}>{row.urgency==='overdue'?'Overdue':row.urgency==='due'?'Due today':row.urgency==='blocking'?'Blocking issue':row.responsibility==='waiting'?'Awaiting review':row.category==='calendar'?'Setup required':row.statusText||'Review required'}</StatusBadge></div>,
            <><p>{row.responsibility==='waiting'?'Waiting on others':'For Office review'}</p>{row.waitingOn&&<p className="card-description mt-1">{formatWaitingText(row)}</p>}</>,row.programme,
            <PortalButton size="sm" onClick={()=>onOpen(officeAttentionRecordRoute(row))}>Open</PortalButton>,
          ]}))}/></div>
          <WorkspacePagination page={data.page} pageCount={data.pageCount} total={data.total} pageSize={data.pageSize} noun="attention records" onPage={page=>change('page',String(page))} onPageSize={size=>change('size',String(size))}/>
        </>}
      </div>
    </OfficeToolSection>
  </div>;
}
