export interface Vehicle {
  id: string;
  vehicleId: string;
  label?: string;
  licensePlate?: string;
  tripId?: string;
  routeId?: string;
  directionId?: number;
  latitude?: number;
  longitude?: number;
  bearing?: number;
  speed?: number;
  currentStopSequence?: number;
  stopId?: string;
  currentStatus?: string;
  timestamp?: number;
}

export interface StopTimeUpdate {
  stopSequence?: number;
  stopId?: string;
  arrivalDelay?: number;
  arrivalTime?: number;
  departureDelay?: number;
  departureTime?: number;
  scheduleRelationship?: string;
}

export interface Trip {
  id: string;
  tripId?: string;
  routeId?: string;
  directionId?: number;
  startTime?: string;
  startDate?: string;
  scheduleRelationship?: string;
  vehicleId?: string;
  vehicleLabel?: string;
  stopTimeUpdates: StopTimeUpdate[];
  timestamp?: number;
}

export interface ActivePeriod {
  start?: number;
  end?: number;
}

export interface InformedEntity {
  agencyId?: string;
  routeId?: string;
  routeType?: number;
  tripId?: string;
  stopId?: string;
}

export interface Alert {
  id: string;
  activePeriods: ActivePeriod[];
  informedEntities: InformedEntity[];
  cause?: string;
  effect?: string;
  headerText?: string;
  descriptionText?: string;
  url?: string;
  severityLevel?: string;
}

export interface GtfsResponse<T> {
  data: T;
  timestamp: number;
  feedTimestamp?: number;
}

export interface StopInfo {
  stopId: string;
  stopName?: string;
  latitude?: number;
  longitude?: number;
  delays: {
    tripId?: string;
    routeId?: string;
    arrivalDelay?: number;
    departureDelay?: number;
  }[];
}