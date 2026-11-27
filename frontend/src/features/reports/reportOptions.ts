import { msg } from '@/i18n/I18nContext';
import type { ReportConfig, ReportFormat, ReportMetricKey, ReportSchedule, ReportSectionKey, ReportStatus, ReportType } from '@/types/reports';

/** Static UI copy / option lists for the Reports screens. Labels are English source text (msg-marked): translate with t() where rendered. */

export const reportTypeOptions: Array<{ value: ReportType; label: string; short: string }> = [
  { value: 'campaign_performance', label: msg('Campaign results'), short: msg('Campaign results') },
  { value: 'content_reel', label: msg('Posts and Reels'), short: msg('Posts and Reels') },
  { value: 'audience', label: msg('Audience'), short: msg('Audience') },
  { value: 'comments_sentiment', label: msg('Comments'), short: msg('Comments') },
  { value: 'lead_generation', label: msg('Leads'), short: msg('Leads') },
  { value: 'executive_summary', label: msg('Summary'), short: msg('Summary') },
];

export const reportTypeLabel = (t: ReportType) => reportTypeOptions.find((o) => o.value === t)!.short;

export const reportStatusMeta: Record<ReportStatus, { label: string; filterLabel: string }> = {
  ready: { label: msg('Ready'), filterLabel: msg('Ready') },
  ready_demo: { label: msg('Ready (sample)'), filterLabel: msg('Ready (sample)') },
  generating: { label: msg('Creating'), filterLabel: msg('Creating') },
  scheduled: { label: msg('Scheduled'), filterLabel: msg('Scheduled') },
  failed: { label: msg('Failed'), filterLabel: msg('Failed') },
  archived: { label: msg('Archived'), filterLabel: msg('Archived') },
};

export const metricOptions: Array<{ value: ReportMetricKey; label: string }> = [
  { value: 'views', label: msg('Views') },
  { value: 'reach', label: msg('People reached') },
  { value: 'engagement', label: msg('Engagement') },
  { value: 'watchTime', label: msg('Watch time') },
  { value: 'comments', label: msg('Comments') },
  { value: 'leads', label: msg('Leads and cost per lead') },
];

export const sectionOptions: Array<{ value: ReportSectionKey; label: string }> = [
  { value: 'summary', label: msg('AI summary') },
  { value: 'kpis', label: msg('Key numbers') },
  { value: 'timeline', label: msg('Trend vs last month') },
  { value: 'formats', label: msg('Best post types') },
  { value: 'campaigns', label: msg('Campaign table') },
  { value: 'creatives', label: msg('Top posts') },
  { value: 'audience', label: msg('Audience and places') },
  { value: 'recommendations', label: msg('AI tips') },
];

export const formatOptions: Array<{ value: ReportFormat; label: string }> = [
  { value: 'pdf', label: msg('PDF summary') },
  { value: 'csv', label: msg('CSV data file') },
];

export const scheduleOptions: Array<{ value: ReportSchedule; label: string }> = [
  { value: 'none', label: msg('Once (create now)') },
  { value: 'weekly', label: msg('Every Monday, 9:00 AM IST') },
  { value: 'monthly', label: msg('Monthly on the 1st, 9:00 AM IST') },
];

/** Demo reporting window: Oct 1–31, 2024. */
export const DEMO_WINDOW = { start: '2024-10-01', end: '2024-10-31' } as const;

export const datePresets: Array<{ value: string; label: string; period?: ReportConfig['period'] }> = [
  { value: 'oct', label: msg('Oct 1 – Oct 31, 2024'), period: { start: '2024-10-01', end: '2024-10-31' } },
  { value: 'last7', label: msg('Last 7 days (Oct 25 – 31)'), period: { start: '2024-10-25', end: '2024-10-31' } },
  { value: 'first-half', label: msg('First half (Oct 1 – 15)'), period: { start: '2024-10-01', end: '2024-10-15' } },
  { value: 'custom', label: msg('Custom dates…') },
];

export const defaultSections: Record<ReportType, ReportSectionKey[]> = {
  campaign_performance: ['summary', 'kpis', 'timeline', 'formats', 'campaigns', 'creatives', 'recommendations'],
  content_reel: ['summary', 'kpis', 'formats', 'creatives', 'recommendations'],
  audience: ['summary', 'kpis', 'audience', 'campaigns'],
  comments_sentiment: ['summary', 'kpis', 'campaigns', 'creatives', 'recommendations'],
  lead_generation: ['summary', 'kpis', 'campaigns', 'creatives'],
  executive_summary: ['summary', 'kpis', 'timeline', 'formats', 'campaigns', 'audience', 'recommendations'],
};

/** Account-wide report types include organic content (scope "account"). */
export const accountScopedTypes: ReportType[] = ['executive_summary', 'audience', 'comments_sentiment'];

/** Strips a report (or list item) down to the fields the configuration form edits. */
export function pickConfig(r: ReportConfig): ReportConfig {
  return {
    title: r.title,
    type: r.type,
    scope: r.scope,
    accountId: r.accountId,
    campaignIds: [...r.campaignIds],
    contentIds: r.contentIds ? [...r.contentIds] : undefined,
    period: { ...r.period },
    metrics: [...r.metrics],
    sections: [...r.sections],
    compareBaseline: r.compareBaseline,
    formats: [...r.formats],
    schedule: r.schedule,
    recipients: [...r.recipients],
  };
}

export function blankConfig(overrides: Partial<ReportConfig> = {}): ReportConfig {
  return {
    title: 'SBI CSP Recruitment Campaign Report - Final Q3',
    type: 'campaign_performance',
    scope: 'campaigns',
    accountId: 'acc-ekoindia',
    campaignIds: ['sbi-csp-october', 'sbi-csp-mitra-recruitment'],
    period: { ...DEMO_WINDOW },
    metrics: ['views', 'reach', 'engagement', 'comments', 'leads'],
    sections: defaultSections.campaign_performance,
    compareBaseline: true,
    formats: ['pdf', 'csv'],
    schedule: 'none',
    recipients: [],
    ...overrides,
  };
}
