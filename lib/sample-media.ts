/** These assets belong only to fictional demo people and evidence. */
export const samplePortrait = (id: string) => `/demo/profile-${[...id].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 2 ? 'woman' : 'man'}.webp`;
export const sampleProducePhoto = (name: string) => /tomato/i.test(name) ? '/demo/tomatoes.webp' : /spinach/i.test(name) ? '/demo/spinach.webp' : /cabbage/i.test(name) ? '/demo/cabbage.webp' : null;
