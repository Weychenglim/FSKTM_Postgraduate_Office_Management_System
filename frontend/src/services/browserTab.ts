/**
 * Each browser tab keeps its own sign-in, so two tabs can hold two accounts.
 * The tab's name goes with every API request; the backend keeps the tab's
 * refresh cookie under that name.
 */

type TabStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const NAME_KEY = 'fsktm:tab';
const CHANNEL = 'fsktm-tabs';

/**
 * The tab's name, kept across reloads. It is left out of sessionStorage while
 * the page is showing, so a duplicated tab gets a name of its own.
 */
export function claimTabName(
  storage: TabStorage,
  page: EventTarget,
  isHidden: () => boolean,
  makeName: () => string,
): string {
  const name = storage.getItem(NAME_KEY) || makeName();
  const keep = () => {
    try { storage.setItem(NAME_KEY, name); } catch { return; }
  };
  const release = () => {
    try { storage.removeItem(NAME_KEY); } catch { return; }
  };
  release();
  page.addEventListener('pagehide', keep);
  page.addEventListener('pageshow', release);
  page.addEventListener('visibilitychange', () => (isHidden() ? keep() : release()));
  return name;
}

export function answerRollCall(channel: BroadcastChannel, name: string): void {
  channel.addEventListener('message', (event: MessageEvent) => {
    if (event.data?.type === 'roll-call') channel.postMessage({ type: 'here', tab: name });
  });
}

/** The names of the other tabs open on the portal in this browser. */
export async function rollCall(channel: BroadcastChannel | null, waitMs = 150): Promise<string[]> {
  if (!channel) return [];
  const names = new Set<string>();
  const listen = (event: MessageEvent) => {
    if (event.data?.type === 'here' && typeof event.data.tab === 'string') names.add(event.data.tab);
  };
  channel.addEventListener('message', listen);
  channel.postMessage({ type: 'roll-call' });
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  channel.removeEventListener('message', listen);
  return [...names];
}

function randomName(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function startTab(): { name: string | null; channel: BroadcastChannel | null } {
  if (typeof window === 'undefined') return { name: null, channel: null };
  let name: string | null = null;
  try {
    name = claimTabName(window.sessionStorage, window, () => document.visibilityState === 'hidden', randomName);
  } catch {
    return { name: null, channel: null };
  }
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL) : null;
  if (channel) answerRollCall(channel, name);
  return { name, channel };
}

const tab = startTab();

export const TAB_NAME = tab.name;

export function otherOpenTabs(): Promise<string[]> {
  return rollCall(tab.channel);
}
