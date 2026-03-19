import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { TripHistory, PassengerPayment } from '../types';
import { TripHistoryRepository } from '../repositories/tripRepository';
import { usePayments } from '../hooks/usePayments';
import { useHistory } from '../providers/HistoryProvider';
import { pdfService } from '../services/pdfService';
import { formatCurrency } from '../utils/numberUtils';
import { TripStatusBanner } from '../components/trip/TripStatusBanner';
import { TripStatsBand } from '../components/trip/TripStatsBand';
import { PaymentDetailList } from '../components/trip/PaymentDetailList';
import { RouteSummaryList } from '../components/trip/RouteSummaryList';
import { TimeEstimateBanner } from '../components/trip/TimeEstimateBanner';
import { CostEngine } from '../core/costEngine';
import './TripDetailPage.css';

const TYPE_META = {
  REAL_TRIP:  { label: 'Viagem Real', color: '#48bb78', bg: '#f0fff4',  icon: '🚗' },
  SIMULATION: { label: 'Simulação',   color: '#a0aec0', bg: '#f7fafc',  icon: '🧮' },
};

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<TripHistory | null>(null);
  const [similar, setSimilar] = useState<TripHistory[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);

  const { loading, tripPayments, loadPaymentsForTrip, togglePaymentStatus, registerPdfGeneration } = usePayments();
  const { trips } = useHistory();

  useEffect(() => {
    if (!id) return;
    TripHistoryRepository.getById(id).then(found => {
      if (!found) { navigate('/historico'); return; }
      setTrip(found);
    });
  }, [id, navigate]);

  useEffect(() => {
    if (trip?.tripType === 'REAL_TRIP') {
      loadPaymentsForTrip(trip.id);
    }
  }, [trip?.id, trip?.tripType, loadPaymentsForTrip]);

  useEffect(() => {
    if (!trip) return;
    const sims = trips.filter(t => t.signature === trip.signature && t.id !== trip.id);
    setSimilar(sims);
  }, [trips, trip]);

  const { timeEstimate, stopEtas } = useMemo(() => {
    const rr = trip?.routeResult;
    if (!rr || !rr.timeEstimate) return { timeEstimate: undefined, stopEtas: undefined };
    
    try {
      return {
        timeEstimate: {
          ...rr.timeEstimate,
          departureTime: new Date(rr.timeEstimate.departureTime),
          arrivalTime: new Date(rr.timeEstimate.arrivalTime)
        },
        stopEtas: rr.stopEtas?.map(d => new Date(d))
      };
    } catch (err) {
      console.error("[TripDetailPage] Error hydrating dates:", err);
      return { timeEstimate: undefined, stopEtas: undefined };
    }
  }, [trip?.routeResult]);

  const passengerImpacts = useMemo(() => {
    if (!trip || tripPayments.length === 0) return [];
    return CostEngine.calculatePassengerImpact(trip, tripPayments);
  }, [trip, tripPayments]);

  useEffect(() => {
    if (trip && new URLSearchParams(window.location.search).get('focus') === 'payments') {
      const el = document.getElementById('payments-section');
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 500);
    }
  }, [trip]);

  if (!trip) return <div className="detail-loading">Carregando...</div>;

  const meta = TYPE_META[trip.tripType] || TYPE_META.SIMULATION;
  const paidCount = tripPayments.filter(p => p.paid).length;

  const handleFullPdf = async () => {
    setPdfLoading(true);
    try {
      await pdfService.generateTripPDF({
        trip: { ...trip, id: trip.id, passengers: trip.stops } as any,
        routeResult: trip.routeResult,
        activeRoute: trip.activeRoute as any
      });
    } catch (err) { console.error(err); }
    finally { setPdfLoading(false); }
  };

  const handlePassengerPdf = async (payment: PassengerPayment) => {
    if (!trip?.routeResult) return;
    const detour = trip.routeResult.passengerDetours.find(d => d.passengerId === payment.passengerId);
    if (!detour) return;
    const idx = trip.routeResult.orderedPassengers.findIndex(p => p.id === payment.passengerId);
    const eta = trip.routeResult.stopEtas?.[idx];
    
    try {
      pdfService.generatePassengerPDF(
        { trip: { ...trip, passengers: trip.stops } as any, routeResult: trip.routeResult, activeRoute: trip.activeRoute as any },
        detour, eta
      );
      await registerPdfGeneration(payment.id);
      loadPaymentsForTrip(trip.id);
    } catch (err) { console.error("[TripDetailPage] PDF generation failed:", err); }
  };

  const formatTimeHHMM = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${m}min`;
  };

  return (
    <div className="trip-detail-page page-container">
      <TripStatusBanner trip={trip} meta={meta} onBack={() => navigate('/historico')} />

      <main className="page-content">
        {timeEstimate && (
          <div style={{ padding: '0 20px' }}>
            <TimeEstimateBanner 
              timeEstimate={timeEstimate} 
              durationMinutes={trip.activeRoute?.durationMinutes || 0}
              eta={trip.routeResult?.eta}
              formatTimeHHMM={formatTimeHHMM}
              formatDuration={formatDuration}
            />
          </div>
        )}

        <div style={{ padding: '12px 20px' }}>
          <TripStatsBand trip={trip} tripPayments={tripPayments} loading={loading} paidCount={paidCount} />
        </div>

        <div className="detail-columns" style={{ padding: '0 20px 40px 20px' }}>
          {trip.tripType === 'REAL_TRIP' && (
            <PaymentDetailList 
              tripPayments={passengerImpacts}
              loading={loading}
              pdfLoading={pdfLoading}
              onFullPdf={handleFullPdf}
              onPassengerPdf={handlePassengerPdf}
              onTogglePayment={(pid) => togglePaymentStatus(pid).then(() => loadPaymentsForTrip(trip.id))}
            />
          )}

          <RouteSummaryList trip={trip} stopEtas={stopEtas} formatTimeHHMM={formatTimeHHMM} />

          {similar.length > 0 && (
            <section className="detail-card">
              <h2>↩ Rotas Semelhantes</h2>
              <ul className="similar-list">
                {similar.map(s => (
                  <li key={s.id} className="similar-item" onClick={() => navigate(`/historico/${s.id}`)}>
                    <span>{new Date(s.date).toLocaleDateString('pt-BR')}</span>
                    <span className="similar-cost">{formatCurrency(s.totalCost)}</span>
                    <span className="similar-arrow">›</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
