import type { CSSProperties } from 'react';

/** Recharts tooltip box in the brand tokens (theme.css), so it follows the light/dark theme. */
export const chartTooltipStyle: CSSProperties = {
  borderRadius: 'var(--app-radius)',
  border: '1px solid var(--app-border-strong)',
  backgroundColor: 'var(--app-surface)',
  color: 'var(--app-text)',
  boxShadow: 'var(--app-shadow-card)',
  fontSize: 12,
};
