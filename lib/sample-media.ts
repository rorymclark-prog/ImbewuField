/** Only fictional demo records may select these invented adult portraits. */
export const SAMPLE_PORTRAITS = ['/demo/profile-woman.webp', '/demo/profile-man.webp',
  ...Array.from({ length: 13 }, (_, i) => `/demo/profile-${String(i + 3).padStart(2, '0')}.webp`)];
const PEOPLE: Record<string, number> = {
  "Noluthando Mbatha": 9,
  "Siyabonga Mbeki": 8,
  "Nobuhle Jali": 11,
  "Thembeka Ndlovu": 13,
  "Masego Seema": 9,
  "Kabelo Makgoba": 8,
  "Dineo Maleka": 11,
  "Thabo Mokgopa": 13,
  "Mpho Mokoena": 9,
  "Lerato Moshoeshoe": 8,
  "Palesa Mofokeng": 11,
  "Thabo Molapo": 13,
  "Tintswalo Mabunda": 9,
  "Hlayisani Baloyi": 8,
  "Nhlamulo Maluleke": 11,
  "Ntsako Chauke": 13,
  "Kagiso Molefe": 9,
  "Boitumelo Moagi": 8,
  "Neo Modise": 11,
  "Kefilwe Mokgosi": 13,
  'Nomsa Mthembu': 1, 'Sipho Ndlovu': 2, 'Thandeka Zulu': 4, 'Bongani Nkosi': 8,
  'Zanele Buthelezi': 11, 'Musa Ncwane': 5, 'Lindiwe Gumede': 9, 'Ntombi Khumalo': 6,
  'Sanele Mabaso': 3, 'Petrus Sithole': 10, 'Nokuthula Dlamini': 9, 'Andile Mkhize': 8,
  'Philani Cele': 13, 'Sindi Ngobese': 12, 'Jabulani Hadebe': 2, 'Nolwazi Shabalala': 15,
  'Thabo Mahlangu': 2, 'Nosipho Khumalo': 4, 'Jabu Dlamini': 5, 'Maria Sithole': 6,
  'Andile Ngubane': 8, 'Grace Mokoena': 9, 'Sibusiso Ndlovu': 3, 'Lerato Phiri': 11,
  'Bongani Zulu': 13, 'Precious Mbeki': 1, 'Aviwe Jacobs': 10, 'Asha Naidoo': 7,
  'Helen Botha': 12, 'Ravi Naidoo': 14, 'Zodwa Mthethwa': 15,
  'sample-mentor': 3, 'sample-mentor-coast': 4, 'sample-mentor-midlands': 12,
  'sample-organisation': 14, 'sample-funder': 15, 'sample-farmer': 1, 'sample-student': 8,
  s1: 1, s2: 8, s3: 4, s4: 13,
};
export function samplePortrait(identity: string): string {
  const assigned = PEOPLE[identity];
  const index = assigned ? assigned - 1 : [...identity].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0) % SAMPLE_PORTRAITS.length;
  return SAMPLE_PORTRAITS[index];
}
/** Representative AI photos, never uploaded evidence of a recorded harvest. */
export function sampleProducePhoto(name: string): string | null {
  const crop = name.replace(/^Sample\s*[—–-]\s*/i, '').toLowerCase().trim();
  if (/tomato/.test(crop)) return '/demo/tomatoes.webp';
  if (/spinach|swiss chard|swiss-chard/.test(crop)) return '/demo/spinach.webp';
  if (/cabbage/.test(crop)) return '/demo/cabbage.webp';
  const aliases: [RegExp, string][] = [
    [/carrot/, 'carrots'], [/onion/, 'onions'], [/maize|mielie/, 'maize'],
    [/^(dry beans|beans)$/, 'beans'], [/pumpkin/, 'pumpkin'],
    [/sweet[- ]potato/, 'sweet-potato'], [/green pepper|bell pepper|^peppers$/, 'peppers'],
    [/lettuce/, 'lettuce'], [/garlic/, 'garlic'], [/butternut/, 'butternut'],
  ];
  const match = aliases.find(([pattern]) => pattern.test(crop));
  return match ? `/demo/produce/${match[1]}.jpg` : null;
}
