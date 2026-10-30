// Add a language: its code in `languages` and in astro.config.ts `i18n.locales`, its strings in a file of
// its own (Thai: th/ui.ts, kept apart because the repo is English-only outside the translations).
import { th } from './th/ui';

export const languages = ['en', 'th'] as const;
export type Lang = (typeof languages)[number];
export const defaultLang: Lang = 'en';

const en = {
  'lang.name': 'English',
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
  'docs.source': 'Source in the repo',
  'docs.copyMd': 'Copy as Markdown',
  'docs.askClaude': 'Ask Claude',
  'docs.askPrompt': 'Read {url} and answer my questions about pitwall.',
  'docs.onThisPage': 'On this page',
  'docs.prev': 'Previous',
  'docs.next': 'Next',
  'docs.navToggle': 'Pages',
  'docs.playbook': 'The playbook the agent follows',
  'docs.playbookNote': 'The full spec for {cmd}. This page sums it up; when the two differ, the playbook wins.',
  'docs.playbookToc': 'Agent playbook',
  'docs.readme': 'The full README',
  'docs.readmeNote': "Everything in the repo's README: team installs, the profile, status, development.",
  'docs.readmeToc': 'Full README',
  'docs.untranslated': '',
  'search.open': 'Search',
  'search.placeholder': 'Search playbooks, principles, commands…',
  'drive.start': 'Drive',
  'drive.exit': 'Pit in',
  'drive.best': 'Best',
  'drive.top': 'Top',
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
};

export type UiKey = keyof typeof en;
export const ui: Record<Lang, Record<UiKey, string>> = { en, th };

export const t =
  (lang: Lang) =>
  (key: UiKey, vars: Record<string, string> = {}): string =>
    ui[lang][key].replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);

/** Prefix a site path with the deploy base (`/` on the custom domain). */
export const href = (path: string): string => `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;

/** The same site path in another language: English has no prefix, the others sit under `/<lang>/`. */
export const localize = (path: string, lang: Lang): string => (lang === defaultLang ? path : `${lang}/${path.replace(/^\//, '')}`);
