import React from 'react';

interface ImpactData {
  passengerName: string;
  amount: number;
  costShare: number;
  distanceShare: number;
  detourKm: number;
  efficiencyScore: number;
  impactLabel: string;
  impactExplanation: string;
  color: string;
}

interface Props {
  impact: ImpactData;
  isPaid: boolean;
  onToggle: () => void;
  onPdf: () => void;
  pdfGenerated: boolean;
}

export const PassengerImpactCard: React.FC<Props> = ({ 
  impact, 
  isPaid, 
  onToggle, 
  onPdf, 
  pdfGenerated 
}) => {
  return (
    <div className="impact-card animate-slide-up" style={{
      background: 'var(--surface-raised)',
      border: `1.5px solid ${isPaid ? 'var(--success-light, #c6f6d5)' : 'var(--border)'}`,
      borderRadius: '16px',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      boxShadow: 'var(--shadow-sm)'
    }}>
      {/* Header: Name and Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
            {impact.passengerName}
          </h4>
          <span style={{ 
            fontSize: '0.7rem', 
            fontWeight: 700, 
            color: impact.color, 
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            {impact.impactLabel} • +{impact.detourKm}km
          </span>
        </div>
        <div style={{ 
          width: '24px', 
          height: '24px', 
          borderRadius: '50%', 
          background: isPaid ? 'var(--success)' : 'var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.8rem'
        }}>
          {isPaid ? '✅' : '⏳'}
        </div>
      </div>

      {/* Visual Bar: Cost vs Distance Share */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          <span>Participação no Custo</span>
          <span>{impact.costShare}%</span>
        </div>
        <div style={{ 
          height: '8px', 
          background: 'var(--bg-app)', 
          borderRadius: '4px', 
          overflow: 'hidden',
          display: 'flex'
        }}>
          <div style={{ 
            width: `${impact.costShare}%`, 
            height: '100%', 
            background: impact.efficiencyScore > 1.05 ? 'var(--danger)' : 'var(--primary)',
            transition: 'width 0.5s ease-out'
          }} />
        </div>
        <p style={{ 
          fontSize: '0.7rem', 
          color: 'var(--text-muted)', 
          marginTop: '4px', 
          lineHeight: '1.4',
          margin: 0
        }}>
          {impact.impactExplanation}
        </p>
      </div>

      {/* Footer: Price and Actions */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginTop: '4px',
        paddingTop: '12px',
        borderTop: '1px solid var(--border)'
      }}>
        <div className="currency" style={{ fontSize: '1.1rem' }}>
          <span className="currency-symbol">R$</span>
          <span className="currency-value">{impact.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className="btn btn--secondary btn--sm" 
            style={{ padding: '6px 10px', fontSize: '0.75rem' }}
            onClick={onPdf}
          >
            {pdfGenerated ? '📄 ✓' : '📄 PDF'}
          </button>
          <button 
            className={`btn btn--sm ${isPaid ? 'btn--outline' : 'btn--primary'}`}
            style={{ padding: '6px 12px', fontSize: '0.75rem' }}
            onClick={onToggle}
          >
            {isPaid ? 'Estornar' : 'Baixar'}
          </button>
        </div>
      </div>
    </div>
  );
};
