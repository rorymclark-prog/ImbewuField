/** Only fictional demo records may select these invented adult portraits. */
export const SAMPLE_PORTRAITS = ['/demo/profile-woman.webp', '/demo/profile-man.webp',
  ...Array.from({ length: 13 }, (_, i) => `/demo/profile-${String(i + 3).padStart(2, '0')}.webp`)];
const PEOPLE: Record<string, number> = {
  'Nomsa Mthembu': 1, 'Sipho Ndlovu': 2, 'Thandeka Zulu': 4, 'Bongani Nkosi': 8,
  'Zanele Buthelezi': 11, 'Musa Ncwane': 5, 'Lindiwe Gumede': 7, 'Ntombi Khumalo': 6,
  'Sanele Mabaso': 3, 'Petrus Sithole': 10, 'Nokuthula Dlamini': 9, 'Andile Mkhize': 14,
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
export const sampleProducePhoto = (name: string) => /tomato/i.test(name) ? '/demo/tomatoes.webp' : /spinach/i.test(name) ? '/demo/spinach.webp' : /cabbage/i.test(name) ? '/demo/cabbage.webp' : null;
