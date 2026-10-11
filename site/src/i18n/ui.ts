// Add a language: a key in `languages`, its strings in `ui`, and the code in astro.config.ts `i18n.locales`.
export const languages = { en: 'English' } as const;
export type Lang = keyof typeof languages;
export const defaultLang: Lang = 'en';

const en = {
  'nav.docs': 'Docs',
  'nav.github': 'GitHub',
  'nav.overview': 'Overview',
  'nav.playbooks': 'Playbooks',
  'nav.principles': 'Principles',
  'hero.cta': 'Read the docs',
  'hero.install': 'Quick start',
  'hero.copy': 'Copy',
  'hero.copied': 'Copied',
  'hero.star': 'Star on GitHub',
  'hero.stage': 'Stage',
  'docs.source': 'Source in the repo',
  'drive.start': 'Drive',
  'drive.exit': 'Pit in',
  'drive.hint': '↑ W throttle · ↓ S brake · ← → A D steer · Esc pit in',
  'drive.throttle': 'Throttle',
  'drive.brake': 'Brake',
  'drive.left': 'Steer left',
  'drive.right': 'Steer right',
  'credits.models': '3D models',
  'menu.open': 'Menu',
  'menu.close': 'Close',
  'menu.home': 'Home',
  'menu.changelog': 'Changelog',
} as const;

export const ui: Record<Lang, Record<keyof typeof en, string>> = { en };

export const t = (lang: Lang) => (key: keyof typeof en): string => ui[lang][key];

/** Prefix a site path with the deploy base (`/` on the custom domain). */
export const href = (path: string): string => `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
