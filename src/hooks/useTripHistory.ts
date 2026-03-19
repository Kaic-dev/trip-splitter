import { useState, useCallback } from 'react';
import type { TripHistory } from '../types';
import { TripHistoryRepository } from '../repositories/tripRepository';
import { PaymentRepository } from '../repositories/paymentRepository';

export function useTripHistory() {
  const [trips, setTrips] = useState<TripHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTrips = useCallback(async () => {
    setLoading(true);
    try {
      const data = await TripHistoryRepository.getAll();
      setTrips(data);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError('Erro ao carregar histórico de viagens.');
    } finally {
      setLoading(false);
    }
  }, []);

  const saveTrip = async (trip: TripHistory) => {
    await TripHistoryRepository.save(trip);
    await loadTrips();
  };

  const deleteTripAndPayments = async (id: string) => {
    await TripHistoryRepository.delete(id);
    await PaymentRepository.deleteByTripId(id); // Cascade delete payments
    await loadTrips();
  };

  return { trips, loading, error, loadTrips, saveTrip, deleteTripAndPayments };
}
