import type { Config } from 'tailwindcss';
import defaultColors from 'tailwindcss/colors';
import forms from '@tailwindcss/forms';
import containerQueries from '@tailwindcss/container-queries';

/**
 * Eko / AutoGMap brand (brand-kit/BRAND_REFERENCE.md). Every colour resolves to a CSS variable defined in
 * src/styles/theme.css (copied unchanged from the brand kit), so dark (default) and light (<html data-theme="light">)
 * both come from that one file — no hex values are typed here.
 *
 * - The Stitch-era token names used across the components (surface-card, text-secondary, status-active …) are kept
 *   and pointed at the matching --app-* / --eko-* semantic tokens.
 * - theme.css's Tailwind layer is written for Tailwind v4. This project is on v3, so the same behaviour is
 *   reproduced here: slate/sky/emerald/rose/amber/purple read theme.css's light-mode --color-<name>-<step> overrides
 *   and fall back to Tailwind's default palette, which is what dark mode uses ("Dark uses Tailwind's default colours
 *   untouched"). Other palettes (red, blue, indigo, gray …) are deliberately not available.
 */

/** A colour from a CSS variable that still honours Tailwind opacity modifiers (bg-x/40). */
const token = (cssVar: string, fallback?: string, strength = 1) => {
  const ref = fallback ? `var(${cssVar}, ${fallback})` : `var(${cssVar})`;
  return `color-mix(in srgb, ${ref} calc(<alpha-value> * ${strength * 100}%), transparent)`;
};

type Palette = 'slate' | 'sky' | 'emerald' | 'rose' | 'amber' | 'purple';
const palette = (name: Palette) =>
  Object.fromEntries(Object.entries(defaultColors[name]).map(([step, hex]) => [step, token(`--color-${name}-${step}`, hex)]));
/** A palette step at a fixed tint, e.g. the 40% chip washes of section 4 (bg-sky-900/40) as a single token. */
const tint = (name: Palette, step: keyof (typeof defaultColors)['slate'], strength: number) =>
  token(`--color-${name}-${step}`, defaultColors[name][step], strength);

const app = {
  bg: token('--app-bg'),
  surface: token('--app-surface'),
  surface2: token('--app-surface-2'),
  border: token('--app-border'),
  borderStrong: token('--app-border-strong'),
  text: token('--app-text'),
  text2: token('--app-text-2'),
  muted: token('--app-muted'),
  subtle: token('--app-subtle'),
  primary: token('--app-primary'),
  primaryHover: token('--app-primary-hover'),
  primaryText: token('--app-primary-text'),
  link: token('--app-link'),
  success: token('--app-success'),
  successBg: token('--app-success-bg'),
  successSolid: token('--app-success-solid'),
  warning: token('--app-warning'),
  warningBg: token('--app-warning-bg'),
  danger: token('--app-danger'),
  dangerBg: token('--app-danger-bg'),
  gold: token('--eko-gold'),
  goldHover: token('--eko-gold-hover'),
};
const ai = { accent: palette('purple')['400'], subtle: tint('purple', '900', 0.4), border: palette('purple')['800'] };
const info = { subtle: tint('sky', '900', 0.4), border: palette('sky')['800'] };

