// "Should I spend points on this trip?" — one engine for the web app and the
// WhatsApp webhook. Pure functions, no UI imports.
export { evaluateVerdict } from './evaluate';
export { breakevenPoints, inferChaseCardType, isLegacyActive, priceChaseTravel } from './chaseTravel';
export { computeRunway } from './runway';
export type * from './types';
