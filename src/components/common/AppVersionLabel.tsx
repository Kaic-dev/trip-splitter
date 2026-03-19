import { getAppVersion } from '../../utils/appVersion';

export function AppVersionLabel() {
  // Always show version for traceability

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        fontSize: '10px',
        fontWeight: 'bold',
        fontFamily: 'SFMono-Regular, Consolas, monospace',
        color: '#fff',
        background: 'rgba(0,0,0,0.65)',
        padding: '3px 8px',
        borderRadius: '6px',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.15)',
        zIndex: 100000, // Top of any other UI
        pointerEvents: 'none',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
      }}
    >
      v{getAppVersion()}
    </div>
  );
}
