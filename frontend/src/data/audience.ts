import type { AudienceSummary } from '@/types/audience';

/**
 * DEMO DATA — canonical audience summary for @ekoindia, Oct 2024 (Audience Intelligence screen).
 * Dashboard and Campaign Detail snapshots read from this object so the three screens agree.
 * The Audience screen conversion may add further exports to this file; keep `audienceSummary` stable.
 */
export const audienceSummary: AudienceSummary = {
  followers: 86_400,
  followerGrowthPct: 4.2,
  netNewFollowers: 3_490,
  nonFollowerReachPct: 62,
  engagedAudience: 18_400,
  gender: { male: 50, female: 48, unknown: 2 },
  age: [
    { label: '13–17', share: 4, audience: 740, deltaPct: -0.4 },
    { label: '18–24', share: 22, audience: 4050, deltaPct: 1.8, note: 'Students / first-time job' },
    { label: '25–34', share: 38, audience: 6990, deltaPct: 3.4, note: 'Key operator demographic' },
    { label: '35–44', share: 24, audience: 4420, deltaPct: 0.2, note: 'Established retailers' },
    { label: '45–54', share: 8, audience: 1470, deltaPct: -0.5 },
    { label: '55+', share: 4, audience: 740, deltaPct: -0.1 },
  ],
  topStates: [
    { label: 'Uttar Pradesh', share: 34, reach: 48_200, engaged: 2840, leads: 74 },
    { label: 'Haryana', share: 18, reach: 25_500, engaged: 1410, leads: 38 },
    { label: 'Delhi NCR', share: 15, reach: 21_300, engaged: 1120, leads: 31 },
    { label: 'Bihar', share: 11, reach: 15_600, engaged: 840, leads: 24 },
    { label: 'Rajasthan', share: 8, reach: 11_300, engaged: 610, leads: 14 },
    { label: 'Other Regions', share: 14, reach: 19_800, engaged: 820, leads: 5 },
  ],
};
