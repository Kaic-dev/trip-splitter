import { useState, useCallback, useEffect } from 'react';
import type { PassengerPayment } from '../types';
import { PaymentRepository } from '../repositories/paymentRepository';
import { useHistory } from '../providers/HistoryProvider';

export function usePayments() {
  const { lastUpdate, refreshAll } = useHistory();
  const [unpaidBalances, setUnpaidBalances] = useState<PassengerPayment[]>([]);
  const [tripPayments, setTripPayments] = useState<PassengerPayment[]>([]);
  
  const [loading, setLoading] = useState(false);

  const loadUnpaidBalances = useCallback(async () => {
    setLoading(true);
    try {
      const data = await PaymentRepository.getUnpaidBalances();
      setUnpaidBalances(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPaymentsForTrip = useCallback(async (tripId: string) => {
    if (!tripId) return;
    setLoading(true);
    try {
      console.log(`[usePayments] Fetching payments for trip: ${tripId}`);
      const data = await PaymentRepository.getByTripId(tripId);
      setTripPayments(data);
    } catch (err) {
      console.error(`[usePayments] Error loading payments for trip ${tripId}:`, err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUnpaidBalances();
  }, [loadUnpaidBalances, lastUpdate]);

  const togglePaymentStatus = async (paymentId: string) => {
    const payment = await PaymentRepository.getById(paymentId);
    if (!payment) return;

    payment.paid = !payment.paid;
    if (payment.paid) {
      payment.paidAt = Date.now();
    } else {
      payment.paidAt = undefined;
    }

    await PaymentRepository.save(payment);
    await refreshAll();
  };

  const saveBulkPayments = async (payments: PassengerPayment[]) => {
    await PaymentRepository.saveBulk(payments);
    await refreshAll();
  };
  
  const registerPdfGeneration = async (paymentId: string) => {
    const payment = await PaymentRepository.getById(paymentId);
    if (!payment) return;
    payment.pdfGeneratedAt = Date.now();
    await PaymentRepository.save(payment);
    await refreshAll();
  };

  return { 
    unpaidBalances, 
    tripPayments, 
    loading, 
    loadUnpaidBalances, 
    loadPaymentsForTrip, 
    togglePaymentStatus,
    saveBulkPayments,
    registerPdfGeneration
  };
}
