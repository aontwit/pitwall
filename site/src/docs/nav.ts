// The docs' reading order. Content comes from the repo's markdown; how it is grouped, titled and
// summarised for readers lives here, so the plugin files stay written for the agent. Other languages
// override the label, summary and group names (Thai: i18n/th/ui.ts); anything missing stays English.
import { localize, type Lang } from '../i18n/ui';
import { thNav } from '../i18n/th/ui';

/** `guides`: a page written for people with no agent file of its own (a mode of a playbook, such as parallel laps). */
export type DocKind = 'overview' | 'playbooks' | 'principles' | 'guides';
export type NavItem = {
  kind: DocKind;
  id: string;
  label: string;
  /** A command name, shown in mono. */
  command?: string;
  /** One line under the title: what the page is for. */
  summary?: string;
};
/** `parent` folds a group under a shared heading in the sidebar (the four kinds of principles). */
export const PARENTS: Record<string, string> = { principles: 'Principles' };
export type NavGroup = { id: string; group: string; parent?: string; items: NavItem[] };

const pb = (id: string, label: string, summary: string, command?: string): NavItem =>
  command ? { kind: 'playbooks', id, label, summary, command } : { kind: 'playbooks', id, label, summary };

// sentence case, as every other heading on the site: "prove-it-works" → "Prove it works"
const title = (id: string): string => (id[0] ?? '').toUpperCase() + id.slice(1).replace(/-/g, ' ');
const guide = (id: string, label: string, summary: string): NavItem => ({ kind: 'guides', id, label, summary });
const principle = (id: string): NavItem => ({ kind: 'principles', id, label: title(id) });

export const NAV: NavGroup[] = [
  {
    id: 'start',
    group: 'Get started',
    items: [
      { kind: 'overview', id: 'readme', label: 'Overview', summary: 'What pitwall is, how the loop runs, and how to install it.' },
      pb('init', 'Set up a repo', 'Read the repo, ask what it cannot read, and write the profile the loop runs on.', '/pitwall:init'),
      pb('doctor', 'Check the profile', 'Compare the profile with the contract and name the section that is missing.', '/pitwall:doctor'),
    ],
  },
  {
    id: 'loop',
    group: 'Run the loop',
    items: [
      pb('plan', 'Plan', 'Interview the owner in short rounds and turn every answer into spec and plan rows.', '/pitwall:plan'),
      pb('queue', 'Queue', 'Pick the tasks the agent can finish alone, then ask every open question once.', '/pitwall:queue'),
      pb('drive', 'Drive', 'Start the loop: one task per round until the queue is empty or you stop it.', '/pitwall:drive'),
      pb('lap', 'Lap', 'One round: pick a task, branch, code, prove it, review it, open the PR.', '/pitwall:lap'),
      guide('parallel-laps', 'Parallel laps', 'Run a batch of tasks at once, each in its own worktree and branch, with this session as the lead.'),
      guide('auto-merge', 'Auto merge', 'Let the loop merge its own verified PRs into your dev branch. Off unless you turn it on.'),
      pb('stop', 'Stop', 'End the loop after the task in progress finishes.', '/pitwall:stop'),
      pb('brake', 'Brake', 'Stop now and save the unfinished work as a WIP commit.', '/pitwall:brake'),
      pb('merge-order', 'Merge order', 'Order the open PRs by stack and readiness; humans merge.', '/pitwall:merge-order'),
    ],
  },
  {
    id: 'tasks',
    group: 'Playbooks by task',
    items: [
      pb('bug-fix', 'Bug fix', 'Reproduce on the real screen, fix, then prove it on the same screen.'),
      pb('feature', 'Feature', 'Name the data shape before any logic.'),
      pb('move-only', 'Move-only refactor', 'Change the structure, lock the behaviour with a characterization test first.'),
      pb('ratchet', 'Ratchet', 'Bring a number down and stop it from going back up.'),
      pb('port', 'Port', 'Bring behaviour over from another branch, with a parity test.'),
      pb('investigation', 'Investigation', 'Answer a read-only question with sources, never code.'),
    ],
  },
  {
    id: 'proof',
    group: 'Proof and review',
    items: [
      pb('gauge', 'Gauge', 'Pick proof by what changed: checks, a browser, or numbered steps for a human.', '/pitwall:gauge'),
      pb('verify-setup', 'Verify setup', 'Write a skill that drives the app (browser, or a headless Godot run) so level B proof needs no human.', '/pitwall:verify-setup'),
      pb('opening-a-pr', 'Opening a PR', 'Commit, push and open the PR with its evidence; the one home of the PR rules.'),
      pb('secretary', 'Secretary', 'Read past sessions and report what keeps repeating.', '/pitwall:secretary'),
    ],
  },
  {
    id: 'decide',
    group: 'Decide',
    parent: 'principles',
    items: ['attack-the-premise', 'foundational-thinking', 'redesign-from-first-principles', 'exhaust-the-design-space', 'experience-first', 'subtract-before-you-add'].map(principle),
  },
  {
    id: 'build',
    group: 'Build',
    parent: 'principles',
    items: ['model-the-domain', 'type-system-discipline', 'boundary-discipline', 'make-operations-idempotent', 'separate-before-serializing-shared-state', 'sequence-verifiable-units', 'build-the-lever'].map(principle),
  },
  {
    id: 'prove',
    group: 'Prove',
    parent: 'principles',
    items: ['prove-it-works', 'fix-root-causes', 'explain-the-number'].map(principle),
  },
  {
    id: 'people',
    group: 'People and context',
    parent: 'principles',
    items: ['never-block-on-the-human', 'minimize-reader-load', 'guard-the-context-window', 'encode-lessons-in-structure'].map(principle),
  },
];

