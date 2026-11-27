import { useNavigate } from 'react-router-dom';
import { LeadStatusBadge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Misc';
import { Skeleton } from '@/components/ui/States';
import { TableShell, Td, Th, Tr } from '@/components/tables/DataTable';
import type { QueryResult } from '@/hooks/useQuery';
import { msg, useT } from '@/i18n/I18nContext';
import { cn } from '@/lib/format';
import type { Campaign, Lead, LeadSource } from '@/types/domain';
import { SectionCard, UnavailableNote } from './SectionCard';

const sourceLabel: Record<LeadSource, string> = { comment: msg('Comment'), dm: msg('Message'), bio_link: msg('Bio link'), profile_visit: msg('Profile visit') };

/** Leads tab: the campaign's leads from `leadService.listByCampaign`; rows open the lead drawer on /leads. */
export function CampaignLeadsList({ campaign, query }: { campaign: Campaign; query: QueryResult<Lead[]> }) {
  const t = useT();
  const navigate = useNavigate();
  const leads = [...(query.data ?? [])].sort((a, b) => b.score - a.score);
  const total = campaign.metrics?.leads;
  return (
    <SectionCard
      icon="person_search"
      iconClassName="bg-amber-400/15 text-amber-400"
      title={t('Leads')}
      subtitle={query.status === 'success' && total !== undefined ? t('Showing {shown} of {total} (sample data)', { shown: leads.length, total }) : undefined}
      link={{ to: '/leads', label: t('All leads') }}
    >
      {query.status === 'loading' ? (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : query.status === 'error' ? (
        <UnavailableNote icon="warning">
          {t('Could not load the leads.')} {query.error?.message}
        </UnavailableNote>
      ) : leads.length === 0 ? (
        <UnavailableNote icon="contact_page">{campaign.metrics ? t('No single leads for this campaign in the sample data.') : t('Numbers show up after it starts.')}</UnavailableNote>
      ) : (
        <div className="mt-4 -mx-5 -mb-5 border-t border-border-strong">
          <TableShell>
            <thead>
              <tr>
                <Th>{t('Lead')}</Th>
                <Th align="right">{t('Score')}</Th>
                <Th>{t('Status')}</Th>
                <Th>{t('From')}</Th>
                <Th>{t('Last contact')}</Th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <Tr key={l.id} onClick={() => navigate(`/leads?lead=${l.id}`)} label={t('Open lead {name}', { name: l.name })}>
                  <Td>
                    <div className="flex items-center gap-2.5 min-w-[200px]">
                      <Avatar name={l.name} size="sm" />
                      <div className="min-w-0">
                        <div className="font-semibold text-text-primary">{l.name}</div>
                        <div className="text-[0.75rem] text-text-tertiary">
                          @{l.handle} · {l.location}
                        </div>
                      </div>
                    </div>
                  </Td>
                  <Td align="right" className={cn('font-bold', l.score >= 90 ? 'text-status-active' : 'text-text-primary')}>
                    {l.score}
                  </Td>
                  <Td>
                    <LeadStatusBadge status={l.status} />
                  </Td>
                  <Td className="text-text-secondary whitespace-nowrap">{t(sourceLabel[l.source])}</Td>
                  <Td className="text-text-secondary whitespace-nowrap">{l.lastContact}</Td>
                </Tr>
              ))}
            </tbody>
          </TableShell>
        </div>
      )}
    </SectionCard>
  );
}
