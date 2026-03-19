import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { Client, PersistentVehicle, FuelStation, TripHistory, PassengerPayment } from '../types';

interface TripSplitDB extends DBSchema {
  clients: {
    key: string;
    value: Client;
    indexes: { 'by-name': string };
  };
  vehicles: {
    key: string;
    value: PersistentVehicle;
  };
  fuelStations: {
    key: string;
    value: FuelStation;
  };
  tripHistory: {
    key: string;
    value: TripHistory;
    indexes: { 'by-date': number, 'by-signature': string };
  };
  payments: {
    key: string;
    value: PassengerPayment;
    indexes: { 'by-trip': string, 'by-paid-status': string }; // boolean will be string 'true'/'false' for IDB indexing fallback
  };
}

const DB_NAME = 'TripSplitDB';
const DB_VERSION = 2; // Incremented for history migration

export async function getDB(): Promise<IDBPDatabase<TripSplitDB>> {
  return await openDB<TripSplitDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, _transaction) {
      if (oldVersion < 1) {
        const clientStore = db.createObjectStore('clients', { keyPath: 'id' });
        clientStore.createIndex('by-name', 'name');
        db.createObjectStore('vehicles', { keyPath: 'id' });
        db.createObjectStore('fuelStations', { keyPath: 'id' });
      }

      if (oldVersion < 2) {
        // Drop legacy v1 savedTrips table
        if (db.objectStoreNames.contains('savedTrips' as any)) {
          db.deleteObjectStore('savedTrips' as any);
        }

        const historyStore = db.createObjectStore('tripHistory', { keyPath: 'id' });
        historyStore.createIndex('by-date', 'date');
        historyStore.createIndex('by-signature', 'signature');

        const paymentStore = db.createObjectStore('payments', { keyPath: 'id' });
        paymentStore.createIndex('by-trip', 'tripHistoryId');
        paymentStore.createIndex('by-paid-status', 'paid');
      }
    },
  });
}
