import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { TripHistory, PassengerPayment } from '../types';
import { TripHistoryRepository } from '../repositories/tripRepository';
import { PaymentRepository } from '../repositories/paymentRepository';

interface HistoryContextType {
  trips: TripHistory[];
  unpaidBalances: PassengerPayment[];
  loading: boolean;
  lastUpdate: number;
  refreshAll: () => Promise<void>;
  deleteTrip: (id: string) => Promise<void>;
  togglePayment: (paymentId: string) => Promise<void>;
}

const HistoryContext = createContext<HistoryContextType | undefined>(undefined);

export function HistoryProvider({ children }: { children: React.ReactNode }) {
  const [trips, setTrips] = useState<TripHistory[]>([]);
  const [unpaidBalances, setUnpaidBalances] = useState<PassengerPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      console.log("[HistoryProvider] Fetching data...");
      const [allTrips, allUnpaid] = await Promise.all([
        TripHistoryRepository.getAll(),
        PaymentRepository.getUnpaidBalances()
      ]);
      console.log(`[HistoryProvider] Done fetching. Trips: ${allTrips.length}, Unpaid: ${allUnpaid.length}`);
      setTrips(allTrips);
      setUnpaidBalances(allUnpaid);
      setLastUpdate(Date.now());
    } catch (err) {
      console.error('Failed to refresh history state:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const deleteTrip = async (id: string) => {
    await TripHistoryRepository.delete(id);
    await PaymentRepository.deleteByTripId(id);
    await refreshAll();
  };

  const togglePayment = async (paymentId: string) => {
    const payment = await PaymentRepository.getById(paymentId);
    if (!payment) return;

    payment.paid = !payment.paid;
    payment.paidAt = payment.paid ? Date.now() : undefined;

    await PaymentRepository.save(payment);
    await refreshAll();
  };

  const contextValue = React.useMemo(() => ({
    trips, 
    unpaidBalances, 
    loading, 
    lastUpdate,
    refreshAll, 
    deleteTrip, 
    togglePayment 
  }), [trips, unpaidBalances, loading, lastUpdate, refreshAll]);

  return (
    <HistoryContext.Provider value={contextValue}>
      {children}
    </HistoryContext.Provider>
  );
}

export function useHistory() {
  const context = useContext(HistoryContext);
  if (!context) {
    throw new Error('useHistory must be used within a HistoryProvider');
  }
  return context;
}
