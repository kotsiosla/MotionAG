// Points of Interest in Cyprus with approximate coordinates
export interface PointOfInterest {
  id: string;
  name: string;
  name_en: string;
  category: 'landmark' | 'shopping' | 'education' | 'hospital' | 'government' | 'entertainment' | 'transport' | 'beach' | 'hotel' | 'restaurant' | 'sports' | 'religious';
  lat: number;
  lon: number;
}

export const CYPRUS_POI: PointOfInterest[] = [
  // ==================== NICOSIA / ΛΕΥΚΩΣΙΑ ====================
  // Shopping
  { id: 'poi-mall-of-cyprus', name: 'Mall of Cyprus', name_en: 'Mall of Cyprus', category: 'shopping', lat: 35.1578, lon: 33.3823 },
  { id: 'poi-nicosia-mall', name: 'Nicosia Mall', name_en: 'Nicosia Mall', category: 'shopping', lat: 35.1856, lon: 33.3822 },
  { id: 'poi-the-mall-of-engomi', name: 'The Mall of Engomi', name_en: 'The Mall of Engomi', category: 'shopping', lat: 35.1633, lon: 33.3456 },
  { id: 'poi-ikea-nicosia', name: 'IKEA Λευκωσία', name_en: 'IKEA Nicosia', category: 'shopping', lat: 35.1583, lon: 33.3833 },
  
  // Hospitals
  { id: 'poi-nicosia-general-hospital', name: 'Γενικό Νοσοκομείο Λευκωσίας', name_en: 'Nicosia General Hospital', category: 'hospital', lat: 35.1692, lon: 33.3583 },
  { id: 'poi-american-medical-center', name: 'American Medical Center', name_en: 'American Medical Center', category: 'hospital', lat: 35.1583, lon: 33.3667 },
  { id: 'poi-apollonion-hospital', name: 'Apollonion Private Hospital', name_en: 'Apollonion Private Hospital', category: 'hospital', lat: 35.1547, lon: 33.3739 },
  { id: 'poi-aretaeio-hospital', name: 'Αρεταίειο Νοσοκομείο', name_en: 'Aretaeio Hospital', category: 'hospital', lat: 35.1611, lon: 33.3822 },
  
  // Education
  { id: 'poi-university-of-cyprus', name: 'Πανεπιστήμιο Κύπρου', name_en: 'University of Cyprus', category: 'education', lat: 35.1447, lon: 33.4103 },
  { id: 'poi-frederick-university-nicosia', name: 'Frederick University Λευκωσία', name_en: 'Frederick University Nicosia', category: 'education', lat: 35.1389, lon: 33.3694 },
  { id: 'poi-european-university', name: 'European University Cyprus', name_en: 'European University Cyprus', category: 'education', lat: 35.1369, lon: 33.3728 },
  { id: 'poi-university-of-nicosia', name: 'Πανεπιστήμιο Λευκωσίας', name_en: 'University of Nicosia', category: 'education', lat: 35.1578, lon: 33.3767 },
  { id: 'poi-intercollege', name: 'Intercollege', name_en: 'Intercollege', category: 'education', lat: 35.1556, lon: 33.3789 },
  
  // Landmarks
  { id: 'poi-ledra-street', name: 'Οδός Λήδρας', name_en: 'Ledra Street', category: 'landmark', lat: 35.1724, lon: 33.3619 },
  { id: 'poi-eleftheria-square', name: 'Πλατεία Ελευθερίας', name_en: 'Eleftheria Square', category: 'landmark', lat: 35.1696, lon: 33.3604 },
  { id: 'poi-cyprus-museum', name: 'Κυπριακό Μουσείο', name_en: 'Cyprus Museum', category: 'landmark', lat: 35.1689, lon: 33.3550 },
  { id: 'poi-shacolas-tower', name: 'Πύργος Σακόλα', name_en: 'Shacolas Tower', category: 'landmark', lat: 35.1719, lon: 33.3622 },
  { id: 'poi-laiki-geitonia', name: 'Λαϊκή Γειτονιά', name_en: 'Laiki Geitonia', category: 'landmark', lat: 35.1714, lon: 33.3631 },
  { id: 'poi-venetian-walls', name: 'Ενετικά Τείχη', name_en: 'Venetian Walls', category: 'landmark', lat: 35.1706, lon: 33.3578 },
  
  // Hotels - Nicosia
  { id: 'poi-hilton-nicosia', name: 'Hilton Nicosia', name_en: 'Hilton Nicosia', category: 'hotel', lat: 35.1656, lon: 33.3656 },
  { id: 'poi-landmark-nicosia', name: 'Landmark Hotel Nicosia', name_en: 'Landmark Hotel Nicosia', category: 'hotel', lat: 35.1728, lon: 33.3647 },
  { id: 'poi-cleopatra-hotel', name: 'Cleopatra Hotel', name_en: 'Cleopatra Hotel', category: 'hotel', lat: 35.1706, lon: 33.3622 },
  { id: 'poi-centrum-hotel', name: 'Centrum Hotel', name_en: 'Centrum Hotel', category: 'hotel', lat: 35.1694, lon: 33.3614 },
  
  // Sports - Nicosia
  { id: 'poi-gsp-stadium', name: 'Στάδιο ΓΣΠ', name_en: 'GSP Stadium', category: 'sports', lat: 35.1489, lon: 33.3953 },
  { id: 'poi-makareio-stadium', name: 'Μακάρειο Στάδιο', name_en: 'Makareio Stadium', category: 'sports', lat: 35.1578, lon: 33.3683 },
  
  // Government
  { id: 'poi-presidential-palace', name: 'Προεδρικό Μέγαρο', name_en: 'Presidential Palace', category: 'government', lat: 35.1661, lon: 33.3564 },
  { id: 'poi-house-of-representatives', name: 'Βουλή των Αντιπροσώπων', name_en: 'House of Representatives', category: 'government', lat: 35.1667, lon: 33.3639 },
  
  // Restaurants - Nicosia
  { id: 'poi-to-anamma', name: 'Το Άναμμα', name_en: 'To Anamma', category: 'restaurant', lat: 35.1717, lon: 33.3619 },
  { id: 'poi-pyxida-fish-tavern', name: 'Πυξίδα Ψαροταβέρνα', name_en: 'Pyxida Fish Tavern', category: 'restaurant', lat: 35.1722, lon: 33.3628 },
  { id: 'poi-zanettos-tavern', name: 'Ταβέρνα Ζανέττος', name_en: 'Zanettos Tavern', category: 'restaurant', lat: 35.1711, lon: 33.3625 },
  { id: 'poi-piatsa-gourounaki', name: 'Πιάτσα Γουρουνάκι', name_en: 'Piatsa Gourounaki', category: 'restaurant', lat: 35.1708, lon: 33.3617 },

  // ==================== LIMASSOL / ΛΕΜΕΣΟΣ ====================
  // Shopping
  { id: 'poi-my-mall-limassol', name: 'My Mall Limassol', name_en: 'My Mall Limassol', category: 'shopping', lat: 34.7071, lon: 33.0225 },
  { id: 'poi-alfa-mega-limassol', name: 'Alfa Mega Hypermarket Λεμεσός', name_en: 'Alfa Mega Limassol', category: 'shopping', lat: 34.6889, lon: 33.0489 },
  
  // Hospitals
  { id: 'poi-limassol-general-hospital', name: 'Γενικό Νοσοκομείο Λεμεσού', name_en: 'Limassol General Hospital', category: 'hospital', lat: 34.6876, lon: 33.0319 },
  { id: 'poi-mediterranean-hospital', name: 'Mediterranean Hospital', name_en: 'Mediterranean Hospital', category: 'hospital', lat: 34.6978, lon: 33.0417 },
  { id: 'poi-ygia-polyclinic', name: 'YGIA Polyclinic', name_en: 'YGIA Polyclinic', category: 'hospital', lat: 34.6928, lon: 33.0378 },
  
  // Education
  { id: 'poi-cyprus-university-technology', name: 'ΤΕΠΑΚ', name_en: 'Cyprus University of Technology', category: 'education', lat: 34.6756, lon: 33.0444 },
  { id: 'poi-frederick-university-limassol', name: 'Frederick University Λεμεσός', name_en: 'Frederick University Limassol', category: 'education', lat: 34.7011, lon: 33.0358 },
  
  // Landmarks & Entertainment
  { id: 'poi-limassol-marina', name: 'Μαρίνα Λεμεσού', name_en: 'Limassol Marina', category: 'entertainment', lat: 34.6698, lon: 33.0382 },
  { id: 'poi-limassol-castle', name: 'Κάστρο Λεμεσού', name_en: 'Limassol Castle', category: 'landmark', lat: 34.6717, lon: 33.0417 },
  { id: 'poi-technopolis-20', name: 'Τεχνόπολις 20', name_en: 'Technopolis 20', category: 'entertainment', lat: 34.6825, lon: 33.0456 },
  { id: 'poi-limassol-zoo', name: 'Ζωολογικός Κήπος Λεμεσού', name_en: 'Limassol Zoo', category: 'entertainment', lat: 34.6889, lon: 33.0567 },
  { id: 'poi-old-port-limassol', name: 'Παλιό Λιμάνι Λεμεσού', name_en: 'Old Port Limassol', category: 'landmark', lat: 34.6711, lon: 33.0411 },
  
  // Beaches - Limassol
  { id: 'poi-curium-beach', name: 'Παραλία Κουρίου', name_en: 'Curium Beach', category: 'beach', lat: 34.6653, lon: 32.8889 },
  { id: 'poi-dasoudi-beach', name: 'Παραλία Δασούδι', name_en: 'Dasoudi Beach', category: 'beach', lat: 34.6958, lon: 33.0850 },
  { id: 'poi-ladys-mile-beach', name: "Lady's Mile Beach", name_en: "Lady's Mile Beach", category: 'beach', lat: 34.6347, lon: 33.0028 },
  { id: 'poi-governors-beach', name: "Governor's Beach", name_en: "Governor's Beach", category: 'beach', lat: 34.7228, lon: 33.2717 },
  { id: 'poi-pissouri-beach', name: 'Παραλία Πισσουρίου', name_en: 'Pissouri Beach', category: 'beach', lat: 34.6683, lon: 32.7028 },
  
  // Hotels - Limassol
  { id: 'poi-four-seasons-limassol', name: 'Four Seasons Limassol', name_en: 'Four Seasons Limassol', category: 'hotel', lat: 34.7028, lon: 33.1183 },
  { id: 'poi-amathus-beach-hotel', name: 'Amathus Beach Hotel', name_en: 'Amathus Beach Hotel', category: 'hotel', lat: 34.7033, lon: 33.1267 },
  { id: 'poi-st-raphael-resort', name: 'St. Raphael Resort', name_en: 'St. Raphael Resort', category: 'hotel', lat: 34.7022, lon: 33.1189 },
  { id: 'poi-grandresort-limassol', name: 'GrandResort Limassol', name_en: 'GrandResort Limassol', category: 'hotel', lat: 34.7025, lon: 33.1256 },
  { id: 'poi-parklane-resort', name: 'Parklane Resort & Spa', name_en: 'Parklane Resort & Spa', category: 'hotel', lat: 34.6889, lon: 33.0556 },
  { id: 'poi-crowne-plaza-limassol', name: 'Crowne Plaza Limassol', name_en: 'Crowne Plaza Limassol', category: 'hotel', lat: 34.6944, lon: 33.0722 },
  
  // Sports - Limassol
  { id: 'poi-tsirio-stadium', name: 'Τσίρειο Στάδιο', name_en: 'Tsirion Stadium', category: 'sports', lat: 34.6783, lon: 33.0389 },
  { id: 'poi-alphamega-stadium', name: 'Alphamega Stadium', name_en: 'Alphamega Stadium', category: 'sports', lat: 34.7083, lon: 33.0267 },
  
  // Restaurants - Limassol
  { id: 'poi-ocean-basket-limassol', name: 'Ocean Basket Λεμεσός', name_en: 'Ocean Basket Limassol', category: 'restaurant', lat: 34.6869, lon: 33.0456 },
  { id: 'poi-dionysus-mansion', name: 'Dionysus Mansion', name_en: 'Dionysus Mansion', category: 'restaurant', lat: 34.6717, lon: 33.0422 },
  { id: 'poi-karatello', name: 'Καρατέλλο', name_en: 'Karatello', category: 'restaurant', lat: 34.6722, lon: 33.0428 },
  { id: 'poi-artima', name: 'Artima', name_en: 'Artima', category: 'restaurant', lat: 34.6711, lon: 33.0417 },

  // ==================== LARNACA / ΛΑΡΝΑΚΑ ====================
  // Transport
  { id: 'poi-larnaca-airport', name: 'Αεροδρόμιο Λάρνακας', name_en: 'Larnaca Airport', category: 'transport', lat: 34.8751, lon: 33.6249 },
  
  // Shopping
  { id: 'poi-metropolis-mall', name: 'Metropolis Mall', name_en: 'Metropolis Mall', category: 'shopping', lat: 34.9022, lon: 33.6122 },
  { id: 'poi-city-center-larnaca', name: 'City Center Larnaca', name_en: 'City Center Larnaca', category: 'shopping', lat: 34.9178, lon: 33.6278 },
  
  // Hospitals
  { id: 'poi-larnaca-general-hospital', name: 'Γενικό Νοσοκομείο Λάρνακας', name_en: 'Larnaca General Hospital', category: 'hospital', lat: 34.9239, lon: 33.6203 },
  { id: 'poi-evangelismos-clinic', name: 'Κλινική Ευαγγελισμός', name_en: 'Evangelismos Clinic', category: 'hospital', lat: 34.9156, lon: 33.6289 },
  
  // Education
  { id: 'poi-uclan-cyprus', name: 'UCLan Cyprus', name_en: 'UCLan Cyprus', category: 'education', lat: 34.9203, lon: 33.6236 },
  
  // Beaches - Larnaca
  { id: 'poi-finikoudes-beach', name: 'Παραλία Φοινικούδων', name_en: 'Finikoudes Beach', category: 'beach', lat: 34.9127, lon: 33.6389 },
  { id: 'poi-mackenzie-beach', name: 'Παραλία Μακένζι', name_en: 'Mackenzie Beach', category: 'beach', lat: 34.8889, lon: 33.6256 },
  { id: 'poi-kastella-beach', name: 'Παραλία Καστέλλα', name_en: 'Kastella Beach', category: 'beach', lat: 34.8983, lon: 33.6167 },
  { id: 'poi-ced-beach', name: 'CTO Beach Larnaca', name_en: 'CTO Beach Larnaca', category: 'beach', lat: 34.9089, lon: 33.6344 },
  
  // Landmarks - Larnaca
  { id: 'poi-larnaca-marina', name: 'Μαρίνα Λάρνακας', name_en: 'Larnaca Marina', category: 'entertainment', lat: 34.9083, lon: 33.6361 },
  { id: 'poi-saint-lazarus-church', name: 'Εκκλησία Αγίου Λαζάρου', name_en: 'Church of Saint Lazarus', category: 'religious', lat: 34.9106, lon: 33.6361 },
  { id: 'poi-larnaca-salt-lake', name: 'Αλυκή Λάρνακας', name_en: 'Larnaca Salt Lake', category: 'landmark', lat: 34.8886, lon: 33.6133 },
  { id: 'poi-hala-sultan-tekke', name: 'Χαλά Σουλτάν Τεκκέ', name_en: 'Hala Sultan Tekke', category: 'religious', lat: 34.8817, lon: 33.6083 },
  { id: 'poi-larnaca-fort', name: 'Κάστρο Λάρνακας', name_en: 'Larnaca Fort', category: 'landmark', lat: 34.9103, lon: 33.6397 },
  { id: 'poi-pierides-museum', name: 'Μουσείο Πιερίδη', name_en: 'Pierides Museum', category: 'landmark', lat: 34.9117, lon: 33.6378 },
  
  // Hotels - Larnaca
  { id: 'poi-golden-bay-beach-hotel', name: 'Golden Bay Beach Hotel', name_en: 'Golden Bay Beach Hotel', category: 'hotel', lat: 34.9211, lon: 33.6478 },
  { id: 'poi-palm-beach-hotel', name: 'Palm Beach Hotel', name_en: 'Palm Beach Hotel', category: 'hotel', lat: 34.9156, lon: 33.6433 },
  { id: 'poi-sun-hall-hotel', name: 'Sun Hall Hotel', name_en: 'Sun Hall Hotel', category: 'hotel', lat: 34.9139, lon: 33.6411 },
  { id: 'poi-radisson-blu-larnaca', name: 'Radisson Blu Larnaca', name_en: 'Radisson Blu Larnaca', category: 'hotel', lat: 34.9117, lon: 33.6389 },
  { id: 'poi-lebay-beach-hotel', name: 'Lebay Beach Hotel', name_en: 'Lebay Beach Hotel', category: 'hotel', lat: 34.9178, lon: 33.6456 },
  
  // Sports - Larnaca
  { id: 'poi-aca-stadium', name: 'AEK Arena', name_en: 'AEK Arena', category: 'sports', lat: 34.9456, lon: 33.6567 },
  
  // Restaurants - Larnaca
  { id: 'poi-monte-carlo', name: 'Monte Carlo', name_en: 'Monte Carlo', category: 'restaurant', lat: 34.9128, lon: 33.6389 },
  { id: 'poi-maqam-al-sultan', name: 'Maqam Al Sultan', name_en: 'Maqam Al Sultan', category: 'restaurant', lat: 34.9117, lon: 33.6378 },
  { id: 'poi-art-cafe-1900', name: 'Art Cafe 1900', name_en: 'Art Cafe 1900', category: 'restaurant', lat: 34.9111, lon: 33.6367 },
  { id: 'poi-militzis', name: 'Μιλιτζής', name_en: 'Militzis', category: 'restaurant', lat: 34.9122, lon: 33.6383 },

  // ==================== PAPHOS / ΠΑΦΟΣ ====================
  // Transport
  { id: 'poi-paphos-airport', name: 'Αεροδρόμιο Πάφου', name_en: 'Paphos Airport', category: 'transport', lat: 34.7180, lon: 32.4857 },
  
  // Shopping
  { id: 'poi-kings-avenue-mall', name: 'Kings Avenue Mall', name_en: 'Kings Avenue Mall', category: 'shopping', lat: 34.7625, lon: 32.4211 },
  { id: 'poi-paphos-mall', name: 'Paphos Mall', name_en: 'Paphos Mall', category: 'shopping', lat: 34.7583, lon: 32.4178 },
  
  // Hospitals
  { id: 'poi-paphos-general-hospital', name: 'Γενικό Νοσοκομείο Πάφου', name_en: 'Paphos General Hospital', category: 'hospital', lat: 34.7728, lon: 32.4297 },
  { id: 'poi-iasis-hospital', name: 'IASIS Hospital', name_en: 'IASIS Hospital', category: 'hospital', lat: 34.7683, lon: 32.4228 },
  
  // Landmarks
  { id: 'poi-paphos-harbour', name: 'Λιμάνι Πάφου', name_en: 'Paphos Harbour', category: 'landmark', lat: 34.7539, lon: 32.4072 },
  { id: 'poi-tombs-of-kings', name: 'Τάφοι των Βασιλέων', name_en: 'Tombs of the Kings', category: 'landmark', lat: 34.7728, lon: 32.3969 },
  { id: 'poi-kato-paphos-archaeological-park', name: 'Αρχαιολογικό Πάρκο Κάτω Πάφου', name_en: 'Kato Paphos Archaeological Park', category: 'landmark', lat: 34.7556, lon: 32.4061 },
  { id: 'poi-paphos-castle', name: 'Κάστρο Πάφου', name_en: 'Paphos Castle', category: 'landmark', lat: 34.7539, lon: 32.4069 },
  { id: 'poi-aphrodite-rock', name: 'Πέτρα του Ρωμιού', name_en: "Aphrodite's Rock", category: 'landmark', lat: 34.6633, lon: 32.6267 },
  { id: 'poi-st-paul-pillar', name: 'Στύλος Αγίου Παύλου', name_en: "St. Paul's Pillar", category: 'religious', lat: 34.7547, lon: 32.4067 },
  
  // Beaches - Paphos
  { id: 'poi-coral-bay', name: 'Παραλία Κόραλ Μπέι', name_en: 'Coral Bay Beach', category: 'beach', lat: 34.8517, lon: 32.3556 },
  { id: 'poi-latchi-beach', name: 'Παραλία Λατσί', name_en: 'Latchi Beach', category: 'beach', lat: 35.0417, lon: 32.3917 },
  { id: 'poi-blue-lagoon-akamas', name: 'Γαλάζια Λίμνη Ακάμα', name_en: 'Blue Lagoon Akamas', category: 'beach', lat: 35.0567, lon: 32.3083 },
  { id: 'poi-vroudia-beach', name: 'Παραλία Βρουδιά', name_en: 'Vroudia Beach', category: 'beach', lat: 34.7544, lon: 32.4083 },
  
  // Hotels - Paphos
  { id: 'poi-elysium-hotel', name: 'Elysium Hotel', name_en: 'Elysium Hotel', category: 'hotel', lat: 34.7611, lon: 32.4017 },
  { id: 'poi-annabelle-hotel', name: 'Annabelle Hotel', name_en: 'Annabelle Hotel', category: 'hotel', lat: 34.7583, lon: 32.4028 },
  { id: 'poi-almyra-hotel', name: 'Almyra Hotel', name_en: 'Almyra Hotel', category: 'hotel', lat: 34.7589, lon: 32.4033 },
  { id: 'poi-constantinou-bros-hotels', name: 'Constantinou Bros Hotels', name_en: 'Constantinou Bros Hotels', category: 'hotel', lat: 34.7617, lon: 32.4022 },
  { id: 'poi-venus-beach-hotel', name: 'Venus Beach Hotel', name_en: 'Venus Beach Hotel', category: 'hotel', lat: 34.7544, lon: 32.4089 },
  { id: 'poi-coral-beach-hotel', name: 'Coral Beach Hotel', name_en: 'Coral Beach Hotel', category: 'hotel', lat: 34.8528, lon: 32.3544 },
  
  // Entertainment - Paphos
  { id: 'poi-paphos-waterpark', name: 'Aphrodite Waterpark', name_en: 'Aphrodite Waterpark', category: 'entertainment', lat: 34.8367, lon: 32.3917 },
  { id: 'poi-paphos-zoo', name: 'Ζωολογικός Κήπος Πάφου', name_en: 'Paphos Zoo', category: 'entertainment', lat: 34.8483, lon: 32.3600 },
  
  // Restaurants - Paphos
  { id: 'poi-hondros-tavern', name: 'Χόντρος Ταβέρνα', name_en: 'Hondros Tavern', category: 'restaurant', lat: 34.7556, lon: 32.4078 },
  { id: 'poi-theo-s-restaurant', name: "Theo's Restaurant", name_en: "Theo's Restaurant", category: 'restaurant', lat: 34.7544, lon: 32.4083 },
  { id: 'poi-pelican-restaurant', name: 'Pelican Restaurant', name_en: 'Pelican Restaurant', category: 'restaurant', lat: 34.7539, lon: 32.4078 },

  // ==================== AYIA NAPA / ΑΓΙΑ ΝΑΠΑ ====================
  // Beaches
  { id: 'poi-nissi-beach', name: 'Παραλία Νησί', name_en: 'Nissi Beach', category: 'beach', lat: 34.9886, lon: 33.9522 },
  { id: 'poi-makronissos-beach', name: 'Παραλία Μακρόνησος', name_en: 'Makronissos Beach', category: 'beach', lat: 34.9806, lon: 33.9317 },
  { id: 'poi-landa-beach', name: 'Landa Beach (Golden Beach)', name_en: 'Landa Beach', category: 'beach', lat: 34.9889, lon: 33.9583 },
  { id: 'poi-konnos-beach', name: 'Παραλία Κόννος', name_en: 'Konnos Beach', category: 'beach', lat: 34.9756, lon: 34.0667 },
  { id: 'poi-grecian-bay-beach', name: 'Grecian Bay Beach', name_en: 'Grecian Bay Beach', category: 'beach', lat: 34.9889, lon: 33.9944 },
  
  // Landmarks & Entertainment
  { id: 'poi-ayia-napa-monastery', name: 'Μοναστήρι Αγίας Νάπας', name_en: 'Ayia Napa Monastery', category: 'religious', lat: 34.9894, lon: 33.9992 },
  { id: 'poi-waterworld', name: 'WaterWorld', name_en: 'WaterWorld Waterpark', category: 'entertainment', lat: 34.9808, lon: 33.9683 },
  { id: 'poi-cape-greco', name: 'Κάβο Γκρέκο', name_en: 'Cape Greco', category: 'landmark', lat: 34.9667, lon: 34.0750 },
  { id: 'poi-ayia-napa-harbor', name: 'Λιμάνι Αγίας Νάπας', name_en: 'Ayia Napa Harbor', category: 'landmark', lat: 34.9878, lon: 34.0017 },
  { id: 'poi-luna-park', name: 'Luna Park Αγία Νάπα', name_en: 'Luna Park Ayia Napa', category: 'entertainment', lat: 34.9889, lon: 33.9978 },
  { id: 'poi-sea-caves', name: 'Θαλασσινές Σπηλιές', name_en: 'Sea Caves', category: 'landmark', lat: 34.9711, lon: 34.0583 },
  { id: 'poi-thalassa-museum', name: 'Μουσείο Θάλασσα', name_en: 'Thalassa Museum', category: 'landmark', lat: 34.9889, lon: 33.9994 },
  
  // Hotels - Ayia Napa
  { id: 'poi-nissi-beach-resort', name: 'Nissi Beach Resort', name_en: 'Nissi Beach Resort', category: 'hotel', lat: 34.9878, lon: 33.9533 },
  { id: 'poi-grecian-bay-hotel', name: 'Grecian Bay Hotel', name_en: 'Grecian Bay Hotel', category: 'hotel', lat: 34.9889, lon: 33.9944 },
  { id: 'poi-adams-beach-hotel', name: 'Adams Beach Hotel', name_en: 'Adams Beach Hotel', category: 'hotel', lat: 34.9867, lon: 33.9578 },
  { id: 'poi-olympic-lagoon-resort', name: 'Olympic Lagoon Resort', name_en: 'Olympic Lagoon Resort', category: 'hotel', lat: 34.9844, lon: 33.9389 },
  { id: 'poi-so-white-club', name: 'So White Club Resort', name_en: 'So White Club Resort', category: 'hotel', lat: 34.9856, lon: 33.9611 },

  // ==================== PROTARAS / ΠΡΩΤΑΡΑΣ ====================
  // Beaches
  { id: 'poi-protaras-beach', name: 'Παραλία Πρωταρά', name_en: 'Protaras Beach', category: 'beach', lat: 35.0122, lon: 34.0578 },
  { id: 'poi-fig-tree-bay', name: 'Fig Tree Bay', name_en: 'Fig Tree Bay', category: 'beach', lat: 35.0133, lon: 34.0553 },
  { id: 'poi-sunrise-beach', name: 'Sunrise Beach', name_en: 'Sunrise Beach', category: 'beach', lat: 35.0156, lon: 34.0594 },
  { id: 'poi-pernera-beach', name: 'Παραλία Περνέρας', name_en: 'Pernera Beach', category: 'beach', lat: 35.0267, lon: 34.0483 },
  { id: 'poi-kalamies-beach', name: 'Παραλία Καλαμιές', name_en: 'Kalamies Beach', category: 'beach', lat: 35.0089, lon: 34.0511 },
  
  // Hotels - Protaras
  { id: 'poi-capo-bay-hotel', name: 'Capo Bay Hotel', name_en: 'Capo Bay Hotel', category: 'hotel', lat: 35.0128, lon: 34.0567 },
  { id: 'poi-sunrise-pearl-hotel', name: 'Sunrise Pearl Hotel', name_en: 'Sunrise Pearl Hotel', category: 'hotel', lat: 35.0139, lon: 34.0583 },
  { id: 'poi-grecian-park-hotel', name: 'Grecian Park Hotel', name_en: 'Grecian Park Hotel', category: 'hotel', lat: 34.9778, lon: 34.0722 },
  { id: 'poi-anastasia-beach-hotel', name: 'Anastasia Beach Hotel', name_en: 'Anastasia Beach Hotel', category: 'hotel', lat: 35.0144, lon: 34.0589 },
  
  // Landmarks
  { id: 'poi-profitis-ilias-church', name: 'Εκκλησία Προφήτη Ηλία Πρωταρά', name_en: 'Prophet Elias Church Protaras', category: 'religious', lat: 35.0111, lon: 34.0528 },
  { id: 'poi-ocean-aquarium', name: 'Ocean Aquarium', name_en: 'Ocean Aquarium', category: 'entertainment', lat: 35.0222, lon: 34.0483 },
  { id: 'poi-magic-dancing-waters', name: 'Magic Dancing Waters', name_en: 'Magic Dancing Waters', category: 'entertainment', lat: 35.0156, lon: 34.0561 },

  // ==================== TROODOS / ΤΡΟΟΔΟΣ ====================
  // Landmarks & Villages
  { id: 'poi-troodos-square', name: 'Πλατεία Τροόδους', name_en: 'Troodos Square', category: 'landmark', lat: 34.9283, lon: 32.8756 },
  { id: 'poi-kykkos-monastery', name: 'Μοναστήρι Κύκκου', name_en: 'Kykkos Monastery', category: 'religious', lat: 34.9833, lon: 32.7411 },
  { id: 'poi-mount-olympus', name: 'Όρος Όλυμπος (Χιονίστρα)', name_en: 'Mount Olympus (Chionistra)', category: 'landmark', lat: 34.9394, lon: 32.8683 },
  { id: 'poi-trooditissa-monastery', name: 'Μοναστήρι Τροοδίτισσας', name_en: 'Trooditissa Monastery', category: 'religious', lat: 34.9094, lon: 32.8389 },
  { id: 'poi-platres', name: 'Πλάτρες', name_en: 'Platres', category: 'landmark', lat: 34.8889, lon: 32.8639 },
  { id: 'poi-omodos-village', name: 'Χωριό Όμοδος', name_en: 'Omodos Village', category: 'landmark', lat: 34.8447, lon: 32.8067 },
  { id: 'poi-kakopetria', name: 'Κακοπετριά', name_en: 'Kakopetria', category: 'landmark', lat: 34.9589, lon: 32.9028 },
  { id: 'poi-caledonia-waterfall', name: 'Καταρράκτες Καληδονίας', name_en: 'Caledonia Waterfalls', category: 'landmark', lat: 34.8983, lon: 32.8633 },
  { id: 'poi-millomeris-waterfall', name: 'Καταρράκτης Μιλλομέρη', name_en: 'Millomeris Waterfall', category: 'landmark', lat: 34.8917, lon: 32.8611 },
  { id: 'poi-lefkara-village', name: 'Χωριό Λεύκαρα', name_en: 'Lefkara Village', category: 'landmark', lat: 34.8667, lon: 33.3056 },
  { id: 'poi-agros-village', name: 'Χωριό Αγρός', name_en: 'Agros Village', category: 'landmark', lat: 34.9194, lon: 33.0167 },
  
  // Hotels - Troodos
  { id: 'poi-jubilee-hotel', name: 'Jubilee Hotel Troodos', name_en: 'Jubilee Hotel Troodos', category: 'hotel', lat: 34.9278, lon: 32.8756 },
  { id: 'poi-forest-park-hotel', name: 'Forest Park Hotel', name_en: 'Forest Park Hotel', category: 'hotel', lat: 34.8867, lon: 32.8622 },
  { id: 'poi-casale-panayiotis', name: 'Casale Panayiotis', name_en: 'Casale Panayiotis', category: 'hotel', lat: 34.9889, lon: 32.8167 },
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
    case 'restaurant': return '🍽️';
    case 'sports': return '⚽';
    case 'religious': return '⛪';
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
    case 'restaurant': return 'Εστιατόριο';
    case 'sports': return 'Αθλητισμός';
    case 'religious': return 'Θρησκευτικό';
    default: return 'Σημείο';
  }
};
