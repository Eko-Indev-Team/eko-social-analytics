/**
 * Collects every interface string (the English keys passed to t('…') and msg('…')) into src/i18n/keys.json,
 * then reports, per language, how many keys are still untranslated.
 *
 *   node scripts/i18n-extract.mjs            # update keys.json and print coverage
 *   node scripts/i18n-extract.mjs --missing  # also write src/i18n/missing/<lang>.json with the untranslated keys
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const i18nDir = join(root, 'i18n');

/** Keys that reach t() as values from data or state rather than as literals in the code. */
const EXTRA_KEYS = [
  'Admin', 'Owner', 'Editor', 'Viewer', 'Team member', 'Growth Lead',
  'Synced 12m ago', 'Synced just now',
  'What is working', 'What is declining', 'Biggest Opportunity', 'Recommended Action',
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== 'test' && name !== 'locales') walk(path, out);
    } else if (/\.(tsx?|ts)$/.test(name) && !name.endsWith('.d.ts') && !name.endsWith('.test.ts') && !name.endsWith('.test.tsx')) out.push(path);
  }
  return out;
}

// t('…') / t("…") / msg('…') / translate('…') — the call must start the token so words like "format(" don't match.
const CALL = /(?<![\w$.])(?:t|msg|translate)\(\s*(['"])((?:\\.|(?!\1)[^\\\n])*)\1/g;

function unescape(raw) {
  return raw.replace(/\\(u\{?[0-9a-fA-F]+\}?|.)/g, (_, c) => {
    if (c[0] === 'u') return String.fromCodePoint(parseInt(c.replace(/[u{}]/g, ''), 16));
    return { n: '\n', t: '\t' }[c] ?? c;
  });
}

// Plain-string props that components such as KpiCard translate themselves (label="Views", hint="…").
const PROP = /\b(?:label|hint|deltaLabel)="([^"\n{}]+)"/g;

const keys = new Set(EXTRA_KEYS);
for (const file of walk(root)) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(CALL)) {
    const key = unescape(m[2]);
    if (key.trim()) keys.add(key);
  }
  for (const m of src.matchAll(PROP)) if (/[A-Za-z]/.test(m[1])) keys.add(m[1]);
}

const sorted = [...keys].sort((a, b) => a.localeCompare(b));
writeFileSync(join(i18nDir, 'keys.json'), JSON.stringify(sorted, null, 2) + '\n');
console.log(`${sorted.length} interface strings`);

// Every language in src/i18n/languages.ts except English (the source text).
const LANGS = ['hi', 'hinglish', 'gu', 'bn', 'mr', 'ta', 'te', 'pa', 'kn'];
const writeMissing = process.argv.includes('--missing');
for (const lang of LANGS) {
  const file = join(i18nDir, 'locales', `${lang}.json`);
  const dict = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  const missing = sorted.filter((k) => !dict[k]);
  console.log(`${lang.padEnd(9)} ${sorted.length - missing.length}/${sorted.length} translated`);
  if (writeMissing) {
    mkdirSync(join(i18nDir, 'missing'), { recursive: true });
    writeFileSync(join(i18nDir, 'missing', `${lang}.json`), JSON.stringify(missing, null, 2) + '\n');
  }
}
