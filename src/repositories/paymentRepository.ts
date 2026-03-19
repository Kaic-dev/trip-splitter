import { getDB } from './db';
import type { PassengerPayment } from '../types';

export const PaymentRepository = {
  async getAll(): Promise<PassengerPayment[]> {
    const db = await getDB();
    return db.getAll('payments');
  },

  async getById(id: string): Promise<PassengerPayment | undefined> {
    const db = await getDB();
    return db.get('payments', id);
  },

  async getByTripId(tripHistoryId: string): Promise<PassengerPayment[]> {
    const db = await getDB();
    return db.getAllFromIndex('payments', 'by-trip', tripHistoryId);
  },

  async getUnpaidBalances(): Promise<PassengerPayment[]> {
    const db = await getDB();
    const all = await db.getAll('payments');
    return all.filter(p => p.paid === false);
  },

  async save(payment: PassengerPayment): Promise<void> {
    const db = await getDB();
    await db.put('payments', {
      ...payment,
      paid: payment.paid,
      // Workaround for IDB not indexing booleans naturally across all browsers
      paidStatusIndex: payment.paid ? 'true' : 'false'
    } as any); 
  },

  async saveBulk(payments: PassengerPayment[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('payments', 'readwrite');
    await Promise.all([
      ...payments.map(payment => tx.store.put({
        ...payment,
        paid: payment.paid,
        paidStatusIndex: payment.paid ? 'true' : 'false'
      } as any)),
      tx.done
    ]);
  },

  async delete(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('payments', id);
  },

  async deleteByTripId(tripHistoryId: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('payments', 'readwrite');
    const index = tx.store.index('by-trip');
    let cursor = await index.openCursor(IDBKeyRange.only(tripHistoryId));
    
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  }
};
