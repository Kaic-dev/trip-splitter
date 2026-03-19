import React from 'react';

interface BreakdownProps {
  fuelCost: number;
  margin: number;
  total: number;
  distance: number;
  consumption: number;
  marginPercent?: number;
}

export const CostBreakdown: React.FC<BreakdownProps> = ({ fuelCost, margin, total, distance, consumption, marginPercent }) => {
  return (
    <div className="cost-breakdown animate-fade-in" style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
      <h3 style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '1rem' }}>
        Resumo de Custos
      </h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
          <span>Combustível</span>
          <div className="currency" style={{ fontWeight: 600 }}>
            <span className="currency-symbol">R$</span>
            <span className="currency-value">{fuelCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
          <span>Margem Automática{marginPercent !== undefined ? ` (${marginPercent}%)` : ''}</span>
          <div className="currency" style={{ fontWeight: 600 }}>
            <span className="currency-symbol">R$</span>
            <span className="currency-value">{margin.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 800, paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
          <span>Custo Total</span>
          <div className="currency" style={{ color: 'var(--primary)' }}>
            <span className="currency-symbol">R$</span>
            <span className="currency-value">{total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>
      
      <div className="card" style={{ marginTop: '1.5rem', background: 'var(--bg-app)', border: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Distância</div>
            <div style={{ fontSize: '1rem', fontWeight: 800 }}>{distance}km</div>
          </div>
          <div style={{ width: '1px', background: 'var(--border)' }} />
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Consumo</div>
            <div style={{ fontSize: '1rem', fontWeight: 800 }}>{consumption}km/L</div>
          </div>
        </div>
      </div>
    </div>
  );
};
