import type { Issuer } from '../types';

// Card artwork for the Portfolio and landing visuals: a colour scheme and a
// short name per card, drawn in code. Deliberately generic: colour and the
// card's name only, never an issuer's logo or actual card design.
export interface CardArtStyle {
  from: string;
  to: string;
  // Text and icon colour that stays legible on the gradient.
  ink: 'light' | 'dark';
  shortName: string;
}

const STYLES: Record<string, CardArtStyle> = {
  csr: { from: '#111827', to: '#334155', ink: 'light', shortName: 'Sapphire Reserve' },
  csp: { from: '#1e3a8a', to: '#3b6fd8', ink: 'light', shortName: 'Sapphire Preferred' },
  freedom: { from: '#7fb2f0', to: '#c7defa', ink: 'dark', shortName: 'Freedom' },
  ventureone: { from: '#475569', to: '#94a3b8', ink: 'light', shortName: 'VentureOne' },
  venture: { from: '#1e3a5f', to: '#3f5f82', ink: 'light', shortName: 'Venture' },
  venturex: { from: '#0b1220', to: '#2b3647', ink: 'light', shortName: 'Venture X' },
  amexgreen: { from: '#1f4d36', to: '#4f7f5f', ink: 'light', shortName: 'Classic Green' },
  amexgold: { from: '#b08a3e', to: '#e6cf8f', ink: 'dark', shortName: 'Gold' },
  amexplatinum: { from: '#a7adb6', to: '#e8eaee', ink: 'dark', shortName: 'Platinum' },
  citistrata: { from: '#1d6fa5', to: '#6cb4e4', ink: 'light', shortName: 'Strata' },
  citistratapremier: { from: '#0c3c63', to: '#1d6fa5', ink: 'light', shortName: 'Strata Premier' },
  citistrataelite: { from: '#0b1220', to: '#1c3350', ink: 'light', shortName: 'Strata Elite' },
  boatravelrewards: { from: '#8f1d2c', to: '#c94152', ink: 'light', shortName: 'Travel Rewards' },
  boapremiumrewards: { from: '#1c2140', to: '#3a4378', ink: 'light', shortName: 'Premium Rewards' },
  boapremiumrewardselite: { from: '#2a2d3a', to: '#5b6070', ink: 'light', shortName: 'Premium Rewards Elite' },
  biltblue: { from: '#2453c7', to: '#6b93f0', ink: 'light', shortName: 'Blue' },
  biltobsidian: { from: '#0a0a0a', to: '#2c2c2c', ink: 'light', shortName: 'Obsidian' },
  biltpalladium: { from: '#8d939c', to: '#d9dce1', ink: 'dark', shortName: 'Palladium' },
};

const FALLBACK: CardArtStyle = { from: '#1e3a5f', to: '#3f5f82', ink: 'light', shortName: 'Card' };

export function cardArtStyle(cardId: string): CardArtStyle {
  return STYLES[cardId] ?? FALLBACK;
}

// One tone per bank, for the Portfolio breakdown bar on the dark summary
// panel. All from the blue-grey family, light enough to read on navy, so the
// bar reads as one palette rather than six brands.
export const ISSUER_TONES: Record<Issuer, string> = {
  chase: '#9cc0ea',
  capitalOne: '#5d8fcf',
  amex: '#d4e2f2',
  citi: '#3b6db0',
  bankOfAmerica: '#8a99ad',
  bilt: '#b9c6d6',
};
