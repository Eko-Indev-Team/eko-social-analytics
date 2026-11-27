import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isDemoMode } from '@/lib/config';
import { Drawer } from '@/components/ui/Overlay';
import { useToast } from '@/components/ui/Toast';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useQuery } from '@/hooks/useQuery';
import { useT } from '@/i18n/I18nContext';
import { accountService } from '@/services/accounts';
import { campaignService } from '@/services/campaigns';
import { commentsService } from '@/services/comments';
import { contentService } from '@/services/content';
import { leadService } from '@/services/leads';
import type { CommentIntent, CommentStatus, InstagramComment } from '@/types/comments';
import type { Lead } from '@/types/domain';
import { CommentAiRow } from '@/features/comments/CommentAiRow';
import { CommentDetailBody, CommentDetailFooter, CommentDetailPanel, type DetailPanelProps } from '@/features/comments/CommentDetailPanel';
import { CommentFilterBar } from '@/features/comments/CommentFilterBar';
import { CommentInsightPanels } from '@/features/comments/CommentInsightPanels';
import { CommentKpiStrip } from '@/features/comments/CommentKpiStrip';
import { CommentsHeader } from '@/features/comments/CommentsHeader';
import { CommentsEmpty, CommentsErrorBanner, CommentsSkeleton, useMediaQuery } from '@/features/comments/CommentsStates';
import { CommentTable } from '@/features/comments/CommentTable';
import { IntentMatrix } from '@/features/comments/IntentMatrix';
import { SentimentPanel } from '@/features/comments/SentimentPanel';
import { defaultFilters, filterComments, sortComments, type CommentFilters, type CommentSort } from '@/features/comments/commentMeta';
import { useCommentActions } from '@/features/comments/useCommentActions';

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the textarea fallback */
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  ta.remove();
  return ok;
}

