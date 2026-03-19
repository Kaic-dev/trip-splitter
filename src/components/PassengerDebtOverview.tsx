import { useMemo, useState } from 'react';
import { useHistory } from '../providers/HistoryProvider';
import { formatCurrency } from '../utils/numberUtils';

interface PassengerDebt {
  id: string;
  name: string;
  amount: number;
  count: number;
}

const getInitials = (name: string) => {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const PassengerRow = ({ passenger, index, onClick }: { passenger: PassengerDebt, index: number, onClick: () => void }) => {
  const isTop = index === 0;
  return (
    <div 
      className="passenger-row"
      style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '12px', 
        background: isTop ? 'var(--bg-app)' : 'transparent', 
        borderRadius: '16px', 
        cursor: 'pointer', 
        border: isTop ? '1px solid var(--border)' : '1px solid transparent',
        transition: 'all 0.2s ease',
      }}
      onClick={onClick}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ 
          width: '42px', 
          height: '42px', 
          borderRadius: '50%', 
          background: isTop ? 'var(--primary)' : 'var(--border)', 
          color: isTop ? 'white' : 'var(--text-muted)',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: '1rem',
          boxShadow: isTop ? 'var(--shadow-sm)' : 'none'
        }}>
          {getInitials(passenger.name)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>{passenger.name}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{passenger.count} pendência{passenger.count !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <span style={{ fontWeight: 800, color: 'var(--danger)', fontSize: '1.05rem', letterSpacing: '-0.02em' }}>
        {formatCurrency(passenger.amount)}
      </span>
    </div>
  );
};

export default function PassengerDebtOverview({ onFilterPassenger }: { onFilterPassenger?: (p: { id?: string; name: string }) => void }) {
  const { unpaidBalances } = useHistory();
  const [isExpanded, setIsExpanded] = useState(false);

  const summary = useMemo(() => {
    if (unpaidBalances.length === 0) return null;
    
    const passengerTotals: Record<string, PassengerDebt> = {};
    let totalValue = 0;
    
    unpaidBalances.forEach(p => {
      totalValue += p.amount;
      const key = p.passengerName;
      if (!passengerTotals[key]) {
        passengerTotals[key] = { id: p.passengerId, name: p.passengerName, amount: 0, count: 0 };
      }
      passengerTotals[key].amount += p.amount;
      passengerTotals[key].count += 1;
    });

    const entries = Object.values(passengerTotals).sort((a, b) => b.amount - a.amount);

    return { total: totalValue, entries, passengerCount: entries.length };
  }, [unpaidBalances]);

  if (!summary) return null;

  const topDebt = summary.entries.slice(0, 3);
  const remainingDebt = summary.entries.slice(3);
  const hasMore = remainingDebt.length > 0;

  return (
    <div className="debt-overview animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
      
      {/* 1. Summary Card */}
      <div style={{
        background: 'var(--surface-raised)',
        borderRadius: '24px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        border: '1px solid var(--danger-light, #fed7d7)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.2rem' }}>⚠️</span>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            A receber
          </span>
        </div>
        
        <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--danger)', letterSpacing: '-0.03em', lineHeight: 1 }}>
          {formatCurrency(summary.total)}
        </div>
        
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500, marginTop: '4px' }}>
          De {summary.passengerCount} passageiro{summary.passengerCount !== 1 ? 's' : ''} com pendências
        </div>
      </div>

      {/* 2. Top Debtors List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {topDebt.map((p, index) => (
          <PassengerRow 
            key={p.name} 
            passenger={p} 
            index={index} 
            onClick={() => onFilterPassenger?.({ name: p.name })} 
          />
        ))}

        {/* 3. Collapsible Full List */}
        {hasMore && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden', transition: 'all 0.3s ease-in-out' }}>
            {isExpanded && remainingDebt.map((p, index) => (
              <div key={p.name} className="animate-fade-in">
                <PassengerRow 
                  passenger={p} 
                  index={index + 3} 
                  onClick={() => onFilterPassenger?.({ name: p.name })} 
                />
              </div>
            ))}
            
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--primary)',
                fontWeight: 600,
                fontSize: '0.9rem',
                padding: '12px',
                marginTop: '4px',
                cursor: 'pointer',
                textAlign: 'center',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              {isExpanded ? 'Ocultar passageiros' : `Ver todos (${remainingDebt.length})`}
              <span style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', fontSize: '0.7rem' }}>▼</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
