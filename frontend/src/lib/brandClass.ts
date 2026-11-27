/**
 * A few icon colour classes are stored in the demo/seed data (frontend/src/data, backend demo_data.json) and predate
 * the Eko brand palette. They are mapped to brand palette steps when rendered, so the data itself stays unchanged.
 */
const LEGACY: Record<string, string> = {
  'text-amber-500': 'text-amber-400',
  'text-amber-600': 'text-amber-400',
  'text-sky-600': 'text-sky-400',
  'text-indigo-600': 'text-purple-400',
};

export const brandClass = (cls?: string) => cls?.split(/\s+/).map((c) => LEGACY[c] ?? c).join(' ');
