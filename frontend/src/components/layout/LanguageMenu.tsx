import { Dropdown, MenuItem } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { LANGUAGES } from '@/i18n/languages';
import { useI18n } from '@/i18n/I18nContext';

/** Globe icon that switches the whole interface language. */
export function LanguageMenu() {
  const { lang, setLang, t } = useI18n();
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];
  return (
    <Dropdown
      label={t('Language')}
      className="w-52"
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={`${t('Language')}: ${current.label}`}
          title={`${t('Language')}: ${current.label}`}
          className="p-1 text-text-secondary hover:text-text-primary"
        >
          <Icon name="translate" className="text-[1.375rem]" />
        </button>
      )}
    >
      {(close) => (
        <>
          <p className="px-3 pt-1.5 pb-2 text-[0.625rem] font-bold uppercase tracking-wider text-text-tertiary">{t('Language')}</p>
          {LANGUAGES.map((l) => (
            <MenuItem
              key={l.code}
              active={l.code === lang}
              onClick={() => {
                close();
                setLang(l.code);
              }}
            >
              <span lang={l.htmlLang} className="flex items-center justify-between gap-2">
                <span className="font-semibold">{l.label}</span>
                {l.label !== l.english && <span className="text-[0.6875rem] text-text-tertiary">{l.english}</span>}
              </span>
            </MenuItem>
          ))}
        </>
      )}
    </Dropdown>
  );
}
