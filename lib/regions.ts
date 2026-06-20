export interface Region {
  id: string;
  name: string;
  countryCode: string;
  maxLength: number;
  maxWidth: number;
  minLength: number;
  minWidth: number;
  description: string;
  note: string;
}

export const REGIONS: Region[] = [
  {
    id: 'turkey',
    name: 'Türkiye',
    countryCode: 'tr',
    minLength: 4,
    maxLength: 13,
    minWidth: 2.30,
    maxWidth: 4,
    description: 'Yurt içi teslimat',
    note: 'Uzunluk 4–13 m · Genişlik 2.30–4 m',
  },
  {
    id: 'europe',
    name: 'Avrupa',
    countryCode: 'eu',
    minLength: 4,
    maxLength: 13,
    minWidth: 2.30,
    maxWidth: 2.90,
    description: 'Avrupa\'ya deniz yolu',
    note: 'Uzunluk 4–13 m · Genişlik 2.30–2.90 m',
  },
  {
    id: 'usa',
    name: 'Amerika',
    countryCode: 'us',
    minLength: 4,
    maxLength: 11,
    minWidth: 2.10,
    maxWidth: 2.10,
    description: 'Kuzey Amerika\'ya deniz yolu',
    note: 'Uzunluk 4–11 m · Genişlik 2.10 m (sabit)',
  },
  {
    id: 'middle_east',
    name: 'Orta Doğu',
    countryCode: 'ae',
    minLength: 4,
    maxLength: 13,
    minWidth: 2.30,
    maxWidth: 2.90,
    description: 'Körfez ülkelerine deniz yolu',
    note: 'Uzunluk 4–13 m · Genişlik 2.30–2.90 m',
  },
];

export function getRegion(id: string): Region {
  return REGIONS.find(r => r.id === id) ?? REGIONS[0];
}
