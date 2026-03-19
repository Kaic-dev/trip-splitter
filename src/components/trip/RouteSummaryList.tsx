import React from 'react';
import type { TripHistory } from '../../types';

interface Props {
  trip: TripHistory;
  stopEtas?: Date[];
  formatTimeHHMM: (d: Date) => string;
}

export const RouteSummaryList: React.FC<Props> = ({ trip, stopEtas, formatTimeHHMM }) => {
  return (
    <section className="detail-card">
      <h2>🗺️ Rota</h2>
      <div className="route-summary-list">
        <div className="route-stop route-stop--origin">
          <span className="route-dot route-dot--origin" />
          <div>
            <div className="route-stop__label">Origem</div>
            <div className="route-stop__name">{trip.origin.label}</div>
          </div>
        </div>
        {trip.stops.map((stop, i) => {
          const eta = stopEtas?.[i];
          return (
            <div key={stop.id} className="route-stop route-stop--passenger">
              <span className="route-dot" />
              <div className="route-stop__content">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="route-stop__label">Parada {i + 1}</div>
                    {eta && <div className="route-stop__eta">🕐 {formatTimeHHMM(eta)}</div>}
                </div>
                <div className="route-stop__name">{stop.name} — {stop.location.label}</div>
              </div>
            </div>
          );
        })}
        <div className="route-stop route-stop--destination">
          <span className="route-dot route-dot--destination" />
          <div>
            <div className="route-stop__label">Destino</div>
            <div className="route-stop__name">{trip.destination.label}</div>
          </div>
        </div>
      </div>
    </section>
  );
};
