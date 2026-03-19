import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHistory } from '../providers/HistoryProvider';
import PassengerDebtOverview from '../components/PassengerDebtOverview';
import TripHistoryCard from '../components/TripHistoryCard';
import { formatCurrency } from '../utils/numberUtils';
import type { TripHistory } from '../types';
import './TripHistoryDashboard.css';

type FilterTab = 'all' | 'real' | 'sim' | 'pending';

export default function TripHistoryDashboard() {
  const navigate = useNavigate();
  const { trips, deleteTrip, unpaidBalances, togglePayment } = useHistory();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [passengerFilter, setPassengerFilter] = useState<{ id?: string; name: string } | null>(null);

  const pendingTripIds = useMemo(() => {
    return new Set(unpaidBalances.map(p => p.tripHistoryId));
  }, [unpaidBalances]);

  const filteredTrips = useMemo((): TripHistory[] => {
    let base = [...trips].sort((a, b) => b.date - a.date);
    
    switch (activeFilter) {
      case 'real': base = base.filter(t => t.tripType === 'REAL_TRIP'); break;
      case 'sim':  base = base.filter(t => t.tripType === 'SIMULATION'); break;
      case 'pending': base = base.filter(t => pendingTripIds.has(t.id)); break;
    }

    if (passengerFilter) {
      return base.filter(t => 
        t.stops.some(p => {
          if (passengerFilter.id && p.id) return p.id === passengerFilter.id;
          return p.name.toLocaleLowerCase().includes(passengerFilter.name.toLocaleLowerCase());
        })
      );
    }
    return base;
  }, [trips, activeFilter, pendingTripIds, passengerFilter]);

  const groupedTrips = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const groups: { title: string; trips: TripHistory[] }[] = [
      { title: 'HOJE', trips: [] },
      { title: 'ONTEM', trips: [] },
      { title: 'MAIS ANTIGAS', trips: [] }
    ];

    filteredTrips.forEach(trip => {
      const tripDate = new Date(trip.date);
      tripDate.setHours(0, 0, 0, 0);

      if (tripDate.getTime() === today.getTime()) groups[0].trips.push(trip);
      else if (tripDate.getTime() === yesterday.getTime()) groups[1].trips.push(trip);
      else groups[2].trips.push(trip);
    });

    return groups.filter(g => g.trips.length > 0);
  }, [filteredTrips]);

  const tabs: { id: FilterTab; label: string; icon: string }[] = [
    { id: 'all', label: 'Todas', icon: '🗂️' },
    { id: 'real', label: 'Reais', icon: '🚗' },
    { id: 'sim', label: 'Simulações', icon: '🧮' },
    { id: 'pending', label: 'Pendentes', icon: '⚠️' },
  ];

  const totalOwed = useMemo(() => {
    return unpaidBalances.reduce((sum, p) => sum + p.amount, 0);
  }, [unpaidBalances]);

  // Group pending trips to show them like regular cards but with pending metadata
  const pendingSection = useMemo(() => {
    if (unpaidBalances.length === 0) return null;

    return (
      <div className="history-section" style={{ marginTop: '8px', borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <h4 className="section-title">⚠️ Pendências ({unpaidBalances.length})</h4>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--danger)', background: 'var(--bg-app)', padding: '2px 8px', borderRadius: '12px' }}>
            Total: {formatCurrency(totalOwed)}
          </span>
        </div>
        <div className="history-section">
          {unpaidBalances.map(payment => {
            const trip = trips.find(t => t.id === payment.tripHistoryId);
            if (!trip) return null;

            const pendingTripInfo = { ...trip, totalCost: payment.amount };

            return (
              <TripHistoryCard
                key={payment.id}
                trip={pendingTripInfo}
                similarCount={1}
                onDelete={() => {}}
                isPending={true}
                passengerName={payment.passengerName}
                onAction={() => togglePayment(payment.id)}
                actionLabel="Dar baixa"
              />
            );
          })}
        </div>
      </div>
    );
  }, [unpaidBalances, trips, togglePayment, totalOwed]);

  return (
    <div className="history-page">
      <header className="history-header">
        <div>
          <h1 className="history-title">💳 Histórico</h1>
          <p className="history-subtitle">
            {passengerFilter ? (
              <span className="search-active-pill">
                Filtrando: <strong>{passengerFilter.name}</strong>
                <button className="btn-clear-search" onClick={() => setPassengerFilter(null)}> ✕ </button>
              </span>
            ) : 'Consulte e gerencie suas viagens'}
          </p>
        </div>
        <button className="btn btn--primary" onClick={() => navigate('/criar')}>
          + Nova Viagem
        </button>
      </header>

      <main className="history-main-scroll">
        <div className="history-feed-container">
          <PassengerDebtOverview onFilterPassenger={(p) => {
            setPassengerFilter(p);
            setActiveFilter('pending');
          }} />

          <nav className="filter-tabs">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`filter-tab ${activeFilter === tab.id ? 'filter-tab--active' : ''}`}
                onClick={() => setActiveFilter(tab.id)}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          {filteredTrips.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem', opacity: 0.5 }}>📭</div>
              {activeFilter === 'all' ? 'Nenhuma viagem registrada ainda.' : 'Nenhuma viagem encontrada.'}
            </div>
          ) : (
            <div className="history-section" style={{ gap: '24px' }}>
              {groupedTrips.map(group => (
                <div key={group.title} className="history-section">
                  <h4 className="section-title">{group.title}</h4>
                  <div className="history-section">
                    {group.trips.map(trip => (
                      <TripHistoryCard
                        key={trip.id}
                        trip={trip}
                        similarCount={1}
                        onDelete={deleteTrip}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {pendingSection}
        </div>
      </main>
    </div>
  );
}
