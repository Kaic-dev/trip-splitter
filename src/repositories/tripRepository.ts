import { getDB } from './db';
import type { TripHistory } from '../types';

export const TripHistoryRepository = {
  async getAll(): Promise<TripHistory[]> {
    const db = await getDB();
    // Default descending sort: newer trips first
    let trips = await db.getAllFromIndex('tripHistory', 'by-date');
    return trips.reverse();
  },

  async getById(id: string): Promise<TripHistory | undefined> {
    const db = await getDB();
    return db.get('tripHistory', id);
  },

  async getBySignature(signature: string): Promise<TripHistory[]> {
    const db = await getDB();
    return db.getAllFromIndex('tripHistory', 'by-signature', signature);
  },

  async save(trip: TripHistory): Promise<void> {
    const db = await getDB();
    await db.put('tripHistory', {
      ...trip,
      date: trip.date || Date.now()
    });
  },

  async delete(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('tripHistory', id);
  }
};