const font = (cssVar: string) => [`var(${cssVar})`];
const rem = (px: number) => `${px / 16}rem`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',
      white: app.primaryText,
      slate: palette('slate'),
      sky: palette('sky'),
      emerald: palette('emerald'),
      rose: palette('rose'),
      amber: palette('amber'),
      purple: palette('purple'),

      // Brand (same in both themes)
      gold: app.gold,
      'gold-hover': app.goldHover,
      teal: token('--eko-teal'),
      navy: token('--eko-navy'),

      // Semantic tokens under the component class names
      background: app.bg,
      surface: app.bg,
      'surface-bright': app.bg,
      'surface-canvas': app.bg,
      'surface-card': app.surface,
      'surface-container-lowest': app.surface,
      'surface-card-subtle': app.surface2,
      'surface-container-low': app.surface2,
      'surface-container': app.surface2,
      'surface-container-high': app.surface2,
      'surface-container-highest': app.surface2,
      'surface-variant': app.surface2,
      'surface-dim': app.surface2,
      'secondary-container': app.surface2,
      'secondary-fixed': app.surface2,
      'primary-fixed': app.surface2,
      'border-subtle': app.border,
      'border-strong': app.border,
      'border-input': app.borderStrong,
      outline: app.borderStrong,
      'outline-variant': app.borderStrong,
      'border-focused': app.gold,

      'text-primary': app.text,
      'on-surface': app.text,
      'on-background': app.text,
      'text-secondary': app.text2,
      'on-surface-variant': app.text2,
      'on-secondary-container': app.text2,
      secondary: app.text2,
      'text-tertiary': app.muted,
      'text-subtle': app.subtle,

      primary: app.link,
      'surface-tint': app.link,
      tertiary: app.link,
      'tertiary-fixed': info.subtle,
      'primary-container': app.primary,
      'brand-primary-hover': app.primaryHover,
      'on-primary': app.primaryText,
      'on-primary-container': app.primaryText,
      'on-primary-fixed': app.text,

      'status-active': app.success,
      'status-active-subtle': app.successBg,
      'status-active-solid': app.successSolid,
      'status-paused': app.warning,
      'status-paused-subtle': app.warningBg,
      'status-completed': app.link,
      'status-completed-subtle': info.subtle,
      'status-completed-border': info.border,
      'status-draft': app.muted,
      'status-draft-subtle': app.surface2,
      error: app.danger,
      'error-container': app.dangerBg,
      'on-error-container': app.danger,
      'on-error': app.primaryText,

      'ai-accent': ai.accent,
      'ai-subtle': ai.subtle,
      'ai-border': ai.border,
    },
    // "primary-container" was the gold brand fill in the Stitch design. As a fill it is now the primary action
    // colour; as an outline, ring or accent text it is the Eko gold accent (active state, focus, highlights).
    extend: {
      borderColor: { 'primary-container': app.gold },
      ringColor: { 'primary-container': app.gold },
      outlineColor: { 'primary-container': app.gold },
      textColor: { 'primary-container': app.link },
      borderRadius: {
        DEFAULT: 'var(--app-radius-sm)',
        lg: 'var(--app-radius)',
        xl: 'var(--app-radius)',
        // Kept from the Stitch export (pills and avatars); the brand reference does not cover it.
        full: '0.75rem',
      },
      fontFamily: {
        sans: font('--font-sans'),
        heading: font('--font-heading'),
        mono: font('--font-mono'),
        'body-sm': font('--font-sans'),
        'body-md': font('--font-sans'),
        'body-lg': font('--font-sans'),
        'label-sm': font('--font-sans'),
        'label-md': font('--font-sans'),
        'label-code': font('--font-mono'),
        'metric-stat-sm': font('--font-mono'),
        'metric-stat-lg': font('--font-mono'),
        'display-hero-mobile': font('--font-heading'),
        'display-hero': font('--font-heading'),
        'headline-lg': font('--font-heading'),
        'headline-md': font('--font-heading'),
        'headline-sm': font('--font-heading'),
      },
      // Same steps as before, in rem so they follow the 17px root.
      fontSize: {
        'label-code': [rem(10), { lineHeight: rem(12), letterSpacing: '0.06em', fontWeight: '700' }],
        'body-sm': [rem(12), { lineHeight: rem(16), fontWeight: '400' }],
        'display-hero-mobile': [rem(28), { lineHeight: rem(36), letterSpacing: '-0.02em', fontWeight: '800' }],
        'display-hero': [rem(36), { lineHeight: rem(44), letterSpacing: '-0.03em', fontWeight: '800' }],
        'headline-lg': [rem(24), { lineHeight: rem(32), letterSpacing: '-0.02em', fontWeight: '700' }],
        'label-sm': [rem(11), { lineHeight: rem(14), letterSpacing: '0.04em', fontWeight: '600' }],
        'metric-stat-sm': [rem(22), { lineHeight: rem(28), letterSpacing: '-0.015em', fontWeight: '600' }],
        'body-lg': [rem(15), { lineHeight: rem(22), fontWeight: '400' }],
        'metric-stat-lg': [rem(32), { lineHeight: rem(38), letterSpacing: '-0.025em', fontWeight: '700' }],
        'headline-sm': [rem(16), { lineHeight: rem(24), letterSpacing: '-0.01em', fontWeight: '600' }],
        'label-md': [rem(13), { lineHeight: rem(18), fontWeight: '500' }],
        'body-md': [rem(14), { lineHeight: rem(20), fontWeight: '400' }],
        'headline-md': [rem(20), { lineHeight: rem(28), letterSpacing: '-0.015em', fontWeight: '700' }],
      },
      // The reference allows one elevation: --app-shadow-card (none in dark, a hairline in light).
      boxShadow: {
        xs: 'var(--app-shadow-card)',
        sm: 'var(--app-shadow-card)',
        card: 'var(--app-shadow-card)',
        flyout: 'var(--app-shadow-card)',
        modal: 'var(--app-shadow-card)',
        lg: 'var(--app-shadow-card)',
        xl: 'var(--app-shadow-card)',
        '2xl': 'var(--app-shadow-card)',
      },
      backdropBlur: {
        xs: '2px',
      },
      keyframes: {
        'slide-in-right': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        'slide-in-left': { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'toast-in': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        'slide-in-right': 'slide-in-right 200ms ease-out',
        'slide-in-left': 'slide-in-left 200ms ease-out',
        'fade-in': 'fade-in 150ms ease-out',
        'toast-in': 'toast-in 180ms ease-out',
      },
    },
  },
  plugins: [forms, containerQueries],
} satisfies Config;
