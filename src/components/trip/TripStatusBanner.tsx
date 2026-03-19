import React from 'react';
import type { TripHistory } from '../../types';

interface Props {
  trip: TripHistory;
  meta: {
    label: string;
    color: string;
    bg: string;
    icon: string;
  };
  onBack: () => void;
}

const formatDate = (ts: number) => {
  return new Date(ts).toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' });
};

export const TripStatusBanner: React.FC<Props> = ({ trip, meta, onBack }) => {
  return (
    <div className="detail-header">
      <button className="btn btn--ghost btn--sm" onClick={onBack}>
        ← Voltar ao Histórico
      </button>
      <div className="detail-header__info">
        <div className="detail-badge-row">
          <span className="detail-short-id">{trip.shortId}</span>
          <span
            className="trip-type-badge"
            style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}44` }}
          >
            {meta.icon} {meta.label}
          </span>
        </div>
        <h1 className="detail-title">{trip.tripName}</h1>
        <p className="detail-date">{formatDate(trip.date)}</p>
      </div>
    </div>
  );
};
