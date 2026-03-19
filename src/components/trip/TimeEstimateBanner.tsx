import type { ETAComparison } from '../../types';

interface Props {
  timeEstimate: {
    departureTime: Date;
    arrivalTime: Date;
    stopDelayMinutes: number;
  };
  durationMinutes: number;
  eta?: ETAComparison;
  formatTimeHHMM: (d: Date) => string;
  formatDuration: (minutes: number) => string;
}

export const TimeEstimateBanner: React.FC<Props> = ({ 
  timeEstimate, 
  durationMinutes, 
  eta,
  formatTimeHHMM, 
  formatDuration 
}) => {
  const hasTrafficData = eta?.withTraffic !== undefined;
  const trafficDiff = hasTrafficData ? (eta.withTraffic! - eta.withoutTraffic) : 0;
  
  return (
    <div className="time-estimate-banner" style={{ marginBottom: '24px' }}>
      <div className="time-estimate-item">
        <span className="time-estimate-icon">🚀</span>
        <div>
          <div className="time-estimate-label">Partida</div>
          <div className="time-estimate-value">{formatTimeHHMM(timeEstimate.departureTime)}</div>
        </div>
      </div>
      <div className="time-estimate-divider" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
        {hasTrafficData && Math.abs(trafficDiff) >= 1 ? (
          <>
            <div className="time-estimate-duration" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              {formatDuration(eta.withoutTraffic)} (sem trânsito)
            </div>
            <div className="time-estimate-duration" style={{ fontWeight: 'bold', color: trafficDiff > 10 ? 'var(--danger, #ff4d4f)' : trafficDiff > 0 ? 'var(--warning, #faad14)' : 'var(--text-primary)' }}>
              {formatDuration(eta.withTraffic!)} (com trânsito agora)
            </div>
            {trafficDiff > 0 && (
              <div style={{ fontSize: '0.8rem', color: trafficDiff > 10 ? 'var(--danger, #ff4d4f)' : 'var(--warning, #faad14)', fontWeight: 'bold' }}>
                +{trafficDiff} min por trânsito
              </div>
            )}
          </>
        ) : (
          <div className="time-estimate-duration">{formatDuration(durationMinutes)}</div>
        )}
        <div className="time-estimate-line" style={{ background: 'linear-gradient(90deg, transparent, var(--accent), transparent)', width: '100%', marginTop: '4px' }} />
      </div>
      <div className="time-estimate-item">
        <span className="time-estimate-icon">🏁</span>
        <div>
          <div className="time-estimate-label">Chegada estimada</div>
          <div className="time-estimate-value">
            {formatTimeHHMM(timeEstimate.arrivalTime)}
          </div>
        </div>
      </div>
      {timeEstimate.stopDelayMinutes > 0 && (
        <div className="time-estimate-stops">+{timeEstimate.stopDelayMinutes}min de paradas</div>
      )}
    </div>
  );
};
