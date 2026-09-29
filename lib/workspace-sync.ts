'use client';

export type WorkspaceScope = 'patient' | 'doctor';

const STORAGE_KEY = 'vediora_workspace_updated';
const EVENT_NAME = 'vediora:workspace-updated';

export function markWorkspaceUpdated(scope: WorkspaceScope) {
  if (typeof window === 'undefined') return;
  const detail = { scope, timestamp: Date.now() };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(detail));
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
}

export function subscribeToWorkspaceUpdates(scope: WorkspaceScope, refresh: () => void) {
  if (typeof window === 'undefined') return () => undefined;
  const onCustom = (event: Event) => {
    const detail = (event as CustomEvent<{ scope?: WorkspaceScope }>).detail;
    if (detail?.scope === scope) refresh();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try { if ((JSON.parse(event.newValue) as { scope?: WorkspaceScope }).scope === scope) refresh(); } catch { /* Ignore malformed browser storage. */ }
  };
  const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) refresh(); };
  window.addEventListener(EVENT_NAME, onCustom);
  window.addEventListener('storage', onStorage);
  window.addEventListener('pageshow', onPageShow);
  return () => {
    window.removeEventListener(EVENT_NAME, onCustom);
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('pageshow', onPageShow);
  };
}
