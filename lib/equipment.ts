import type { PriceKey } from './pricing';

/** 3D'de görünmeyen, yalnızca seçilip fiyatlanan teknik ekipmanlar. */
export type EquipmentId = 'heatPump' | 'swimJet' | 'dosing' | 'saltChlorinator' | 'blueLagoon';

export const EQUIPMENT: { id: EquipmentId; priceKey: PriceKey; labelKey: string; noteKey: string; adminLabel: string }[] = [
  { id: 'heatPump',        priceKey: 'eq_heat_pump',  labelKey: 'configurator.eq_heat_pump',  noteKey: 'configurator.eq_heat_pump_note',  adminLabel: 'Isı Pompası' },
  { id: 'swimJet',         priceKey: 'eq_swimjet',    labelKey: 'configurator.eq_swimjet',    noteKey: 'configurator.eq_swimjet_note',    adminLabel: 'Swimjet (Akıntıya Karşı Yüzme)' },
  { id: 'dosing',          priceKey: 'eq_dosing',     labelKey: 'configurator.eq_dosing',     noteKey: 'configurator.eq_dosing_note',     adminLabel: 'pH-Klor Otomatik Dozajlama' },
  { id: 'saltChlorinator', priceKey: 'eq_salt',       labelKey: 'configurator.eq_salt',       noteKey: 'configurator.eq_salt_note',       adminLabel: 'Tuz-Klor Elektrolizi' },
  { id: 'blueLagoon',      priceKey: 'eq_blue_lagoon', labelKey: 'configurator.eq_blue_lagoon', noteKey: 'configurator.eq_blue_lagoon_note', adminLabel: 'Blue Lagoon (UV Dezenfeksiyon)' },
];
