import React from 'react';
import { Button } from '../ui/Button';

interface Passenger {
  id: string;
  name: string;
  amount: number;
  detourKm: number;
}

interface ListProps {
  passengers: Passenger[];
  onRemove: (id: string) => void;
  onAddClick: () => void;
  isAdding: boolean;
}

export const PassengerList: React.FC<ListProps> = ({ passengers, onRemove, onAddClick, isAdding }) => {
  return (
    <div className="passenger-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
          Paradas e Passageiros
        </h3>
        {!isAdding && (
          <Button variant="ghost" size="sm" onClick={onAddClick}>
            + Add Parada
          </Button>
        )}
      </div>

      {passengers.length === 0 && !isAdding && (
        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Nenhuma parada adicionada ainda.
        </div>
      )}

      {passengers.map((p, idx) => (
        <div key={p.id} className="card animate-slide-up" style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ 
              width: '24px', height: '24px', borderRadius: '50%', background: 'var(--primary)', 
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.75rem', fontWeight: 800
            }}>
              {idx + 1}
            </span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{p.name}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Impacto: <span style={{ color: 'var(--primary)', fontWeight: 600 }}>+{p.detourKm}km</span>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="currency" style={{ fontSize: '1rem', color: 'var(--text-main)' }}>
              <span className="currency-symbol">R$</span>
              <span className="currency-value">{p.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            <Button variant="ghost" size="sm" className="btn-icon" onClick={() => onRemove(p.id)} style={{ color: 'var(--danger)', fontSize: '1.2rem' }}>
              ×
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};