export const FLAT: NavItem[] = NAV.flatMap((g) => g.items);

/** Site path (no base) of a doc page, e.g. `docs/playbooks/lap/` (`th/docs/playbooks/lap/` in Thai). */
export const docPath = (item: Pick<NavItem, 'kind' | 'id'>, lang: Lang = 'en'): string =>
  localize(item.kind === 'overview' ? 'docs/' : `docs/${dir(item)}/${item.id}/`, lang);
/** Guides sit beside the playbooks they belong to, so their relative links read the same. */
const dir = (item: Pick<NavItem, 'kind'>): string => (item.kind === 'guides' ? 'playbooks' : item.kind);

/** Site path of the page's raw markdown, e.g. `docs/playbooks/lap.md`: the agent's English text in every language. */
export const mdPath = (item: Pick<NavItem, 'kind' | 'id'>): string => (item.kind === 'overview' ? 'docs/index.md' : `docs/${dir(item)}/${item.id}.md`);

/** Path of the source file in the repo. */
export const sourcePath = (item: Pick<NavItem, 'kind' | 'id'>): string =>
  item.kind === 'overview'
    ? 'README.md'
    : item.kind === 'guides'
      ? `site/src/content/guides/${item.id}.md`
      : item.id === 'gauge' ? 'plugin/skills/gauge/SKILL.md' : `plugin/skills/pitwall/${item.kind}/${item.id}.md`;

const overrides = { en: undefined, th: thNav } satisfies Record<Lang, unknown>;

/** An item's label and summary in a language. */
export const words = (item: NavItem, lang: Lang): { label: string; summary: string | undefined } => {
  const o = overrides[lang]?.items[item.id];
  return { label: o?.[0] ?? item.label, summary: o?.[1] ?? item.summary };
};

/** A group's (or a parent heading's) name in a language. */
export const groupName = (id: string, fallback: string, lang: Lang): string => overrides[lang]?.groups[id] ?? fallback;

/** Where an item sits, for the phone's page button: "Principles · Prove". */
export const groupOf = (item: NavItem, lang: Lang = 'en'): string => {
  const g = NAV.find((n) => n.items.includes(item));
  if (!g) return '';
  const name = groupName(g.id, g.group, lang);
  return g.parent ? `${groupName(g.parent, PARENTS[g.parent] ?? g.parent, lang)} · ${name}` : name;
};

export const find = (kind: DocKind, id: string): NavItem | undefined => FLAT.find((i) => i.kind === kind && i.id === id);
