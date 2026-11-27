/**
 * Lead qualification (product-owner rules of 2026-11-18). A TypeScript port of the backend's
 * `app/services/qualification.py` — the API is the source of truth; this copy is used in demo mode only.
 *
 * Inputs are true / false / null (unknown):
 * - pincodeMatch: the lead's pincode is in the SBI service pincodes;
 * - educationOk:  highest education ≥ 12th / Intermediate (`parseEducation`);
 * - canInvest:    answered yes to the investment question;
 * - esafResponse: 'yes' / 'no' / null (ESAF not pitched yet).
 */

export type QualificationStatus = 'sbi_strong' | 'esaf_strong' | 'esaf_pitch' | 'needs_info' | 'not_qualified';
export type SbiReason =
  | 'pincode_mismatch'
  | 'pincode_unknown'
  | 'education_below_12th'
  | 'education_unknown'
  | 'cannot_invest'
  | 'investment_unknown';
export type EsafResponse = 'yes' | 'no' | null;

export const QUALIFICATION_STATUSES: readonly QualificationStatus[] = ['sbi_strong', 'esaf_strong', 'esaf_pitch', 'needs_info', 'not_qualified'];
export const QUALIFIED_STATUSES: ReadonlySet<QualificationStatus> = new Set(['sbi_strong', 'esaf_strong']);

export const isQualified = (status: QualificationStatus | null | undefined) => !!status && QUALIFIED_STATUSES.has(status);

const LEVELS: Array<{ rank: number; label: string; ok: boolean; pattern: RegExp }> = [
  { rank: 0, label: 'Below 10th', ok: false, pattern: /\b(?:8th|9th|below\s*10(?:th)?|no\s+education|illiterate|uneducated)\b|अनपढ़/ },
  { rank: 1, label: '10th', ok: false, pattern: /\b(?:10th|10|matric|matriculation|high\s+school|ssc)\b|10वीं|दसवीं/ },
  {
    rank: 2,
    label: '12th / Intermediate',
    ok: true,
    pattern: /\b(?:12th|12|intermediate|inter|hsc|higher\s+secondary|senior\s+secondary)\b|(?<![\w+])\+\s?2(?!\d)|10\s?\+\s?2|12वीं|इंटर/,
  },
  {
    rank: 3,
    label: 'Graduate',
    ok: true,
    pattern: /\b(?:graduate|graduation|degree|ba|b\.\s?a|bsc|b\.\s?sc|bcom|b\.\s?com|bba|bca|b\.?\s?tech|btech|engineering)\b|स्नातक/,
  },
  {
    rank: 4,
    label: 'Post graduate',
    ok: true,
    pattern: /\b(?:post\s*graduate|post\s*graduation|pg|ma|m\.\s?a|msc|m\.\s?sc|mcom|m\.\s?com|mba|mca|m\.?\s?tech|mtech)\b|स्नातकोत्तर/,
  },
  { rank: 5, label: 'PhD', ok: true, pattern: /\b(?:phd|ph\.\s?d|doctorate)\b/ },
];

/** Answer text → { level, ok }. The highest level mentioned wins. Unrecognised or blank (e.g. "diploma") → nulls. */
export function parseEducation(text: string | null | undefined): { level: string | null; ok: boolean | null } {
  if (!text || !text.trim()) return { level: null, ok: null };
  const value = text.trim().toLowerCase();
  let best: (typeof LEVELS)[number] | null = null;
  for (const lvl of LEVELS) if (lvl.pattern.test(value) && (!best || lvl.rank > best.rank)) best = lvl;
  return best ? { level: best.label, ok: best.ok } : { level: null, ok: null };
}

export function sbiReasons(pincodeMatch: boolean | null, educationOk: boolean | null, canInvest: boolean | null): SbiReason[] {
  const reasons: SbiReason[] = [];
  const pairs: Array<[boolean | null, SbiReason, SbiReason]> = [
    [pincodeMatch, 'pincode_mismatch', 'pincode_unknown'],
    [educationOk, 'education_below_12th', 'education_unknown'],
    [canInvest, 'cannot_invest', 'investment_unknown'],
  ];
  for (const [value, failed, unknown] of pairs) {
    if (value === false) reasons.push(failed);
    else if (value === null) reasons.push(unknown);
  }
  return reasons;
}

/** Returns the lead's status and the SBI criteria that failed or are unknown (empty for sbi_strong). */
export function qualifyLead(
  pincodeMatch: boolean | null,
  educationOk: boolean | null,
  canInvest: boolean | null,
  esafResponse: EsafResponse | undefined,
): { status: QualificationStatus; reasons: SbiReason[] } {
  const reasons = sbiReasons(pincodeMatch, educationOk, canInvest);
  const esaf = esafResponse === 'yes' || esafResponse === 'no' ? esafResponse : null;
  if (pincodeMatch === true && educationOk === true && canInvest === true) return { status: 'sbi_strong', reasons };
  // Education ≥ 12th is required for ESAF too: below 12th fails both tracks.
  if (educationOk === false) return { status: 'not_qualified', reasons };
  if (pincodeMatch === false || canInvest === false) {
    if (esaf === 'yes') return { status: educationOk === true ? 'esaf_strong' : 'needs_info', reasons };
    if (esaf === 'no') return { status: 'not_qualified', reasons };
    return { status: 'esaf_pitch', reasons };
  }
  if (esaf === 'yes' && educationOk === true) return { status: 'esaf_strong', reasons };
  return { status: 'needs_info', reasons };
}
