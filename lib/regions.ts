export interface Region {
  id: string;
  name: string;
  countryCode: string;    // for flagcdn
  maxLength: number;      // metres
  maxWidth: number;       // metres
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
    maxLength: 14,
    maxWidth: 5,
    minLength: 2,
    minWidth: 2,
    description: 'Yurt içi teslimat',
    note: 'Karayolu taşımacılığı — azami 14 × 5 m',
  },
  {
    id: 'europe',
    name: 'Avrupa',
    countryCode: 'eu',
    maxLength: 13,
    maxWidth: 5,
    minLength: 2,
    minWidth: 2,
    description: 'Avrupa\'ya deniz yolu',
    note: '40ft konteyner — azami 13 × 5 m',
  },
  {
    id: 'usa',
    name: 'Amerika',
    countryCode: 'us',
    maxLength: 11.5,
    maxWidth: 5,
    minLength: 2,
    minWidth: 2,
    description: 'Kuzey Amerika\'ya deniz yolu',
    note: '40ft konteyner — azami 11.5 × 5 m',
  },
  {
    id: 'middle_east',
    name: 'Orta Doğu',
    countryCode: 'ae',
    maxLength: 12,
    maxWidth: 5,
    minLength: 2,
    minWidth: 2,
    description: 'Körfez ülkelerine deniz yolu',
    note: '40ft konteyner — azami 12 × 5 m',
  },
  {
    id: 'other',
    name: 'Diğer Ülkeler',
    countryCode: 'un',
    maxLength: 11,
    maxWidth: 4.5,
    minLength: 2,
    minWidth: 2,
    description: 'Diğer uluslararası teslimat',
    note: 'Standart konteyner — azami 11 × 4.5 m',
  },
];

export function getRegion(id: string): Region {
  return REGIONS.find(r => r.id === id) ?? REGIONS[0];
}
