import { useCallback, useEffect, useRef, useState } from 'react';
import type { DesktopSnapshot } from '../../companion/lib/desktop-snapshot.ts';
import type { DesktopCompanionApi } from '../types/desktop.d.ts';
import type { TurnoverRecord } from '../../companion/lib/turnover-contract.ts';
export function useMobileCompanionSnapshot({ enabled, hydrated, api, snapshot, beforeSync, onTurnovers }: { enabled: boolean; hydrated: boolean; api: DesktopCompanionApi | null; snapshot: DesktopSnapshot; beforeSync?: () => Promise<unknown>; onTurnovers?: (records: TurnoverRecord[], sent: DesktopSnapshot, canContinue: () => boolean) => Promise<void> }) {
  const [status, setStatus] = useState<{ busy: boolean; updatedAt: string; error: string }>({ busy: false, updatedAt: '', error: '' });
  const latest = useRef({ enabled, hydrated, snapshot, beforeSync, onTurnovers }); latest.current = { enabled, hydrated, snapshot, beforeSync, onTurnovers };
  const busy = useRef(false), lastPayload = useRef(''), lastSentAt = useRef(0);
  const syncNow = useCallback(async (force = true) => {
    const current = latest.current;
    if (!current.enabled || !current.hydrated || busy.current || !api?.syncSnapshot) return;
    const payload = JSON.stringify({ ...current.snapshot, generatedAt: '' });
    if (!force && payload === lastPayload.current && Date.now() - lastSentAt.current < (current.snapshot.turnoverSync ? 25_000 : 300_000)) return;
    busy.current = true; setStatus(s => ({ ...s, busy: true, error: '' }));
    try {
      if (!(await api.getStatus()).configured) throw new Error('Pair the companion before sharing a snapshot.');
      if (!latest.current.enabled) return;
      // Confirm the outgoing state is durable before the phone can show a desktop acknowledgment.
      await latest.current.beforeSync?.();
      if (!latest.current.enabled) return;
      const result = await api.syncSnapshot({ ...current.snapshot, generatedAt: new Date().toISOString() });
      if (result.ok === false) throw new Error(result.message || result.error || 'Snapshot could not sync.');
      if (!latest.current.enabled) return;
      if (result.turnovers) await latest.current.onTurnovers?.(result.turnovers, current.snapshot, () => latest.current.enabled && latest.current.hydrated);
      lastPayload.current = payload; lastSentAt.current = Date.now();
      setStatus({ busy: false, updatedAt: result.generatedAt || new Date().toISOString(), error: '' });
    } catch(error) { setStatus(s => ({ ...s, error: error instanceof Error ? error.message : 'Snapshot could not sync.' })); }
    finally { busy.current = false; setStatus(s => ({ ...s, busy: false })); }
  }, [api]);
  const clearSnapshot = useCallback(async () => {
    if (busy.current || !api?.clearSnapshot) return;
    busy.current = true; setStatus(s => ({ ...s, busy: true, error: '' }));
    try { const result = await api.clearSnapshot(); if (result.ok === false) throw new Error(result.message || result.error || 'Snapshot could not be cleared.'); lastPayload.current = ''; lastSentAt.current = 0; setStatus({ busy: false, updatedAt: '', error: '' }); }
    catch(error) { setStatus(s => ({ ...s, error: error instanceof Error ? error.message : 'Snapshot could not be cleared.' })); }
    finally { busy.current = false; setStatus(s => ({ ...s, busy: false })); }
  }, [api]);
  useEffect(() => {
    if (!enabled || !hydrated) return;
    const initial = window.setTimeout(() => void syncNow(false), 1500);
    const interval = window.setInterval(() => void syncNow(false), 30_000);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); };
  }, [enabled, hydrated, snapshot, syncNow]);
  return { status, syncNow, clearSnapshot };
}
