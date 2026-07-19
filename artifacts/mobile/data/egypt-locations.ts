// Reference data for the Real Estate location picker: governorates -> cities
// -> districts/compounds. Covers all 27 Egyptian governorates so every user
// can find their own area; well-known cities get a fuller district breakdown,
// smaller governorates get at least their capital city so nothing is missing
// entirely. The "Other" manual-entry fallback still covers anything unlisted.

export interface EgyptCity {
  name: string;
  districts: string[];
}

export interface EgyptGovernorate {
  name: string;
  cities: EgyptCity[];
}

export const EGYPT_LOCATIONS: EgyptGovernorate[] = [
  {
    name: 'Cairo',
    cities: [
      {
        name: 'New Cairo',
        districts: ['5th Settlement', '1st Settlement', '3rd Settlement', 'Madinaty', 'Mostakbal City', 'Al Rehab'],
      },
      {
        name: 'Nasr City',
        districts: ['Nasr City District 1', 'Nasr City District 7', 'Nasr City District 10'],
      },
      {
        name: 'Heliopolis',
        districts: ['Roxy', 'Korba', 'Sheraton', 'El Nozha'],
      },
      {
        name: 'Maadi',
        districts: ['Maadi Sarayat', 'Degla', 'Zahraa El Maadi'],
      },
      {
        name: 'Downtown Cairo',
        districts: ['Garden City', 'Zamalek', 'Abdeen'],
      },
      {
        name: 'New Administrative Capital',
        districts: ['R7', 'R8', 'Downtown District', 'Government District'],
      },
      {
        name: 'Mokattam',
        districts: ['Mokattam Hills', 'Mokattam City'],
      },
      {
        name: 'Shorouk City',
        districts: ['Shorouk 1st District', 'Shorouk 2nd District'],
      },
      {
        name: 'Badr City',
        districts: ['Badr 1st District', 'Badr 2nd District'],
      },
    ],
  },
  {
    name: 'Giza',
    cities: [
      {
        name: 'Sheikh Zayed',
        districts: ['Beverly Hills', 'Allegria', 'Zayed Dunes', 'Green Belt'],
      },
      {
        name: '6th of October',
        districts: ['Dreamland', 'Palm Hills', 'Hyde Park', 'Sodic West'],
      },
      {
        name: 'Dokki',
        districts: ['Dokki Center', 'Mesaha'],
      },
      {
        name: 'Mohandessin',
        districts: ['Mohandessin Center', 'Sudan Street'],
      },
      {
        name: 'Haram',
        districts: ['Faisal', 'Pyramids Gardens'],
      },
      {
        name: 'Hadayek El Ahram',
        districts: ['Hadayek El Ahram Center'],
      },
    ],
  },
  {
    name: 'Alexandria',
    cities: [
      {
        name: 'Alexandria City',
        districts: ['Smouha', 'Roushdy', 'Sidi Gaber', 'Miami', 'San Stefano', 'Kafr Abdo', 'Stanley', 'Sporting', 'Mandara', 'Agami'],
      },
      {
        name: 'North Coast',
        districts: ['Marassi', 'Marina', 'Hacienda Bay', 'Sidi Abdel Rahman', 'El Alamein'],
      },
    ],
  },
  {
    name: 'Red Sea',
    cities: [
      {
        name: 'Hurghada',
        districts: ['El Kawther', 'Sakkala', 'El Ahyaa'],
      },
      {
        name: 'El Gouna',
        districts: ['El Gouna Marina', 'Downtown El Gouna'],
      },
      {
        name: 'Sahl Hasheesh',
        districts: ['Sahl Hasheesh Bay'],
      },
      {
        name: 'Ain Sokhna',
        districts: ['Ain Sokhna Center'],
      },
      {
        name: 'Makadi Bay',
        districts: ['Makadi Bay Center'],
      },
    ],
  },
  {
    name: 'South Sinai',
    cities: [
      {
        name: 'Sharm El Sheikh',
        districts: ['Naama Bay', 'Nabq Bay', 'Sharks Bay'],
      },
      {
        name: 'Dahab',
        districts: ['Dahab Center', 'Assalah'],
      },
    ],
  },
  {
    name: 'North Sinai',
    cities: [
      { name: 'Arish', districts: ['Arish Center'] },
    ],
  },
  {
    name: 'Matrouh',
    cities: [
      {
        name: 'Marsa Matrouh',
        districts: ['Matrouh Center'],
      },
    ],
  },
  {
    name: 'Qalyubia',
    cities: [
      {
        name: 'Shubra El Kheima',
        districts: ['Shubra El Kheima Center'],
      },
      {
        name: 'Banha',
        districts: ['Banha Center'],
      },
    ],
  },
  {
    name: 'Dakahlia',
    cities: [
      { name: 'Mansoura', districts: ['Mansoura Center', 'Toriel'] },
      { name: 'New Mansoura', districts: ['New Mansoura City'] },
    ],
  },
  {
    name: 'Sharqia',
    cities: [
      { name: 'Zagazig', districts: ['Zagazig Center'] },
      { name: '10th of Ramadan', districts: ['10th of Ramadan Center'] },
      { name: 'Obour City', districts: ['Obour City Center'] },
    ],
  },
  {
    name: 'Ismailia',
    cities: [
      { name: 'Ismailia City', districts: ['Ismailia City Center'] },
    ],
  },
  {
    name: 'Suez',
    cities: [
      { name: 'Suez City', districts: ['Suez City Center'] },
    ],
  },
  {
    name: 'Port Said',
    cities: [
      { name: 'Port Said City', districts: ['Port Fouad', 'Port Said Center'] },
    ],
  },
  {
    name: 'Damietta',
    cities: [
      { name: 'Damietta City', districts: ['New Damietta', 'Damietta Center'] },
    ],
  },
  {
    name: 'Beheira',
    cities: [
      { name: 'Damanhur', districts: ['Damanhur Center'] },
    ],
  },
  {
    name: 'Kafr El Sheikh',
    cities: [
      { name: 'Kafr El Sheikh City', districts: ['Kafr El Sheikh Center'] },
    ],
  },
  {
    name: 'Gharbia',
    cities: [
      { name: 'Tanta', districts: ['Tanta Center'] },
    ],
  },
  {
    name: 'Menoufia',
    cities: [
      { name: 'Shibin El Kom', districts: ['Shibin El Kom Center'] },
      { name: 'Sadat City', districts: ['Sadat City Center'] },
    ],
  },
  {
    name: 'Fayoum',
    cities: [
      { name: 'Fayoum City', districts: ['Fayoum City Center'] },
    ],
  },
  {
    name: 'Beni Suef',
    cities: [
      { name: 'Beni Suef City', districts: ['Beni Suef City Center'] },
    ],
  },
  {
    name: 'Minya',
    cities: [
      { name: 'Minya City', districts: ['Minya City Center'] },
    ],
  },
  {
    name: 'Assiut',
    cities: [
      { name: 'Assiut City', districts: ['Assiut City Center'] },
    ],
  },
  {
    name: 'Sohag',
    cities: [
      { name: 'Sohag City', districts: ['Sohag City Center'] },
    ],
  },
  {
    name: 'Qena',
    cities: [
      { name: 'Qena City', districts: ['Qena City Center'] },
    ],
  },
  {
    name: 'Luxor',
    cities: [
      { name: 'Luxor City', districts: ['Luxor City Center'] },
    ],
  },
  {
    name: 'Aswan',
    cities: [
      { name: 'Aswan City', districts: ['Aswan City Center'] },
    ],
  },
  {
    name: 'New Valley',
    cities: [
      { name: 'Kharga', districts: ['Kharga Center'] },
    ],
  },
  {
    name: 'Other',
    cities: [
      { name: 'Other', districts: ['Other'] },
    ],
  },
];

export const GOVERNORATE_NAMES = EGYPT_LOCATIONS.map(g => g.name);

export function citiesForGovernorate(governorate: string): EgyptCity[] {
  return EGYPT_LOCATIONS.find(g => g.name === governorate)?.cities ?? [];
}

export function districtsForCity(governorate: string, city: string): string[] {
  return citiesForGovernorate(governorate).find(c => c.name === city)?.districts ?? [];
}
