import { demoAdLeads } from '@/data/ads';
import { isQualified, parseEducation, qualifyLead, QUALIFICATION_STATUSES, sbiReasons } from '@/lib/qualification';

/** Mirrors backend/tests for app/services/qualification.py (docs/LEAD_QUALIFICATION.md). */
describe('parseEducation', () => {
  it.each([
    ['12th pass', '12th / Intermediate', true],
    ['Intermediate', '12th / Intermediate', true],
    ['+2', '12th / Intermediate', true],
    ['10+2', '12th / Intermediate', true],
    ['HSC', '12th / Intermediate', true],
    ['12वीं', '12th / Intermediate', true],
    ['Graduate', 'Graduate', true],
    ['B.Com', 'Graduate', true],
    ['BA', 'Graduate', true],
    ['स्नातक', 'Graduate', true],
    ['MBA', 'Post graduate', true],
    ['PhD', 'PhD', true],
    ['10th', '10th', false],
    ['Matric', '10th', false],
    ['दसवीं', '10th', false],
    ['8th', 'Below 10th', false],
    ['illiterate', 'Below 10th', false],
    ['10th, 12th pass', '12th / Intermediate', true],
  ])('%s → %s', (text, level, ok) => {
    expect(parseEducation(text)).toEqual({ level, ok });
  });

  it.each(['', '   ', 'Diploma', null, undefined])('unknown for %s', (text) => {
    expect(parseEducation(text)).toEqual({ level: null, ok: null });
  });
});

describe('qualifyLead', () => {
  it('SBI strong when pincode, education and investment are all yes', () => {
    expect(qualifyLead(true, true, true, null)).toEqual({ status: 'sbi_strong', reasons: [] });
    expect(qualifyLead(true, true, true, 'no').status).toBe('sbi_strong');
  });

  it('below 12th fails both tracks, even with ESAF yes', () => {
    expect(qualifyLead(true, false, true, null)).toEqual({ status: 'not_qualified', reasons: ['education_below_12th'] });
    expect(qualifyLead(false, false, false, 'yes').status).toBe('not_qualified');
  });

  it('pincode or investment no → ESAF track', () => {
    expect(qualifyLead(false, true, true, null)).toEqual({ status: 'esaf_pitch', reasons: ['pincode_mismatch'] });
    expect(qualifyLead(true, true, false, 'yes').status).toBe('esaf_strong');
    expect(qualifyLead(true, null, false, 'yes').status).toBe('needs_info');
    expect(qualifyLead(false, true, true, 'no').status).toBe('not_qualified');
    expect(qualifyLead(false, null, true, null).status).toBe('esaf_pitch');
  });

  it('nothing failed but something unknown → check details (or ESAF strong with ESAF yes and education ok)', () => {
    expect(qualifyLead(null, true, true, null)).toEqual({ status: 'needs_info', reasons: ['pincode_unknown'] });
    expect(qualifyLead(true, null, null, null).reasons).toEqual(['education_unknown', 'investment_unknown']);
    expect(qualifyLead(null, true, true, 'yes').status).toBe('esaf_strong');
    expect(qualifyLead(true, null, true, 'yes').status).toBe('needs_info');
  });

  it('sbiReasons lists failed and unknown criteria in order', () => {
    expect(sbiReasons(false, null, false)).toEqual(['pincode_mismatch', 'education_unknown', 'cannot_invest']);
  });

  it('only SBI and ESAF strong count as qualified', () => {
    expect(QUALIFICATION_STATUSES.filter(isQualified)).toEqual(['sbi_strong', 'esaf_strong']);
  });
});

describe('demo ad leads', () => {
  it('cover every status with obviously fake contact details, and agree with the rule', () => {
    const statuses = new Set(demoAdLeads.map((l) => l.qualificationStatus));
    expect([...statuses].sort()).toEqual([...QUALIFICATION_STATUSES].sort());
    for (const l of demoAdLeads) {
      expect(l.name).toMatch(/^Demo Lead \d{2}$/);
      expect(l.phone).toMatch(/^\+91 90000 000\d{2}$/);
      expect(qualifyLead(l.pincodeMatch, l.educationOk, l.canInvest, l.esafResponse).status).toBe(l.qualificationStatus);
    }
  });
});
