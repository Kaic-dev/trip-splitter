import React from 'react';
import { formatCurrency } from '../../utils/numberUtils';
import type { TripHistory, PassengerPayment } from '../../types';

interface Props {
  trip: TripHistory;
  tripPayments: PassengerPayment[];
  loading: boolean;
  paidCount: number;
}

export const TripStatsBand: React.FC<Props> = ({ trip, tripPayments, loading, paidCount }) => {
  return (
    <div className="detail-stats-band">
      <div className="detail-stat">
        <span className="detail-stat__icon">📍</span>
        <span className="detail-stat__value">{trip.totalDistance} km</span>
        <span className="detail-stat__label">Distância</span>
      </div>
      <div className="detail-stat">
        <span className="detail-stat__icon">💰</span>
        <span className="detail-stat__value">{formatCurrency(trip.totalCost)}</span>
        <span className="detail-stat__label">Custo Total</span>
      </div>
      <div className="detail-stat">
        <span className="detail-stat__icon">👥</span>
        <span className="detail-stat__value">{trip.stops.length}</span>
        <span className="detail-stat__label">Passageiros</span>
      </div>
      {trip.tripType === 'REAL_TRIP' && (
        <div className="detail-stat">
          <span className="detail-stat__icon">✅</span>
          <span className="detail-stat__value">
            {loading ? '...' : `${paidCount}/${tripPayments.length}`}
          </span>
          <span className="detail-stat__label">Pagamentos</span>
        </div>
      )}
    </div>
  );
};
