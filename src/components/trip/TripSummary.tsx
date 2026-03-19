import React from 'react';
import { Badge } from '../ui/Badge';
import type { ETAComparison } from '../../types';

interface SummaryProps {
  origin: string;
  destination: string;
  totalCost: number;
  distance: number;
  duration: string;
  passengerCount: number;
  eta?: ETAComparison;
}

export const TripSummary: React.FC<SummaryProps> = ({ 
  origin, 
  destination, 
  totalCost, 
  distance, 
  duration, 
  passengerCount,
  eta
}) => {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '60px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="currency" style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>
            <span className="currency-symbol">R$</span>
            <span className="currency-value">{totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          <Badge variant="info">{passengerCount} {passengerCount === 1 ? 'pessoa' : 'pessoas'}</Badge>
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
          <span>{distance} km</span>
          {eta?.withTraffic !== undefined && Math.abs(eta.withTraffic - eta.withoutTraffic) >= 1 ? (
            <>
              <span>• {eta.withoutTraffic} min <span style={{fontSize: '0.65rem'}}>(sem trânsito)</span></span>
              <span>vs</span>
              <strong style={{ color: (eta.withTraffic - eta.withoutTraffic) > 10 ? 'var(--danger, #ff4d4f)' : 'var(--warning, #faad14)' }}>
                {eta.withTraffic} min <span style={{fontSize: '0.65rem', fontWeight: 'normal'}}>(agora)</span>
              </strong>
              {eta.withTraffic > eta.withoutTraffic && (
                <span style={{ color: (eta.withTraffic - eta.withoutTraffic) > 10 ? 'var(--danger, #ff4d4f)' : 'var(--warning, #faad14)', fontWeight: 'bold' }}>
                  (+{eta.withTraffic - eta.withoutTraffic} min trânsito)
                </span>
              )}
            </>
          ) : (
            <span>• {duration}</span>
          )}
        </span>
      </div>
      
      <div style={{ textAlign: 'right', maxWidth: '200px' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {destination || 'Destino'}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          {origin || 'Origem'}
        </div>
      </div>
    </div>
  );
};
