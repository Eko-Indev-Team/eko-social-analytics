import { Pagination, TableShell, Tr } from '@/components/tables/DataTable';
import { Checkbox, Dropdown, MenuItem } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/States';
import { useTable } from '@/hooks/useTable';
import { useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import type { CommentStatus, InstagramComment } from '@/types/comments';
import type { ContentItem, Lead } from '@/types/domain';
import { CommentAvatar, HighlightedText, intentMeta, Pill, potentialMeta, sentimentMeta, sortLabels, statusMeta, type CommentSort } from './commentMeta';

export interface CommentRowActions {
  onSelect: (c: InstagramComment) => void;
  onRespond: (c: InstagramComment) => void;
  onOpenLead: (leadId: string) => void;
  onConvert: (c: InstagramComment) => void;
  onSetStatus: (c: InstagramComment, status: CommentStatus) => void;
  onToggleFlag: (c: InstagramComment) => void;
  onOpenContent: (contentId: string) => void;
}

const th = 'py-2.5 px-3 text-left whitespace-nowrap';
const bulkBtn = 'px-2.5 py-1 rounded-full border border-border-strong bg-surface-card hover:bg-surface-canvas font-semibold flex items-center gap-1';
const rowBtnBase = 'px-2.5 py-1 bg-surface-card border border-border-strong text-label-sm font-semibold rounded-full hover:bg-surface-canvas';
const rowBtn = `${rowBtnBase} text-text-primary`;
const rowBtnMuted = `${rowBtnBase} text-text-secondary`;

/** Comment list: sort, bulk selection, row actions and paging. Search lives in the filter bar. */
export function CommentTable({
  rows,
  selectedId,
  checked,
  onCheckedChange,
  sort,
  onSort,
  leadFor,
  contentById,
  totalComments,
  sampleSize,
  onBulk,
  actions,
  onResetFilters,
}: {
  rows: InstagramComment[];
  selectedId: string | undefined;
  checked: Set<string>;
  onCheckedChange: (next: Set<string>) => void;
  sort: CommentSort;
  onSort: (s: CommentSort) => void;
  leadFor: (c: InstagramComment) => Lead | undefined;
  contentById: Map<string, ContentItem>;
  totalComments: number;
  sampleSize: number;
  onBulk: (status: CommentStatus) => void;
  actions: CommentRowActions;
  onResetFilters: () => void;
}) {
  const t = useT();
  const table = useTable<InstagramComment, 'none'>(rows, { accessors: { none: () => 0 }, pageSize: 5 });
  const pageIds = table.rows.map((r) => r.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => checked.has(id));
  const someOnPage = pageIds.some((id) => checked.has(id));

  const toggle = (id: string, on: boolean) => {
    const next = new Set(checked);
    if (on) next.add(id);
    else next.delete(id);
    onCheckedChange(next);
  };
  const togglePage = (on: boolean) => {
    const next = new Set(checked);
    pageIds.forEach((id) => (on ? next.add(id) : next.delete(id)));
    onCheckedChange(next);
  };

  return (
    <div className="xl:col-span-8 bg-surface-card border border-border-strong rounded-xl shadow-card flex flex-col justify-between overflow-hidden min-w-0 scroll-mt-20" id="comment-triage-table">
      <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-heading text-[1.0625rem] font-semibold text-text-primary">{t('All comments')}</h3>
          <p className="text-body-sm text-text-secondary">
            {t('{shown} of {sample} sample comments ({total} in total)', { shown: table.total, sample: sampleSize, total: totalComments.toLocaleString('en-US') })}
          </p>
        </div>
        <Dropdown
          label={t('Sort comments')}
          trigger={({ toggle: tg, open }) => (
            <button
              type="button"
              onClick={tg}
              aria-expanded={open}
              className="h-8 px-3 text-label-md border border-border-strong rounded-full bg-surface-card hover:bg-surface-canvas flex items-center gap-1 font-semibold text-text-primary"
            >
              <Icon name="sort" className="text-[1rem]" />
              <span>{t('Sort: {by}', { by: t(sortLabels[sort]) })}</span>
            </button>
          )}
        >
          {(close) =>
            (Object.keys(sortLabels) as CommentSort[]).map((s) => (
              <MenuItem key={s} active={s === sort} onClick={() => (close(), onSort(s), table.setPage(1))}>
                {t(sortLabels[s])}
              </MenuItem>
            ))
          }
        </Dropdown>
      </div>

      {checked.size > 0 && (
        <div className="px-5 py-2 border-y border-border-strong bg-surface-canvas flex flex-wrap items-center gap-2 text-label-md" role="region" aria-label={t('Bulk actions')}>
          <span className="font-semibold text-text-primary">{t('{count} selected', { count: checked.size })}</span>
          <button type="button" onClick={() => onBulk('reviewed')} className={bulkBtn}>
            <Icon name="done_all" className="text-[0.875rem]" /> {t('Mark reviewed')}
          </button>
          <button type="button" onClick={() => onBulk('responded')} className={bulkBtn}>
            <Icon name="check" className="text-[0.875rem]" /> {t('Mark replied')}
          </button>
          <button type="button" onClick={() => onBulk('archived')} className={bulkBtn}>
            <Icon name="archive" className="text-[0.875rem]" /> {t('Archive')}
          </button>
          <button type="button" onClick={() => onCheckedChange(new Set())} className="ml-auto text-text-secondary hover:text-text-primary">
            {t('Clear selection')}
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon="forum"
            title={t('No comments found')}
            description={t('Nothing matches these filters.')}
            action={
              <button type="button" onClick={onResetFilters} className="text-primary hover:underline font-semibold text-label-md">
                {t('Reset filters')}
              </button>
            }
          />
        </div>
      ) : (
        <TableShell>
          <thead>
            <tr className="text-text-secondary text-label-sm font-semibold border-y border-border-strong">
              <th className="py-2.5 px-3 w-8">
                <Checkbox checked={allOnPage} indeterminate={!allOnPage && someOnPage} onChange={togglePage} label={t('Select all comments on this page')} />
              </th>
              <th className={th}>{t('Person')}</th>
              <th className={cn(th, 'px-4 min-w-[18rem]')}>{t('Comment')}</th>
              <th className={th}>{t('Feeling')}</th>
              <th className={th}>{t('Topic')}</th>
              <th className={th}>{t('Status')}</th>
              <th className={cn(th, 'text-right')}>{t('Actions')}</th>
            </tr>
          </thead>
          <tbody className="text-body-sm">
            {table.rows.map((c) => {
              const selected = c.id === selectedId;
              const lead = leadFor(c);
              const content = contentById.get(c.contentId);
              const leadId = c.leadId ?? (c.status === 'lead_created' ? lead?.id : undefined);
              return (
                <Tr
                  key={c.id}
                  onClick={() => actions.onSelect(c)}
                  selected={selected}
                  label={t('Comment by {name}', { name: c.authorName })}
                  className={cn('border-b border-border-subtle', selected && 'bg-surface-container-low/50 shadow-[inset_4px_0_0_var(--eko-gold)]')}
                >
                  <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={checked.has(c.id)} onChange={(on) => toggle(c.id, on)} label={t('Select comment by {name}', { name: c.authorName })} />
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <CommentAvatar comment={c} />
                      <div className="min-w-0">
                        <div className="font-semibold text-text-primary text-label-md truncate max-w-[120px] flex items-center gap-1">
                          {c.authorName}
                          {c.flagged && <Icon name="flag" filled className="text-[0.8125rem] text-error" label={t('Flagged')} />}
                        </div>
                        <div className="text-text-tertiary text-[0.75rem]">@{c.handle}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 max-w-[22rem]">
                    <p className={cn('text-text-primary line-clamp-2 whitespace-normal', selected && 'font-medium')}>
                      <HighlightedText
                        text={c.text}
                        highlights={c.highlights}
                        markClassName={c.intent === 'eligibility' ? 'bg-ai-subtle px-1 py-0.5 rounded text-ai-accent' : 'bg-primary-container/30 px-1 py-0.5 rounded text-primary'}
                      />
                    </p>
                    <span className="text-[0.75rem] text-text-tertiary mt-0.5 flex items-center gap-1 min-w-0" title={content?.title}>
                      <Icon name={content?.type === 'reel' ? 'smart_display' : content?.type === 'carousel' ? 'view_carousel' : 'image'} className="text-[0.875rem] shrink-0" />
                      <span className="truncate">
                        {content?.title ?? c.contentId} · {c.receivedLabel}
                      </span>
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    <Pill className={cn('font-semibold', sentimentMeta[c.sentiment].pill)}>{t(sentimentMeta[c.sentiment].label)}</Pill>
                  </td>
                  <td className="py-3 px-2">
                    <div className="flex flex-col items-start gap-1">
                      <Pill className={intentMeta[c.intent].pill}>{t(intentMeta[c.intent].short)}</Pill>
                      {c.leadPotential === 'high' && (
                        <Pill className={potentialMeta.high.pill}>
                          <Icon name="star" className="text-[0.75rem]" />
                          {t('Likely lead')}
                        </Pill>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <Pill className={statusMeta[c.status].pill}>{t(statusMeta[c.status].label)}</Pill>
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-1">
                      {leadId ? (
                        <button type="button" onClick={() => actions.onOpenLead(leadId)} className={rowBtn}>
                          {t('View lead')}
                        </button>
                      ) : c.status === 'needs_response' ? (
                        <button
                          type="button"
                          onClick={() => actions.onRespond(c)}
                          className={cn(
                            'px-2.5 py-1 text-label-sm font-semibold rounded-full',
                            c.leadPotential === 'high' ? 'bg-primary-container text-on-primary-container hover:bg-brand-primary-hover' : 'bg-surface-card border border-border-strong text-text-primary hover:bg-surface-canvas',
                          )}
                        >
                          {t('Reply')}
                        </button>
                      ) : (
                        <button type="button" onClick={() => actions.onSelect(c)} className={rowBtnMuted}>
                          {t('View')}
                        </button>
                      )}
                      <Dropdown
                        label={t('More actions for {name}', { name: c.authorName })}
                        trigger={({ toggle: tg, open }) => (
                          <button type="button" onClick={tg} aria-expanded={open} aria-label={t('More actions for comment by {name}', { name: c.authorName })} className="p-1 text-text-secondary hover:text-text-primary rounded">
                            <Icon name="more_vert" className="text-[1.125rem]" />
                          </button>
                        )}
                      >
                        {(close) => (
                          <>
                            {c.status !== 'reviewed' && c.status !== 'archived' && (
                              <MenuItem icon="done_all" onClick={() => (close(), actions.onSetStatus(c, 'reviewed'))}>
                                {t('Mark reviewed')}
                              </MenuItem>
                            )}
                            <MenuItem icon="flag" onClick={() => (close(), actions.onToggleFlag(c))}>
                              {c.flagged ? t('Remove flag') : t('Flag for follow-up')}
                            </MenuItem>
                            {lead ? (
                              <MenuItem icon="contact_page" onClick={() => (close(), actions.onOpenLead(lead.id))}>
                                {t('Open lead')}
                              </MenuItem>
                            ) : (
                              <MenuItem icon="star" onClick={() => (close(), actions.onConvert(c))}>
                                {t('Make a lead')}
                              </MenuItem>
                            )}
                            <MenuItem icon="smart_display" onClick={() => (close(), actions.onOpenContent(c.contentId))}>
                              {t('Open post')}
                            </MenuItem>
                            {c.status === 'archived' ? (
                              <MenuItem icon="unarchive" onClick={() => (close(), actions.onSetStatus(c, 'needs_response'))}>
                                {t('Move back to list')}
                              </MenuItem>
                            ) : (
                              <MenuItem icon="archive" danger onClick={() => (close(), actions.onSetStatus(c, 'archived'))}>
                                {t('Archive')}
                              </MenuItem>
                            )}
                          </>
                        )}
                      </Dropdown>
                    </div>
                  </td>
                </Tr>
              );
            })}
          </tbody>
        </TableShell>
      )}
      <Pagination
        page={table.page}
        pageCount={table.pageCount}
        onPage={table.setPage}
        rangeStart={table.rangeStart}
        rangeEnd={table.rangeEnd}
        total={table.total}
        pageSize={table.pageSize}
        onPageSize={table.setPageSize}
        pageSizes={[5, 10, 25]}
      />
    </div>
  );
}
