// --- Domain Core ---

export type LocationType = 'poi' | 'address' | 'street' | 'city' | 'neighborhood' | 'locality' | 'place' | 'region' | 'country' | 'district' | 'transport' | 'unknown';

export interface LocationResult {
  id: string;
  name: string;
  fullAddress: string;
  coordinates: [number, number]; // [longitude, latitude]
  type: LocationType;
  distance?: number;
  score?: number;
  mapbox_id?: string;
  source: 'searchbox' | 'geocoding' | 'gps' | 'ip' | 'manual';
  relevance?: number;
  accuracy?: number; // in meters
}

export interface Address extends Partial<LocationResult> {
  label: string;
  coordinates: [number, number];
  flowId?: string;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  searchMetadata?: {
    competition?: boolean;
    scoreGap?: string;
    ambiguity?: boolean;
    alternativesClose?: number;
  };
}

export interface Passenger {
  id: string;
  name: string;
  location: Address;
}

export interface Vehicle {
  kmPerLiter: number;
  fuelPrice: number;
  driverProfitPercent?: number; // default 15
}

// --- Trip Scheduling ---
export type TripScheduleMode = 'departAt' | 'arriveBy';

export interface TripSchedule {
  mode: TripScheduleMode;
  time: Date;
}

export interface TripTimeEstimate {
  departureTime: Date;
  arrivalTime: Date;
  totalDurationMinutes: number;
  routeDurationMinutes: number;
  stopDelayMinutes: number;
}

export type TripExecutionMode = 'SHARED' | 'DEDICATED';

export interface Trip {
  origin: Address;
  destination: Address;
  passengers: Passenger[];
  kmPerLiter: number;
  fuelPrice: number;
  schedule?: TripSchedule;
  executionMode?: TripExecutionMode;
  vehicleCapacity?: number;
  driverProfit?: number; // legacy backward compatibility
}

export interface PassengerDetour {
  passengerId: string;
  passengerName: string;
  detourKm: number;
  marginalImpactKm?: number;
  paymentAmount: number;
  pureFuelCost?: number;
  baseFuelCost?: number;
  detourFuelCost?: number;
  marginAmount?: number;
  isDriver?: boolean;
}

// --- Route Comparison ---
export type RouteLabel = 'fastest' | 'shortest' | 'cheapest' | 'recommended';

export interface RouteOption {
  id: string;
  distanceKm: number;
  durationMinutes: number;
  durationInTrafficMinutes?: number;
  durationTypicalMinutes?: number;
  fuelCost: number; // This will hold the TOTAL (fuel + margin) for backward compatibility in some views
  pureFuelCost?: number;
  marginAmount?: number;
  geometry: any; // GeoJSON LineString
  label?: RouteLabel;
  isRecommended?: boolean;
  recommendationReason?: string;
}

export interface ETAComparison {
  withoutTraffic: number;
  withTraffic?: number;
}

export interface RouteResult {
  orderedPassengers: Passenger[];
  totalDistanceKm: number;
  baseDistanceKm: number;
  returnDistanceKm?: number;
  passengerDetours: PassengerDetour[];
  waypoints: [number, number][]; // ordered coordinates for map rendering
  geometry?: any; // Full route GeoJSON from the Provider
  baseGeometry?: any;
  totalCost: number;
  pureFuelCost?: number;
  marginAmount?: number;
  executionMode?: TripExecutionMode;
  durationMinutes?: number;   // Travel time for main route
  durationInTrafficMinutes?: number;
  durationTypicalMinutes?: number;
  timeEstimate?: TripTimeEstimate;
  eta?: ETAComparison;
  stopEtas?: Date[];          // Estimated arrival time at each passenger stop (index-aligned with orderedPassengers)
  routeOptions?: RouteOption[]; // Alternative routes for comparison
  selectedRouteId?: string;
  matrix?: DistanceMatrixResponse;
}

export interface TripCostBreakdown {
  billingDistanceKm: number;
  litersUsed: number;
  fuelCost: number;
  marginAmount: number;
  totalCost: number;
}

export interface CostSplitInput {
  baseDistanceKm: number;
  totalDistanceKm: number;
  returnDistanceKm?: number;
  passengerDetourKms: { passengerId: string; passengerName: string; detourKm: number; marginalImpactKm: number }[];
  kmPerLiter: number;
  fuelPrice: number;
  executionMode?: TripExecutionMode;
  matrix?: DistanceMatrixResponse;
}

// --- Provider Abstracts ---

export interface OptimalRouteResponse {
  orderedStopIds: string[];
  totalDistanceKm: number;
  orderedWaypoints: [number, number][];
  geometry: any;
}

export interface DrivingRouteResponse {
  distanceKm: number;
  durationMinutes: number;
  durationInTrafficMinutes?: number;
  durationTypicalMinutes?: number;
  legDurations: number[];
  geometry: any;
}

export interface DistanceMatrixResponse {
  durations: number[][]; // [originIndex][destinationIndex] in seconds (or minutes)
  distances: number[][]; // [originIndex][destinationIndex] in meters
  waypoints: { lat: number; lng: number }[];
}

export interface MapMatchedResponse {
  coordinates?: [number, number][];
  distanceKm?: number;
  durationMinutes?: number;
  geometry?: any;
  confidence: number;
}

// --- Management Data Structures ---

export interface Client {
  id: string;
  name: string;
  address: Address;
  branch?: string;
  notes?: string;
}

export interface PersistentVehicle {
  id: string;
  name: string;
  brand?: string;
  model?: string;
  year?: number;
  fuelEfficiencyKmPerLiter: number;
  fuelType?: string;
  tankCapacity?: number;
  capacity?: number; // Pax capacity
  notes?: string;
}

export interface FuelStation {
  id: string;
  name: string;
  location: Address;
  fuelPrice: number;
  fuelType: string;
  lastUpdated: number; // timestamp
}

export type TripType = 'SIMULATION' | 'REAL_TRIP';

export interface TripHistory {
  id: string;
  shortId: string;
  tripName: string;
  tripType: TripType;
  origin: Address;
  destination: Address;
  stops: Passenger[];
  vehicleId?: string;
  date: number; // timestamp
  totalDistance: number;
  totalCost: number;
  signature: string;
  kmPerLiter: number;
  fuelPrice: number;

  // Full state replication for PDF regeneration
  routeResult: RouteResult;
  activeRoute: RouteOption;
}

export interface PassengerPayment {
  id: string;
  tripHistoryId: string;
  passengerId: string;
  passengerName: string;
  amount: number;
  paid: boolean;
  paidAt?: number;
  paymentMethod?: string;
  pdfGeneratedAt?: number;
}
