export type AppLanguage = 'en' | 'de';

export const SUPPORTED_APP_LANGUAGES: readonly AppLanguage[] = ['en', 'de'];

export function isAppLanguage(value: unknown): value is AppLanguage {
  return value === 'en' || value === 'de';
}

export function detectPreferredLanguage(): AppLanguage {
  if (typeof navigator === 'undefined') {
    return 'en';
  }

  const languages = navigator.languages.length > 0 ? navigator.languages : [navigator.language];
  return languages.some((language) => language.toLowerCase().startsWith('de')) ? 'de' : 'en';
}

export function appLanguageToLocale(language: AppLanguage): string {
  return language === 'de' ? 'de-DE' : 'en-US';
}
