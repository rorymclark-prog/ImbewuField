/** Fictional gardens and adult participants. Map points are illustrative town references, not surveyed properties. */
export interface SampleGarden { id: string; name: string; town: string; lat: number; lon: number; farmers: number; status: 'thriving' | 'establishing' | 'support'; produceKg: number; training: number; facilitator: string; kind?: string; areaM2?: number; production: { vegetableM2: number; stapleM2: number }; language?: string }
export const SAMPLE_GARDENS: SampleGarden[] = [
  { id: 'g1', production: { vegetableM2: 1800, stapleM2: 1200 }, language: 'isiZulu', kind: 'Community garden', areaM2: 6000, name: 'Siyazama Community Garden', town: 'Soweto, GP', lat: -26.267, lon: 27.858, farmers: 28, status: 'thriving', produceKg: 1240, training: 92, facilitator: 'Nomsa M.' },
  { id: 'g2', production: { vegetableM2: 240, stapleM2: 160 }, language: 'isiZulu', kind: 'Crèche garden', areaM2: 2400, name: 'Umlazi Little Leaves Crèche Garden', town: 'Umlazi, KZN', lat: -29.966, lon: 30.889, farmers: 19, status: 'thriving', produceKg: 980, training: 84, facilitator: 'Sipho D.' },
  { id: 'g3', production: { vegetableM2: 600, stapleM2: 360 }, language: 'isiXhosa', kind: 'School garden', areaM2: 3600, name: 'Mthatha Learning School Garden', town: 'Mthatha, EC', lat: -31.589, lon: 28.783, farmers: 22, status: 'establishing', produceKg: 410, training: 61, facilitator: 'Thandi N.' },
  { id: 'g4', production: { vegetableM2: 240, stapleM2: 120 }, language: 'isiXhosa', kind: 'Homestead garden', areaM2: 1000, name: 'Gugulethu Homestead Greens', town: 'Gugulethu, WC', lat: -33.98, lon: 18.571, farmers: 16, status: 'thriving', produceKg: 1130, training: 88, facilitator: 'Aviwe K.' },
  { id: 'g5', production: { vegetableM2: 2400, stapleM2: 600 }, language: 'Sepedi', kind: 'Commercial garden', areaM2: 4046.8564224, name: 'Tzaneen Agroecology Plot', town: 'Tzaneen, LP', lat: -23.833, lon: 30.163, farmers: 31, status: 'thriving', produceKg: 1560, training: 79, facilitator: 'Rofhiwa M.' },
  { id: 'g6', production: { vegetableM2: 400, stapleM2: 600 }, language: 'Sesotho', kind: 'Community garden', areaM2: 4000, name: 'Botshabelo Plots', town: 'Botshabelo, FS', lat: -29.27, lon: 26.74, farmers: 14, status: 'support', produceKg: 180, training: 38, facilitator: 'Lerato S.' },
  { id: 'g7', production: { vegetableM2: 180, stapleM2: 120 }, language: 'isiXhosa', kind: 'Homestead garden', areaM2: 1000, name: 'Kuyasa Kitchen Garden', town: 'Khayelitsha, WC', lat: -34.043, lon: 18.681, farmers: 20, status: 'establishing', produceKg: 520, training: 66, facilitator: 'Aviwe K.' },
  { id: 'g8', production: { vegetableM2: 1600, stapleM2: 1800 }, language: 'Xitsonga', kind: 'Community garden', areaM2: 7000, name: 'Giyani Indigenous Garden', town: 'Giyani, LP', lat: -23.302, lon: 30.718, farmers: 25, status: 'thriving', produceKg: 1020, training: 81, facilitator: 'Rofhiwa M.' },
  { id: 'g9', production: { vegetableM2: 1400, stapleM2: 600 }, language: 'isiXhosa', kind: 'Commercial garden', areaM2: 4046.8564224, name: 'Mdantsane Veg Co-op', town: 'Mdantsane, EC', lat: -32.94, lon: 27.78, farmers: 18, status: 'establishing', produceKg: 470, training: 58, facilitator: 'Thandi N.' },
  { id: 'g10', production: { vegetableM2: 240, stapleM2: 0 }, language: 'Setswana', kind: 'Community food forest', areaM2: 3000, name: 'Galeshewe Food Forest', town: 'Kimberley, NC', lat: -28.715, lon: 24.733, farmers: 12, status: 'support', produceKg: 140, training: 32, facilitator: 'Lerato S.' },
  { id: 'g11', production: { vegetableM2: 1000, stapleM2: 600 }, language: 'Xitsonga', kind: 'School garden', areaM2: 5000, name: 'Bushbuckridge School Garden', town: 'Bushbuckridge, MP', lat: -24.83, lon: 31.08, farmers: 27, status: 'thriving', produceKg: 1310, training: 86, facilitator: 'Sipho D.' },
  { id: 'g12', production: { vegetableM2: 1400, stapleM2: 1200 }, language: 'Setswana', kind: 'Community garden', areaM2: 8000, name: 'Rustenburg Roots', town: 'Rustenburg, NW', lat: -25.667, lon: 27.242, farmers: 17, status: 'establishing', produceKg: 600, training: 64, facilitator: 'Nomsa M.' },
  { id: 'g13', production: { vegetableM2: 100, stapleM2: 60 }, language: 'isiZulu', name: 'Little Sunbirds Crèche Garden', town: 'Durban, KZN', lat: -29.85, lon: 31.02, farmers: 6, status: 'establishing', produceKg: 120, training: 60, facilitator: 'Nosipho K.', kind: 'Crèche garden', areaM2: 800 },
  { id: 'g14', production: { vegetableM2: 1600, stapleM2: 1000 }, language: 'isiZulu', name: 'Masakhane One Acre Co-op', town: 'Howick, KZN', lat: -29.48, lon: 30.23, farmers: 12, status: 'thriving', produceKg: 1900, training: 90, facilitator: 'Helen B.', kind: 'Community garden', areaM2: 4046.8564224 },
  { id: 'g15', production: { vegetableM2: 2600, stapleM2: 500 }, language: 'isiZulu', name: 'Green Horizon Market Garden', town: 'Pietermaritzburg, KZN', lat: -29.61, lon: 30.39, farmers: 4, status: 'thriving', produceKg: 2100, training: 85, facilitator: 'Sibusiso N.', kind: 'Commercial garden', areaM2: 4046.8564224 },
  { id: 'g16', production: { vegetableM2: 80, stapleM2: 40 }, language: 'Sesotho', kind: 'Homestead garden', areaM2: 450, name: 'Mokoena Family Homestead', town: 'Botshabelo, FS', lat: -29.274, lon: 26.746, farmers: 4, status: 'establishing', produceKg: 85, training: 60, facilitator: 'Mpho Mokoena' },
  { id: 'g17', production: { vegetableM2: 300, stapleM2: 180 }, language: 'Sesotho', kind: 'School garden', areaM2: 1800, name: 'Thuto School Learning Garden', town: 'Botshabelo, FS', lat: -29.279, lon: 26.739, farmers: 8, status: 'thriving', produceKg: 350, training: 80, facilitator: 'Lerato Moshoeshoe' },
  { id: 'g18', production: { vegetableM2: 72, stapleM2: 48 }, language: 'Sesotho', kind: 'Crèche garden', areaM2: 600, name: 'Naledi Early Learning Garden', town: 'Botshabelo, FS', lat: -29.265, lon: 26.751, farmers: 4, status: 'establishing', produceKg: 70, training: 50, facilitator: 'Palesa Mofokeng' },
];

