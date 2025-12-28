// Points of Interest in Cyprus with approximate coordinates
export interface PointOfInterest {
  id: string;
  name: string;
  name_en: string;
  category: 'landmark' | 'shopping' | 'education' | 'hospital' | 'government' | 'entertainment' | 'transport' | 'beach' | 'hotel';
  lat: number;
  lon: number;
}

export const CYPRUS_POI: PointOfInterest[] = [
  // Nicosia / Λευκωσία
  { id: 'poi-mall-of-cyprus', name: 'Mall of Cyprus', name_en: 'Mall of Cyprus', category: 'shopping', lat: 35.1578, lon: 33.3823 },
  { id: 'poi-nicosia-general-hospital', name: 'Γενικό Νοσοκομείο Λευκωσίας', name_en: 'Nicosia General Hospital', category: 'hospital', lat: 35.1692, lon: 33.3583 },
  { id: 'poi-university-of-cyprus', name: 'Πανεπιστήμιο Κύπρου', name_en: 'University of Cyprus', category: 'education', lat: 35.1447, lon: 33.4103 },
  { id: 'poi-ledra-street', name: 'Οδός Λήδρας', name_en: 'Ledra Street', category: 'landmark', lat: 35.1724, lon: 33.3619 },
  { id: 'poi-eleftheria-square', name: 'Πλατεία Ελευθερίας', name_en: 'Eleftheria Square', category: 'landmark', lat: 35.1696, lon: 33.3604 },
  { id: 'poi-cyprus-museum', name: 'Κυπριακό Μουσείο', name_en: 'Cyprus Museum', category: 'landmark', lat: 35.1689, lon: 33.3550 },
  { id: 'poi-shacolas-tower', name: 'Πύργος Σακόλα', name_en: 'Shacolas Tower', category: 'landmark', lat: 35.1719, lon: 33.3622 },
  
  // Limassol / Λεμεσός
  { id: 'poi-my-mall-limassol', name: 'My Mall Limassol', name_en: 'My Mall Limassol', category: 'shopping', lat: 34.7071, lon: 33.0225 },
  { id: 'poi-limassol-marina', name: 'Μαρίνα Λεμεσού', name_en: 'Limassol Marina', category: 'entertainment', lat: 34.6698, lon: 33.0382 },
  { id: 'poi-limassol-general-hospital', name: 'Γενικό Νοσοκομείο Λεμεσού', name_en: 'Limassol General Hospital', category: 'hospital', lat: 34.6876, lon: 33.0319 },
  { id: 'poi-limassol-castle', name: 'Κάστρο Λεμεσού', name_en: 'Limassol Castle', category: 'landmark', lat: 34.6717, lon: 33.0417 },
  { id: 'poi-curium-beach', name: 'Παραλία Κουρίου', name_en: 'Curium Beach', category: 'beach', lat: 34.6653, lon: 32.8889 },
  { id: 'poi-dasoudi-beach', name: 'Παραλία Δασούδι', name_en: 'Dasoudi Beach', category: 'beach', lat: 34.6958, lon: 33.0850 },
  { id: 'poi-technopolis-20', name: 'Τεχνόπολις 20', name_en: 'Technopolis 20', category: 'entertainment', lat: 34.6825, lon: 33.0456 },
  { id: 'poi-cyprus-university-technology', name: 'ΤΕΠΑΚ', name_en: 'Cyprus University of Technology', category: 'education', lat: 34.6756, lon: 33.0444 },
  
  // Larnaca / Λάρνακα
  { id: 'poi-larnaca-airport', name: 'Αεροδρόμιο Λάρνακας', name_en: 'Larnaca Airport', category: 'transport', lat: 34.8751, lon: 33.6249 },
  { id: 'poi-finikoudes-beach', name: 'Παραλία Φοινικούδων', name_en: 'Finikoudes Beach', category: 'beach', lat: 34.9127, lon: 33.6389 },
  { id: 'poi-larnaca-marina', name: 'Μαρίνα Λάρνακας', name_en: 'Larnaca Marina', category: 'entertainment', lat: 34.9083, lon: 33.6361 },
  { id: 'poi-larnaca-general-hospital', name: 'Γενικό Νοσοκομείο Λάρνακας', name_en: 'Larnaca General Hospital', category: 'hospital', lat: 34.9239, lon: 33.6203 },
  { id: 'poi-saint-lazarus-church', name: 'Εκκλησία Αγίου Λαζάρου', name_en: 'Church of Saint Lazarus', category: 'landmark', lat: 34.9106, lon: 33.6361 },
  { id: 'poi-larnaca-salt-lake', name: 'Αλυκή Λάρνακας', name_en: 'Larnaca Salt Lake', category: 'landmark', lat: 34.8886, lon: 33.6133 },
  { id: 'poi-metropolis-mall', name: 'Metropolis Mall', name_en: 'Metropolis Mall', category: 'shopping', lat: 34.9022, lon: 33.6122 },
  
  // Paphos / Πάφος
  { id: 'poi-paphos-airport', name: 'Αεροδρόμιο Πάφου', name_en: 'Paphos Airport', category: 'transport', lat: 34.7180, lon: 32.4857 },
  { id: 'poi-paphos-harbour', name: 'Λιμάνι Πάφου', name_en: 'Paphos Harbour', category: 'landmark', lat: 34.7539, lon: 32.4072 },
  { id: 'poi-kings-avenue-mall', name: 'Kings Avenue Mall', name_en: 'Kings Avenue Mall', category: 'shopping', lat: 34.7625, lon: 32.4211 },
  { id: 'poi-paphos-general-hospital', name: 'Γενικό Νοσοκομείο Πάφου', name_en: 'Paphos General Hospital', category: 'hospital', lat: 34.7728, lon: 32.4297 },
  { id: 'poi-tombs-of-kings', name: 'Τάφοι των Βασιλέων', name_en: 'Tombs of the Kings', category: 'landmark', lat: 34.7728, lon: 32.3969 },
  { id: 'poi-kato-paphos-archaeological-park', name: 'Αρχαιολογικό Πάρκο Κάτω Πάφου', name_en: 'Kato Paphos Archaeological Park', category: 'landmark', lat: 34.7556, lon: 32.4061 },
  { id: 'poi-coral-bay', name: 'Παραλία Κόραλ Μπέι', name_en: 'Coral Bay Beach', category: 'beach', lat: 34.8517, lon: 32.3556 },
  
  // Ayia Napa / Αγία Νάπα
  { id: 'poi-nissi-beach', name: 'Παραλία Νησί', name_en: 'Nissi Beach', category: 'beach', lat: 34.9886, lon: 33.9522 },
  { id: 'poi-ayia-napa-monastery', name: 'Μοναστήρι Αγίας Νάπας', name_en: 'Ayia Napa Monastery', category: 'landmark', lat: 34.9894, lon: 33.9992 },
  { id: 'poi-waterworld', name: 'WaterWorld', name_en: 'WaterWorld Waterpark', category: 'entertainment', lat: 34.9808, lon: 33.9683 },
  { id: 'poi-makronissos-beach', name: 'Παραλία Μακρόνησος', name_en: 'Makronissos Beach', category: 'beach', lat: 34.9806, lon: 33.9317 },
  
  // Paralimni / Παραλίμνι
  { id: 'poi-protaras-beach', name: 'Παραλία Πρωταρά', name_en: 'Protaras Beach', category: 'beach', lat: 35.0122, lon: 34.0578 },
  { id: 'poi-fig-tree-bay', name: 'Fig Tree Bay', name_en: 'Fig Tree Bay', category: 'beach', lat: 35.0133, lon: 34.0553 },
  
  // Troodos / Τρόοδος
  { id: 'poi-troodos-square', name: 'Πλατεία Τροόδους', name_en: 'Troodos Square', category: 'landmark', lat: 34.9283, lon: 32.8756 },
  { id: 'poi-kykkos-monastery', name: 'Μοναστήρι Κύκκου', name_en: 'Kykkos Monastery', category: 'landmark', lat: 34.9833, lon: 32.7411 },
  { id: 'poi-mount-olympus', name: 'Όρος Όλυμπος (Χιονίστρα)', name_en: 'Mount Olympus (Chionistra)', category: 'landmark', lat: 34.9394, lon: 32.8683 },
  
  // Universities & Education
  { id: 'poi-frederick-university-nicosia', name: 'Frederick University Λευκωσία', name_en: 'Frederick University Nicosia', category: 'education', lat: 35.1389, lon: 33.3694 },
  { id: 'poi-frederick-university-limassol', name: 'Frederick University Λεμεσός', name_en: 'Frederick University Limassol', category: 'education', lat: 34.7011, lon: 33.0358 },
  { id: 'poi-european-university', name: 'European University Cyprus', name_en: 'European University Cyprus', category: 'education', lat: 35.1369, lon: 33.3728 },
  { id: 'poi-uclan-cyprus', name: 'UCLan Cyprus', name_en: 'UCLan Cyprus', category: 'education', lat: 34.9203, lon: 33.6236 },
];

// Get category icon
export const getCategoryIcon = (category: PointOfInterest['category']): string => {
  switch (category) {
    case 'landmark': return '🏛️';
    case 'shopping': return '🛍️';
    case 'education': return '🎓';
    case 'hospital': return '🏥';
    case 'government': return '🏛️';
    case 'entertainment': return '🎢';
    case 'transport': return '✈️';
    case 'beach': return '🏖️';
    case 'hotel': return '🏨';
    default: return '📍';
  }
};

// Get category name in Greek
export const getCategoryName = (category: PointOfInterest['category']): string => {
  switch (category) {
    case 'landmark': return 'Αξιοθέατο';
    case 'shopping': return 'Αγορές';
    case 'education': return 'Εκπαίδευση';
    case 'hospital': return 'Νοσοκομείο';
    case 'government': return 'Δημόσιες Υπηρεσίες';
    case 'entertainment': return 'Ψυχαγωγία';
    case 'transport': return 'Μεταφορές';
    case 'beach': return 'Παραλία';
    case 'hotel': return 'Ξενοδοχείο';
    default: return 'Σημείο';
  }
};
