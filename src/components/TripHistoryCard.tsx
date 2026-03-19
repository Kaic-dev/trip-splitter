import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHistory } from '../providers/HistoryProvider';
import type { TripHistory } from '../types';
import { usePayments } from '../hooks/usePayments';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';

interface Props {
  trip: TripHistory;
  similarCount: number;
  onDelete: (id: string) => void;
  isPending?: boolean;
  passengerName?: string;
  onAction?: () => void;
  actionLabel?: string;
}

export default function TripHistoryCard({ trip, onDelete, isPending, passengerName, onAction, actionLabel }: Props) {
  const navigate = useNavigate();
  const { loadPaymentsForTrip } = usePayments();
  const { lastUpdate } = useHistory();

  useEffect(() => {
    if (trip.tripType === 'REAL_TRIP' && !isPending) {
      loadPaymentsForTrip(trip.id);
    }
  }, [trip.id, trip.tripType, loadPaymentsForTrip, lastUpdate, isPending]);

  const duration = trip.routeResult?.durationMinutes 
    ? `${Math.round(trip.routeResult.durationMinutes)} min` 
    : '-- min';

  // For pending mode, we might want to show the specific payment amount passed via the trip total cost if the caller overrides it, 
  // or just use the trip total cost if it's a 1-to-1 mapping (but here it's 1 trip to N payments).
  // Actually, let's keep it simple: the caller should pass the correct 'trip' object or we should handle it.
  // The user wants 'preço (destaque)'.

  return (
    <Card 
      onClick={() => navigate(`/historico/${trip.id}${isPending ? '?focus=payments' : ''}`)}
      style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}
      className="animate-slide-up animate-scale"
    >
      {/* Top: Destination & Badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            🏁 {trip.destination.name || trip.destination.label.split(',')[0]}
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {new Date(trip.date).toLocaleDateString('pt-BR')} • {trip.totalDistance.toFixed(1)} km
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {isPending ? (
            <Badge variant="danger">⚠️ Pendente</Badge>
          ) : (
            <Badge variant={trip.tripType === 'REAL_TRIP' ? 'info' : 'neutral'}>
              {trip.tripType === 'REAL_TRIP' ? '🚗 Real' : '🧮 Sim.'}
            </Badge>
          )}
        </div>
      </div>

      {/* Middle: Details */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          ⏱️ {duration}
        </span>
        {!isPending && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            👥 {trip.stops.length} {trip.stops.length === 1 ? 'passageiro' : 'passageiros'}
          </span>
        )}
        {isPending && passengerName && (
          <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>
            👤 {passengerName}
          </span>
        )}
      </div>

      {/* Bottom: Price and Main Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
        <div className="currency" style={{ fontSize: '1.2rem', color: isPending ? 'var(--danger)' : 'var(--primary)' }}>
          <span className="currency-symbol">R$</span>
          <span className="currency-value">{trip.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {isPending && onAction && (
            <button 
              className="btn btn--primary" 
              style={{ padding: '6px 14px', fontSize: '0.8rem', height: '32px' }}
              onClick={(e) => {
                e.stopPropagation();
                onAction();
              }}
            >
              {actionLabel || 'Dar baixa'}
            </button>
          )}
          
          {!isPending && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(trip.id);
              }}
              style={{ 
                background: 'var(--bg-app)', border: 'none', borderRadius: '50%', width: '32px', height: '32px',
                display: 'flex', alignItems: 'center', justifySelf: 'center', cursor: 'pointer',
                fontSize: '0.9rem', opacity: 0.6
              }}
              title="Excluir"
            >
              🗑️
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
