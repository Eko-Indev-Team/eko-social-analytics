import { lazy, Suspense } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { RequireAuth } from '@/components/layout/RequireAuth';
import NotFoundPage from '@/pages/NotFoundPage';

const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const CampaignsPage = lazy(() => import('@/pages/campaigns/CampaignsPage'));
const CampaignDetailPage = lazy(() => import('@/pages/campaigns/CampaignDetailPage'));
const ContentLibraryPage = lazy(() => import('@/pages/content/ContentLibraryPage'));
const ReelAnalyticsPage = lazy(() => import('@/pages/content/ReelAnalyticsPage'));
const AudiencePage = lazy(() => import('@/pages/AudiencePage'));
const CommentsPage = lazy(() => import('@/pages/CommentsPage'));
const LeadsPage = lazy(() => import('@/pages/LeadsPage'));
const AiInsightsPage = lazy(() => import('@/pages/ai-insights/AiInsightsPage'));
const AiInsightDetailPage = lazy(() => import('@/pages/ai-insights/AiInsightDetailPage'));
const ReportsPage = lazy(() => import('@/pages/reports/ReportsPage'));
const ReportDetailPage = lazy(() => import('@/pages/reports/ReportDetailPage'));
const AccountsPage = lazy(() => import('@/pages/accounts/AccountsPage'));
const ConnectAccountPage = lazy(() => import('@/pages/accounts/ConnectAccountPage'));
const AccountDetailPage = lazy(() => import('@/pages/accounts/AccountDetailPage'));
const LiveAccountDetailPage = lazy(() => import('@/pages/accounts/LiveAccountDetailPage'));
const PublishPage = lazy(() => import('@/pages/instagram/PublishPage'));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage'));
const ActivityLogPage = lazy(() => import('@/pages/ActivityLogPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const AdsDashboardPage = lazy(() => import('@/pages/ads/AdsDashboardPage'));
const AdsLeadsPage = lazy(() => import('@/pages/ads/AdsLeadsPage'));
const AdsPerformancePage = lazy(() => import('@/pages/ads/AdsPerformancePage'));
const AdsExperimentsPage = lazy(() => import('@/pages/ads/AdsExperimentsPage'));
const AdsSignupsPage = lazy(() => import('@/pages/ads/AdsSignupsPage'));
const AdsOverviewPage = lazy(() => import('@/pages/ads/AdsOverviewPage'));
const AdStudioPage = lazy(() => import('@/pages/ads/AdStudioPage'));
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const SignupPage = lazy(() => import('@/pages/auth/SignupPage'));
const AcceptInvitePage = lazy(() => import('@/pages/auth/AcceptInvitePage'));

/** Route table. Each path maps to a screen in design-reference/ (see README "Screen map"). */
export const routes: RouteObject[] = [
  // Public screens. In demo mode sign-in / sign-up are shown read-only (there are no accounts without the API).
  { path: '/login', element: <Suspense fallback={null}><LoginPage /></Suspense> },
  { path: '/signup', element: <Suspense fallback={null}><SignupPage /></Suspense> },
  { path: '/accept-invite', element: <Suspense fallback={null}><AcceptInvitePage /></Suspense> },
  {
    path: '/',
    // Every workspace screen requires a verified session in api mode (demo mode passes straight through).
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'campaigns', element: <CampaignsPage /> },
      { path: 'campaigns/:campaignId', element: <CampaignDetailPage /> },
      { path: 'content', element: <ContentLibraryPage /> },
      { path: 'content/:contentId', element: <ReelAnalyticsPage /> },
      { path: 'audience', element: <AudiencePage /> },
      { path: 'comments', element: <CommentsPage /> },
      { path: 'leads', element: <LeadsPage /> },
      { path: 'ads', element: <AdsDashboardPage /> },
      { path: 'ads/leads', element: <AdsLeadsPage /> },
      { path: 'ads/performance', element: <AdsPerformancePage /> },
      { path: 'ads/experiments', element: <AdsExperimentsPage /> },
      { path: 'ads/signups', element: <AdsSignupsPage /> },
      { path: 'ads/overview', element: <AdsOverviewPage /> },
      { path: 'ads/studio', element: <AdStudioPage /> },
      { path: 'ai-insights', element: <AiInsightsPage /> },
      { path: 'ai-insights/:insightId', element: <AiInsightDetailPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'reports/:reportId', element: <ReportDetailPage /> },
      { path: 'accounts', element: <AccountsPage /> },
      { path: 'accounts/connect', element: <ConnectAccountPage /> },
      { path: 'accounts/live/:connectionId', element: <LiveAccountDetailPage /> },
      { path: 'accounts/:accountId', element: <AccountDetailPage /> },
      { path: 'instagram/publish', element: <PublishPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'activity', element: <ActivityLogPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
