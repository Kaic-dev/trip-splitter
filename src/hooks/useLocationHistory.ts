import { useState, useEffect, useCallback, useRef } from 'react';
import { Preferences } from '@capacitor/preferences';
import type { Address } from '../types';
import { normalizeString } from '../core/normalization';
import { createLogger, classifyLocation, flowManager } from '../core/logger';

const HISTORY_KEY = 'location_history_v2';
const MAX_HISTORY = 20;

const logger = createLogger('History');

export function useLocationHistory() {
  const [history, setHistory] = useState<Address[]>([]);
  const persistenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // EXECUTION GUARDS (CRITICAL FOR REACT STRICT MODE / MULTIPLE HOOKS)
  const lastSavedKeyRef = useRef<string | null>(null);
  const isSavingRef = useRef<boolean>(false);

  const getNormalizedKey = (addr: Address) => {
    return normalizeString(addr.label || addr.name || '');
  };

  const loadHistory = useCallback(async () => {
    try {
      const { value } = await Preferences.get({ key: HISTORY_KEY });
      if (value) {
        const parsed = JSON.parse(value);
        setHistory(parsed);
        logger.debug('Loaded history', { items: parsed.length, source: 'PREFERENCES' });
      } else {
        const local = localStorage.getItem(HISTORY_KEY);
        if (local) {
          const parsed = JSON.parse(local);
          setHistory(parsed);
          logger.debug('Loaded history', { items: parsed.length, source: 'LOCALSTORAGE' });
        }
      }
    } catch (err) {
      logger.error('Failed to load history', err);
    }
  }, []);

  const saveToStorage = useCallback((data: Address[], flowId?: string) => {
    if (persistenceTimer.current) clearTimeout(persistenceTimer.current);
    const flowLogger = flowId ? logger.withFlow(flowId) : logger;
    
    persistenceTimer.current = setTimeout(async () => {
      const json = JSON.stringify(data);
      try {
        await Preferences.set({ key: HISTORY_KEY, value: json });
        flowLogger.debug('History persisted successfully', { count: data.length });
      } catch (err) {
        localStorage.setItem(HISTORY_KEY, json);
        flowLogger.warn('History persisted to fallback storage');
      }
    }, 500); 
  }, []);

  const saveLocation = useCallback((address: Address, flowId?: string) => {
    if (!address.label || !address.coordinates) return;

    const flowLogger = flowId ? logger.withFlow(flowId) : logger;
    flowLogger.group('HISTORY UPDATE', { label: address.label });

    // 2. Anti-Race / Concurrent Execution Lock
    if (isSavingRef.current) {
       flowLogger.debug('HISTORY SKIPPED', { reason: 'BUSY_SAVING' });
       flowLogger.groupEnd();
       return;
    }

    const newKey = getNormalizedKey(address);

    // 3. Last-Saved Guard (Strict Mode / Rapid Clicks)
    if (lastSavedKeyRef.current === newKey) {
      flowLogger.warn('HISTORY SKIPPED', { reason: 'IDENTICAL_TO_LAST' });
      flowLogger.groupEnd();
      return;
    }

    isSavingRef.current = true;
    lastSavedKeyRef.current = newKey;

    const existingIndex = history.findIndex(item => getNormalizedKey(item) === newKey);
    const isUpdate = existingIndex !== -1;
    const classification = classifyLocation(address);
    const reason = isUpdate ? 'USER_SELECTION' : 'NEW_LOCATION';

    flowLogger.historyDecision({
      action: isUpdate ? 'MOVE_TO_TOP' : 'ADD_NEW',
      reason,
      entityType: classification,
      size: isUpdate ? history.length : history.length + 1
    });

    if (flowId) {
      // Assuming flowManager is available in scope or imported elsewhere
      // For example: import { flowManager } from '../core/flowManager';
      // This line is added as per instruction, assuming flowManager exists.
      flowManager.addExplanation(flowId, `Location ${isUpdate ? 'moved to top of' : 'added to'} history`);
    }

    try {
      setHistory(prev => {
        const idx = prev.findIndex(item => getNormalizedKey(item) === newKey);
        let updated: Address[];
        if (idx !== -1) {
          const filtered = prev.filter((_, i) => i !== idx);
          updated = [address, ...filtered];
        } else {
          updated = [address, ...prev].slice(0, MAX_HISTORY);
        }
        saveToStorage(updated, flowId);
        return updated;
      });
    } finally {
      setTimeout(() => {
        isSavingRef.current = false;
        flowLogger.groupEnd();
      }, 100);
    }
  }, [history, saveToStorage]);

  useEffect(() => {
    loadHistory();
    return () => {
      if (persistenceTimer.current) clearTimeout(persistenceTimer.current);
    };
  }, [loadHistory]);

  return { history, saveLocation, refreshHistory: loadHistory };
}
