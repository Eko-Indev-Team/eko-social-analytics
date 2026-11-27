import { demoExperiments, demoOverview, demoPerformance, demoSignups, demoSignupsOut } from '@/data/adsReports';
import { fromSource } from '@/lib/api/source';
import type { ExperimentsOut, OverviewOut, PerformanceOut, SignupFilters, SignupsOut } from '@/types/adsReports';

function signupQuery(filters: SignupFilters): string {
  const params = new URLSearchParams();
  if (filters.tier) params.set('tier', filters.tier);
  if (filters.verdict) params.set('verdict', filters.verdict);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/** Ads reports: Performance, Experiments, Website signups and the two-channel Overview (read only). */
export const adsReportsService = {
  performance: () => fromSource<PerformanceOut>(() => demoPerformance, '/ads/performance'),

  experiments: () => fromSource<ExperimentsOut>(() => demoExperiments, '/ads/experiments'),

  signups: (filters: SignupFilters = {}) =>
    fromSource<SignupsOut>(() => {
      const verdict = filters.verdict ? filters.verdict.trim().toUpperCase().replace(/\s+/g, '_') : null;
      const signups = demoSignups.filter(
        (s) => (!filters.tier || s.attributionTier === filters.tier) && (!verdict || s.qualificationVerdict === verdict),
      );
      return { ...demoSignupsOut(), tier: filters.tier ?? null, verdict, signups };
    }, `/ads/signups${signupQuery(filters)}`),

  overview: () => fromSource<OverviewOut>(() => demoOverview, '/ads/overview'),
};
