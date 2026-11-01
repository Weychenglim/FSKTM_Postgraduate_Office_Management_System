import assert from 'node:assert/strict';
import { answerRollCall, claimTabName, rollCall } from './browserTab';

const storageOver = (store: Map<string, string>) => ({
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value); },
  removeItem: (key: string) => { store.delete(key); },
});
const store = new Map<string, string>();
const storage = storageOver(store);
let hidden = false;
let made = 0;
const makeName = () => `tab-name-${++made}`;

const page = new EventTarget();
const name = claimTabName(storage, page, () => hidden, makeName);
assert.equal(name, 'tab-name-1');
assert.equal(store.size, 0, 'the name is not left where a duplicated tab would copy it');

const duplicate = claimTabName(storageOver(new Map(store)), new EventTarget(), () => false, makeName);
assert.notEqual(duplicate, name, 'a duplicated tab gets a name of its own');

hidden = true;
page.dispatchEvent(new Event('visibilitychange'));
assert.equal(store.get('fsktm:tab'), name, 'a hidden tab keeps its name in case it is discarded');
hidden = false;
page.dispatchEvent(new Event('visibilitychange'));
assert.equal(store.size, 0);

page.dispatchEvent(new Event('pagehide'));
const reloaded = claimTabName(storage, new EventTarget(), () => false, makeName);
assert.equal(reloaded, name, 'a reload keeps the name');

const open = new BroadcastChannel('fsktm-tabs-test');
const other = new BroadcastChannel('fsktm-tabs-test');
const asking = new BroadcastChannel('fsktm-tabs-test');
answerRollCall(open, 'tab-open-one');
answerRollCall(other, 'tab-open-two');
assert.deepEqual((await rollCall(asking, 100)).sort(), ['tab-open-one', 'tab-open-two'], 'open tabs answer the roll call');
assert.deepEqual(await rollCall(null), [], 'without BroadcastChannel no tab is kept');
open.close();
other.close();
asking.close();

console.log('Each tab keeps its own name and open tabs answer the roll call');
