import React from 'react';
import type { PanelState } from '../../hooks/layout/useBottomPanelState';
import { useDragSheet } from '../../hooks/useDragSheet';

interface BottomPanelProps {
  state: PanelState;
  onStateChange: (state: PanelState) => void;
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  isDesktop?: boolean;
}

export const BottomPanel: React.FC<BottomPanelProps> = ({ 
  state, 
  onStateChange, 
  children,
  header,
  footer,
  isDesktop = false
}) => {
  const { style, handlers, visualY } = useDragSheet({
    initialPosition: state,
    onSnap: onStateChange
  });

  if (isDesktop) {
    return (
      <div className="side-panel">
        <div className="panel-top">
          {header && <div className="panel-header">{header}</div>}
        </div>
        <div className="panel-content">
          {children}
        </div>
        {footer && <div className="panel-footer">{footer}</div>}
      </div>
    );
  }

  return (
    <div 
      className="bottom-panel" 
      style={{ 
        ...style, 
        zIndex: 1000,
        backgroundColor: 'var(--surface)',
        maxHeight: '100dvh',
        paddingBottom: isDesktop ? 0 : `calc(${visualY}px + env(safe-area-inset-bottom, 20px))`
      }}
    >
      <div className="panel-top" style={{ flexShrink: 0 }} {...handlers}>
        <div className="drag-handle-container">
          <div className="drag-handle" />
        </div>
        {header && (
          <div className="panel-header">
            {header}
          </div>
        )}
      </div>

      <div className="panel-content">
        {children}
      </div>

      {footer && (
        <div className="panel-footer">
          {footer}
        </div>
      )}
    </div>
  );
};
