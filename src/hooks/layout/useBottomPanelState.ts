import { useState, useCallback, useEffect } from 'react';

export type PanelState = 'collapsed' | 'medium' | 'expanded';

const LS_PANEL_STATE = 'trip_panel_state';

export function useBottomPanelState(initialState: PanelState = 'medium') {
  const [panelState, setPanelState] = useState<PanelState>(initialState);

  // Persistence: Restore on load
  useEffect(() => {
    const saved = localStorage.getItem(LS_PANEL_STATE) as PanelState;
    if (saved && (saved === 'collapsed' || saved === 'medium' || saved === 'expanded')) {
      setPanelState(saved);
    }
  }, []);

  const setPersistentState = useCallback((state: PanelState) => {
    setPanelState(state);
    localStorage.setItem(LS_PANEL_STATE, state);
  }, []);

  const setCollapsed = useCallback(() => setPersistentState('collapsed'), [setPersistentState]);
  const setMedium = useCallback(() => setPersistentState('medium'), [setPersistentState]);
  const setExpanded = useCallback(() => setPersistentState('expanded'), [setPersistentState]);

  const toggle = useCallback(() => {
    setPanelState((current) => {
      const next: PanelState = current === 'collapsed' ? 'medium' : current === 'medium' ? 'expanded' : 'collapsed';
      localStorage.setItem(LS_PANEL_STATE, next);
      return next;
    });
  }, []);

  return {
    panelState,
    setPanelState: setPersistentState,
    setCollapsed,
    setMedium,
    setExpanded,
    toggle
  };
}
