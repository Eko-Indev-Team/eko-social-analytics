/**
 * Interface translation: placeholders survive translation, every language file is complete for the extracted keys,
 * and choosing a language in the menu re-renders the interface in it.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LanguageMenu } from '@/components/layout/LanguageMenu';
import { I18nProvider, interpolate, useT } from '@/i18n/I18nContext';
import { LANGUAGES } from '@/i18n/languages';

const i18nDir = join(__dirname, '..', 'i18n');
const keys: string[] = JSON.parse(readFileSync(join(i18nDir, 'keys.json'), 'utf8'));
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('i18n', () => {
  it('fills placeholders and leaves unknown ones alone', () => {
    expect(interpolate('{count} leads', { count: 5 })).toBe('5 leads');
    expect(interpolate('Hi {name}', {})).toBe('Hi {name}');
  });

  it('has a dictionary for every non-English language', () => {
    const files = readdirSync(join(i18nDir, 'locales')).map((f) => f.replace('.json', ''));
    expect(files.sort()).toEqual(LANGUAGES.filter((l) => l.code !== 'en').map((l) => l.code).sort());
  });

  for (const { code } of LANGUAGES.filter((l) => l.code !== 'en')) {
    it(`${code}: translates every interface string and keeps its placeholders`, () => {
      const dict: Record<string, string> = JSON.parse(readFileSync(join(i18nDir, 'locales', `${code}.json`), 'utf8'));
      const missing = keys.filter((k) => !dict[k]?.trim());
      expect(missing).toEqual([]);
      const broken = keys.filter((k) => placeholders(k).join() !== placeholders(dict[k]).join());
      expect(broken).toEqual([]);
    });
  }

  it('switches the interface language from the menu', async () => {
    function Title() {
      const t = useT();
      return <h1>{t('Dashboard')}</h1>;
    }
    render(
      <I18nProvider initial="en">
        <LanguageMenu />
        <Title />
      </I18nProvider>,
    );
    expect(screen.getByRole('heading')).toHaveTextContent('Dashboard');
    fireEvent.click(screen.getByRole('button', { name: /Language/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /हिन्दी/ }));
    const hindi = JSON.parse(readFileSync(join(i18nDir, 'locales', 'hi.json'), 'utf8'))['Dashboard'];
    expect(await screen.findByRole('heading', { name: hindi })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('hi');
  });
});