function downloadCsv(rows: InstagramComment[], contentTitle: (id: string) => string) {
  const header = ['id', 'author', 'handle', 'comment', 'content', 'sentiment', 'intent', 'lead_potential', 'intent_score', 'status', 'received_at'];
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = rows.map((c) => [c.ref, c.authorName, `@${c.handle}`, c.text, contentTitle(c.contentId), c.sentiment, c.intent, c.leadPotential, c.intentScore, c.status, c.receivedAt].map(esc).join(','));
  const csv = [`# DEMO DATA - sample comments exported from Eko SocialBoard prototype`, header.join(','), ...lines].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'eko-comments-sample-demo.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function CommentsPage() {
  const t = useT();
  useDocumentTitle(t('Comments'));
  const toast = useToast();
  const navigate = useNavigate();
  const isXl = useMediaQuery('(min-width: 1280px)');

  const summaryQ = useQuery('comments:summary', commentsService.summary);
  const trendQ = useQuery('comments:sentiment-trend', commentsService.sentimentTrend);
  const listQ = useQuery('comments:list', commentsService.list);
  const campaignsQ = useQuery('campaigns:list', campaignService.list);
  const contentQ = useQuery('content:list', contentService.list);
  const leadsQ = useQuery('leads:list', leadService.list);
  const accountsQ = useQuery('accounts:list', accountService.list);

  const actions = useCommentActions();
  const [filters, setFilters] = useState<CommentFilters>(defaultFilters);
  const [sort, setSort] = useState<CommentSort>('priority');
  const [selectedId, setSelectedId] = useState<string>();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createdLeads, setCreatedLeads] = useState<Record<string, Lead>>({});
  const replyRef = useRef<HTMLDivElement>(null);
  const drawerReplyRef = useRef<HTMLDivElement>(null);

  const content = useMemo(() => contentQ.data ?? [], [contentQ.data]);
  const campaigns = useMemo(() => campaignsQ.data ?? [], [campaignsQ.data]);
  const contentById = useMemo(() => new Map(content.map((c) => [c.id, c])), [content]);
  const leadByHandle = useMemo(() => new Map((leadsQ.data ?? []).map((l) => [l.handle.toLowerCase(), l])), [leadsQ.data]);
  const contentTitle = (id: string) => contentById.get(id)?.title ?? id;

  const allComments = useMemo(() => listQ.data?.items ?? [], [listQ.data]);
  const visible = useMemo(
    () => sortComments(filterComments(allComments, filters, (id) => contentById.get(id)?.title ?? id), sort),
    [allComments, filters, sort, contentById],
  );
  const selected = allComments.find((c) => c.id === selectedId) ?? visible[0];

  const leadFor = (c: InstagramComment) => leadByHandle.get(c.handle.toLowerCase());

  const scrollToTable = () => document.getElementById('comment-triage-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const applyFilters = (patch: Partial<CommentFilters>, scroll = true) => {
    setFilters({ ...defaultFilters, search: filters.search, ...patch });
    setSelectedId(undefined);
    if (scroll) scrollToTable();
  };

  const select = (c: InstagramComment) => {
    setSelectedId(c.id);
    if (!isXl) setDrawerOpen(true);
  };
  const respond = (c: InstagramComment) => {
    select(c);
    window.setTimeout(() => {
      const el = isXl ? replyRef.current : drawerReplyRef.current;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.focus({ preventScroll: true });
    }, 60);
  };

  const convert = async (c: InstagramComment) => {
    const lead = await actions.convertToLead(c, c.leadId ? undefined : leadFor(c));
    if (lead) setCreatedLeads((m) => ({ ...m, [c.id]: lead }));
  };

  const bulk = async (status: CommentStatus) => {
    const ids = [...checked];
    if (ids.length === 0) return;
    await actions.bulkSetStatus(ids, status);
    setChecked(new Set());
  };

  const startTriage = () => {
    const queue = sortComments(allComments.filter((c) => c.status === 'needs_response'), 'priority');
    setFilters({ ...defaultFilters, status: 'needs_response' });
    setSort('priority');
    if (queue[0]) select(queue[0]);
    scrollToTable();
    toast({ tone: 'info', title: t('Most important first'), description: t('{count} comments need a reply. The most important is open.', { count: queue.length }) });
  };

  const exportCsv = () => {
    downloadCsv(visible, contentTitle);
    toast({ tone: 'demo', title: t('CSV downloaded'), description: t('{count} sample comments that match your filters.', { count: visible.length }) });
  };

  const detailProps = (c: InstagramComment): DetailPanelProps => ({
    comment: c,
    content: contentById.get(c.contentId),
    campaign: campaigns.find((x) => x.id === c.campaignId),
    existingLead: leadFor(c),
    createdLead: createdLeads[c.id],
    busy: actions.isPending,
    converting: actions.isConverting,
    onCopyReply: async () => {
      const ok = await copyText(c.suggestedReply);
      toast(
        ok
          ? { tone: 'success', title: t('Reply copied'), description: t('Paste it as a reply in the Instagram app. SocialBoard does not post replies.') }
          : { tone: 'error', title: t('Could not copy'), description: t('Select the text and copy it by hand.') },
      );
    },
    onMarkResponded: () => actions.setStatus(c, 'responded'),
    onMarkReviewed: () => actions.setStatus(c, 'reviewed'),
    onToggleFlag: () => actions.toggleFlag(c),
    onConvert: () => convert(c),
    onDismiss: () => actions.setStatus(c, 'archived'),
    onOpenLead: actions.openLead,
  });

  const header = (
    <div className="space-y-4">
      <CommentsHeader selectedCount={checked.size} onBulkStatus={bulk} onExport={exportCsv} onStartTriage={startTriage} />
      {!isDemoMode && <CommentAiRow />}
    </div>
  );

  if (summaryQ.status === 'loading' || listQ.status === 'loading') {
    return (
      <div className="pb-12">
        {header}
        <CommentsSkeleton />
      </div>
    );
  }
  if (summaryQ.status === 'error' || listQ.status === 'error') {
    return (
      <div className="pb-12">
        <CommentsErrorBanner error={summaryQ.error ?? listQ.error} onRetry={() => (summaryQ.refetch(), listQ.refetch())} />
        {header}
      </div>
    );
  }
  if (!summaryQ.data || !listQ.data) {
    return (
      <div className="pb-12">
        {header}
        <CommentsEmpty onReset={() => setFilters(defaultFilters)} />
      </div>
    );
  }

  const summary = summaryQ.data;

  return (
    <div className="pb-12 space-y-6">
      {header}
      <CommentFilterBar
        filters={filters}
        onChange={(f) => (setFilters(f), setSelectedId(undefined))}
        summary={summary}
        campaigns={campaigns}
        content={content}
        accounts={accountsQ.data ?? []}
        matching={visible.length}
        sampleSize={listQ.data.sampleSize}
      />
      <CommentKpiStrip summary={summary} onShowAwaiting={() => applyFilters({ status: 'needs_response' })} onShowLeads={() => applyFilters({ potential: 'high' })} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <SentimentPanel summary={summary} trend={trendQ.data} onDeepDive={() => applyFilters({ sentiment: 'positive' })} />
        <IntentMatrix
          summary={summary}
          activeIntent={filters.intent}
          onSelect={(intent: CommentIntent) => applyFilters(filters.intent === intent ? {} : { intent })}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <CommentTable
          rows={visible}
          selectedId={selected?.id}
          checked={checked}
          onCheckedChange={setChecked}
          sort={sort}
          onSort={setSort}
          leadFor={leadFor}
          contentById={contentById}
          totalComments={summary.totalComments}
          sampleSize={listQ.data.sampleSize}
          onBulk={bulk}
          onResetFilters={() => setFilters(defaultFilters)}
          actions={{
            onSelect: select,
            onRespond: respond,
            onOpenLead: actions.openLead,
            onConvert: convert,
            onSetStatus: actions.setStatus,
            onToggleFlag: actions.toggleFlag,
            onOpenContent: (id) => navigate(`/content/${id}`),
          }}
        />
        {selected ? (
          <CommentDetailPanel ref={replyRef} {...detailProps(selected)} />
        ) : (
          <div className="hidden xl:flex xl:col-span-4 bg-surface-card border border-dashed border-border-strong rounded-xl items-center justify-center p-6 text-center text-body-sm text-text-secondary">
            {t('Pick a comment to see the AI read and make it a lead.')}
          </div>
        )}
      </div>

      <CommentInsightPanels
        summary={summary}
        content={content}
        campaigns={campaigns}
        onStartTriage={startTriage}
        onQueueBucket={(intent) =>
          applyFilters(intent === 'application' || intent === 'eligibility' ? { status: 'needs_response', intent: intent as CommentIntent } : { status: 'needs_response' })
        }
      />

      <p className="text-label-sm text-text-tertiary flex items-center gap-1.5">
        {t('Sample data, not from Instagram. The list shows a sample of {count} comments, as of Oct 31, 2024.', { count: summary.totalComments.toLocaleString('en-US') })}
      </p>

      {!isXl && selected && (
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={t('Comment')}
          subtitle={`#${selected.ref}`}
          footer={<CommentDetailFooter {...detailProps(selected)} />}
        >
          <CommentDetailBody ref={drawerReplyRef} {...detailProps(selected)} />
        </Drawer>
      )}
    </div>
  );
}
