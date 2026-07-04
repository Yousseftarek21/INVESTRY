// Reference data for the Real Estate location picker: governorates -> cities
// -> districts/compounds. Not exhaustive — the "Other" manual-entry fallback
// covers anything missing here.

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
    ],
  },
  {
    name: 'Alexandria',
    cities: [
      {
        name: 'Alexandria City',
        districts: ['Smouha', 'Roushdy', 'Sidi Gaber', 'Miami', 'San Stefano', 'Kafr Abdo'],
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
    ],
  },
  {
    name: 'Sharqia',
    cities: [
      { name: 'Zagazig', districts: ['Zagazig Center'] },
      { name: '10th of Ramadan', districts: ['10th of Ramadan Center'] },
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
