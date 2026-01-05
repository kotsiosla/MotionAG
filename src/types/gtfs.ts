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

export interface RouteInfo {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  route_type?: number;
  route_color?: string;
  route_text_color?: string;
}

export interface StaticStop {
  stop_id: string;
  stop_name: string;
  stop_lat?: number;
  stop_lon?: number;
  stop_code?: string;
  location_type?: number;
  parent_station?: string;
}

export interface OperatorInfo {
  id: string;
  name: string;
  city?: string;
  isIntercity?: boolean;
  region?: string; // For matching stops to operators
}

export const OPERATORS: OperatorInfo[] = [
  { id: 'all', name: 'Όλοι οι φορείς' },
  { id: '2', name: 'OSYPA', city: 'Πάφος', region: 'paphos' },
  { id: '4', name: 'OSEA', city: 'Αμμόχωστος', region: 'famagusta' },
  { id: '5', name: 'Υπεραστικά', isIntercity: true },
  { id: '6', name: 'EMEL', city: 'Λεμεσός', region: 'limassol' },
  { id: '9', name: 'NPT', city: 'Λευκωσία', region: 'nicosia' },
  { id: '10', name: 'LPT', city: 'Λάρνακα', region: 'larnaca' },
  { id: '11', name: 'PAME EXPRESS', isIntercity: true },
];

// Keywords to detect city/region from stop names
export const REGION_KEYWORDS: Record<string, string[]> = {
  nicosia: ['λευκωσία', 'λευκωσι', 'nicosia', 'lefkosia', 'αγλαντζ', 'στροβόλο', 'λατσ', 'έγκωμ', 'λακατάμ', 'ακρόπολ', 'κυπέρουντα', 'μακάριο', 'πλατεία ελευθερίας'],
  limassol: ['λεμεσό', 'λεμεσ', 'limassol', 'lemesos', 'ολντ πόρτ', 'γερμασόγεια', 'αγ. τύχωνα', 'ύψονα', 'επισκοπή', 'κολόσσι', 'πολεμίδια', 'μέσα γειτονιά'],
  larnaca: ['λάρνακ', 'λαρνακ', 'larnaca', 'larnaka', 'αραδίππου', 'λειβάδια', 'κίτι', 'περβόλια', 'δρομολαξιά', 'μενέου'],
  paphos: ['πάφο', 'παφο', 'paphos', 'pafos', 'γεροσκήπου', 'κάτω πάφος', 'πέγεια', 'κισσόνεργα', 'χλώρακα', 'τάλα'],
  famagusta: ['αμμόχωστο', 'ammochostos', 'famagusta', 'παραλίμνι', 'αγία νάπα', 'πρωταράς', 'δερύνεια', 'αυγόρου', 'λιοπέτρι'],
};

// Main intercity stations for each region
export const INTERCITY_STATIONS: Record<string, string[]> = {
  nicosia: ['solomou', 'σολωμού', 'central bus station', 'intercity nicosia', 'καποδιστρίου'],
  limassol: ['old port', 'παλιό λιμάνι', 'νέο λιμάνι', 'central limassol', 'intercity limassol', 'τέρμα μιλτιάδου'],
  larnaca: ['finikoudes', 'φοινικούδες', 'αθηνών', 'intercity larnaca', 'αλκιβιάδου'],
  paphos: ['harbour', 'karavella', 'καραβέλλα', 'intercity paphos', 'habour'],
  famagusta: ['paralimni', 'protaras', 'intercity famagusta', 'ayia napa'],
};