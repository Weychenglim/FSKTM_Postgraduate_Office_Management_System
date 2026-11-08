import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdministrationDashboard } from './AdministrationDashboard';
import { isKnownAppPath } from '../constants/routes';
import {readFileSync} from 'node:fs';

test('home exposes seven tools without the rejected navigation strip or dropdown',()=>{
  const html=renderToStaticMarkup(<AdministrationDashboard onNavigateToTab={()=>{}}/>);
  assert.doesNotMatch(html,/Office Dashboard pages|Dashboard page|office-administration-menu|Routine monitoring/);
  assert.equal((html.match(/data-office-tool=/g)??[]).length,7);
  assert.match(html,/Semester and dates/);assert.match(html,/Capacity and workload/);assert.match(html,/Reports and checks/);
  assert.match(html,/home-overview-grid/);
  assert.doesNotMatch(readFileSync(new URL('./OfficeDashboardLayout.tsx',import.meta.url),'utf8'),/Office Dashboard pages|office-administration-menu|office-mobile-navigation/);
});

test('Office finds attention before calendar, with participants managed in Registry', () => {
  const html = renderToStaticMarkup(<AdministrationDashboard onNavigateToTab={() => {}} />);
  const attention = html.indexOf('Needs attention');
  const calendar = html.indexOf('Semester Timeline');
  assert.ok(attention >= 0 && attention < calendar, 'Attention must precede calendar');
  assert.doesNotMatch(html, /Manage Participants/);
});

test('independent periods workspace is a known route without replacing protected route', () => {
  assert.equal(isKnownAppPath('/dashboard/periods'), true);
  assert.equal(isKnownAppPath('/dashboard/participant-lifecycle'), true);
});
