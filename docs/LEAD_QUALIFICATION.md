# Lead qualification (SBI and ESAF)

Decided by the product owner on 2026-11-18. Applies to both Ads leads (Meta lead forms, `ads_leads`) and SocialBoard's own leads (`leads`).
Implemented once in `backend/app/services/qualification.py` (`qualify_lead`, `parse_education`) and mirrored for demo mode in
`frontend/src/lib/qualification.ts`. The franchise-background question is no longer part of qualification.

## Inputs (each True / False / unknown)

- **Pincode match**: the lead's pincode is in the SBI service pincodes. Ads leads: the targeted pincodes of the ad the lead came from.
  SocialBoard leads: every pincode in `ads_targeting_records` plus the CSP village pincodes from the reference data.
- **Education OK**: highest education is 12th / Intermediate or above (parsed from the answer; "diploma" or blank = unknown).
- **Can invest**: answered Yes to the investment question.
- **ESAF answer**: yes / no / not asked yet. From a lead-form question, or recorded by staff after a call ("Pitch ESAF"); staff's answer wins.
  ESAF = the zero-investment ESAF Bank BC model; it needs 12th pass but no investment and no pincode match.

## Outcome (one status per lead)

| Status | Label | When |
|---|---|---|
| `sbi_strong` | Strongly qualified · SBI | Pincode match, education OK and can invest are all yes |
| `not_qualified` | Not qualified | Education is below 12th (fails SBI and ESAF; do not pitch ESAF), or the lead said no to ESAF |
| `esaf_pitch` | Pitch ESAF | Education OK or unknown, pincode mismatch or said no to investment, ESAF not asked yet |
| `esaf_strong` | Strongly qualified · ESAF | Said yes to ESAF and education is OK |
| `needs_info` | Check details | Nothing failed but something is unknown (e.g. old forms had no education question), or ESAF yes with education unknown |

Order of evaluation:

1. All three SBI inputs yes → `sbi_strong`.
2. Education no → `not_qualified`.
3. Pincode no or investment no → ESAF track: ESAF yes + education yes → `esaf_strong`; ESAF yes + education unknown → `needs_info`;
   ESAF no → `not_qualified`; not asked → `esaf_pitch`.
4. Otherwise (something unknown): ESAF yes + education yes → `esaf_strong`; else `needs_info`.

"Qualified" / "strongly qualified" counts in reports = `sbi_strong` + `esaf_strong`.
