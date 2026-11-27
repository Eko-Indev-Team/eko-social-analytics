/** Interface languages. English is the source text; every other language is a dictionary in ./locales/<code>.json. */
export const LANGUAGES = [
  { code: 'en', label: 'English', english: 'English', htmlLang: 'en' },
  { code: 'hi', label: 'हिन्दी', english: 'Hindi', htmlLang: 'hi' },
  { code: 'hinglish', label: 'Hinglish', english: 'Hinglish', htmlLang: 'hi-Latn' },
  { code: 'gu', label: 'ગુજરાતી', english: 'Gujarati', htmlLang: 'gu' },
  { code: 'bn', label: 'বাংলা', english: 'Bangla', htmlLang: 'bn' },
  { code: 'mr', label: 'मराठी', english: 'Marathi', htmlLang: 'mr' },
  { code: 'ta', label: 'தமிழ்', english: 'Tamil', htmlLang: 'ta' },
  { code: 'te', label: 'తెలుగు', english: 'Telugu', htmlLang: 'te' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ', english: 'Punjabi', htmlLang: 'pa' },
  { code: 'kn', label: 'ಕನ್ನಡ', english: 'Kannada', htmlLang: 'kn' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

export const isLanguageCode = (value: unknown): value is LanguageCode => LANGUAGES.some((l) => l.code === value);