export const SAMPLE_PARTICIPANTS: Record<string, string[]> = {
  "isiZulu": [
    "Nosipho Khumalo",
    "Sibusiso Ndlovu",
    "Zodwa Mthethwa",
    "Bongani Zulu"
  ],
  "isiXhosa": [
    "Noluthando Mbatha",
    "Siyabonga Mbeki",
    "Nobuhle Jali",
    "Thembeka Ndlovu"
  ],
  "Sepedi": [
    "Masego Seema",
    "Kabelo Makgoba",
    "Dineo Maleka",
    "Thabo Mokgopa"
  ],
  "Sesotho": [
    "Mpho Mokoena",
    "Lerato Moshoeshoe",
    "Palesa Mofokeng",
    "Thabo Molapo"
  ],
  "Xitsonga": [
    "Tintswalo Mabunda",
    "Hlayisani Baloyi",
    "Nhlamulo Maluleke",
    "Ntsako Chauke"
  ],
  "Setswana": [
    "Kagiso Molefe",
    "Boitumelo Moagi",
    "Neo Modise",
    "Kefilwe Mokgosi"
  ]
};

/** Illustrative planted allocations, not yields inferred from generated photographs. */
export function sampleSitePhoto(id: string): string | undefined {
  return SAMPLE_GARDENS.some(g => g.id === id) ? `/demo/sites/${id}.jpg` : undefined;
}
export function sampleSitePhotos(id: string) {
  const garden = SAMPLE_GARDENS.find(g => g.id === id);
  return garden ? [{ image: sampleSitePhoto(id)!, caption: `${garden.name} — AI-generated fictional site reference. Not a measured layout or field evidence.` }] : [];
}
