import { demoServicePincodes } from '@/data/ads';
import { leadPipelineSummary, leads, octoberLeadChannels, octoberLeadFunnel } from '@/data/leads';
import { fromSource, mutateSource, NotFoundError } from '@/lib/api/source';
import { parseEducation, qualifyLead } from '@/lib/qualification';
import type { Lead, LeadCreateResult, LeadDetailsPatch, LeadQualificationPatch, LeadStatus } from '@/types/domain';

const store: Lead[] = structuredClone(leads);

/** Demo-mode copy of the backend's `requalify_lead`. */
function requalifyDemo(lead: Lead) {
  const edu = parseEducation(lead.educationAnswer);
  if (edu.level) lead.educationLevel = edu.level;
  else delete lead.educationLevel;
  if (edu.ok === null) delete lead.educationOk;
  else lead.educationOk = edu.ok;
  if (lead.pincode === undefined && lead.educationAnswer === undefined && lead.canInvest === undefined && lead.esafResponse === undefined) {
    delete lead.qualificationStatus;
    delete lead.sbiReasons;
    return;
  }
  const pincodeMatch = lead.pincode ? demoServicePincodes.has(lead.pincode) : null;
  const { status, reasons } = qualifyLead(pincodeMatch, edu.ok, lead.canInvest ?? null, lead.esafResponse ?? null);
  lead.qualificationStatus = status;
  lead.sbiReasons = reasons;
}

/** A few demo leads start with qualification answers so every status is visible in demo mode. */
const DEMO_QUALIFICATION: Array<Pick<Lead, 'pincode' | 'educationAnswer' | 'canInvest' | 'esafResponse'>> = [
  { pincode: '273001', educationAnswer: 'Graduate', canInvest: true },
  { pincode: '560010', educationAnswer: '12th pass', canInvest: true },
  { pincode: '842001', educationAnswer: 'BA', canInvest: false, esafResponse: 'yes' },
  { pincode: '273151', educationAnswer: '10th', canInvest: true },
  { educationAnswer: 'Intermediate' },
];
DEMO_QUALIFICATION.forEach((q, i) => {
  if (!store[i]) return;
  Object.assign(store[i], q);
  requalifyDemo(store[i]);
});

export const leadService = {
  list: () => fromSource(() => store, '/leads'),

  listByCampaign: (campaignId: string) =>
    fromSource(() => store.filter((l) => l.campaignId === campaignId), `/campaigns/${campaignId}/leads`),

  summary: () => fromSource(() => leadPipelineSummary, '/leads/summary'),

  campaignFunnel: (campaignId: string) =>
    fromSource(
      () => (campaignId === 'sbi-csp-october' ? { funnel: octoberLeadFunnel, channels: octoberLeadChannels } : null),
      `/campaigns/${campaignId}/leads/funnel`,
    ),

  updateStatus: (id: string, status: LeadStatus) =>
    mutateSource(
      () => {
        const found = store.find((l) => l.id === id);
        if (!found) throw new NotFoundError('Lead', id);
        found.status = status;
        found.lastContact = 'Just now';
        return found;
      },
      { method: 'patch', path: `/leads/${id}`, body: { status } },
    ),

  /** Saves editable details (outreach notes, name, location, phone). */
  updateDetails: (id: string, patch: LeadDetailsPatch) =>
    mutateSource(
      () => {
        const found = store.find((l) => l.id === id);
        if (!found) throw new NotFoundError('Lead', id);
        const notes = patch.notes === undefined ? found.notes : patch.notes.trim() || undefined;
        Object.assign(found, patch, { notes });
        return found;
      },
      { method: 'patch', path: `/leads/${id}`, body: patch },
    ),

  /**
   * Saves qualification answers (pincode, education, can invest, ESAF answer). The status is recomputed by the API,
   * or in demo mode with the same rule (lib/qualification) against the demo SBI pincodes.
   */
  updateQualification: (id: string, patch: LeadQualificationPatch) =>
    mutateSource(
      () => {
        const found = store.find((l) => l.id === id);
        if (!found) throw new NotFoundError('Lead', id);
        for (const [key, value] of Object.entries(patch) as Array<[keyof LeadQualificationPatch, unknown]>) {
          if (value === null || value === undefined || value === '') delete found[key];
          else Object.assign(found, { [key]: value });
        }
        requalifyDemo(found);
        return found;
      },
      { method: 'patch', path: `/leads/${id}`, body: patch },
    ),

  /**
   * Creates a lead from a classified comment (Reel Analytics → "Assign to CRM"). Returns the existing
   * lead with `created: false` when the handle is already in the pipeline (case-insensitive).
   */
  createFromComment: (input: Omit<Lead, 'id' | 'status' | 'lastContact'>) =>
    mutateSource<LeadCreateResult>(
      () => {
        const existing = store.find((l) => l.handle.toLowerCase() === input.handle.toLowerCase());
        if (existing) return { lead: existing, created: false };
        const lead: Lead = { ...input, id: `lead-local-${Date.now().toString(36)}`, status: 'new', lastContact: 'Just now' };
        store.unshift(lead);
        return { lead, created: true };
      },
      { method: 'post', path: '/leads', body: input },
    ),
};
