import { config } from './config';

/** Allowed sign-in / sign-up domains (config.allowedEmailDomains). The backend enforces them; this only gives an early message. */
const domains = (): readonly string[] => config.allowedEmailDomains ?? [];

/** Empty list = any domain. */
export function emailDomainAllowed(email: string): boolean {
  const allowed = domains();
  if (allowed.length === 0) return true;
  return allowed.includes(email.trim().toLowerCase().split('@').pop() ?? '');
}

export function allowedDomainsLabel(): string {
  return domains().map((d) => `@${d}`).join(', ') || 'your work';
}
