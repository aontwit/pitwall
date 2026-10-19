// The docs' reading order. Content comes from the repo's markdown; how it is grouped, titled and
// summarised for readers lives here, so the plugin files stay written for the agent.

export type DocKind = 'overview' | 'playbooks' | 'principles';
export type NavItem = {
  kind: DocKind;
  id: string;
  label: string;
  /** A command name, shown in mono. */
  command?: string;
  /** One line under the title: what the page is for. */
  summary?: string;
};
export type NavGroup = { group: string; items: NavItem[] };

const pb = (id: string, label: string, summary: string, command?: string): NavItem =>
  command ? { kind: 'playbooks', id, label, summary, command } : { kind: 'playbooks', id, label, summary };

const title = (id: string): string =>
  id
    .split('-')
    .map((w, i) => (i > 0 && ['the', 'on', 'in', 'before', 'from', 'to'].includes(w) ? w : (w[0] ?? '').toUpperCase() + w.slice(1)))
    .join(' ');
const principle = (id: string): NavItem => ({ kind: 'principles', id, label: title(id) });

export const NAV: NavGroup[] = [
  {
    group: 'Get started',
    items: [
      { kind: 'overview', id: 'readme', label: 'Overview', summary: 'What pitwall is, how the loop runs, and how to install it.' },
      pb('init', 'Set up a repo', 'Read the repo, ask what it cannot read, and write the profile the loop runs on.', '/pitwall:init'),
      pb('doctor', 'Check the profile', 'Compare the profile with the contract and name the section that is missing.', '/pitwall:doctor'),
    ],
  },
  {
    group: 'The loop',
    items: [
      pb('plan', 'Plan', 'Interview the owner in short rounds and turn every answer into spec and plan rows.', '/pitwall:plan'),
      pb('queue', 'Queue', 'Pick the tasks the agent can finish alone, then ask every open question once.', '/pitwall:queue'),
      pb('drive', 'Drive', 'Start the loop: one task per round until the queue is empty or you stop it.', '/pitwall:drive'),
      pb('lap', 'Lap', 'One round: pick a task, branch, code, prove it, review it, open the PR.', '/pitwall:lap'),
      pb('stop', 'Stop', 'End the loop after the task in progress finishes.', '/pitwall:stop'),
      pb('brake', 'Brake', 'Stop now and save the unfinished work as a WIP commit.', '/pitwall:brake'),
      pb('merge-order', 'Merge order', 'Order the open PRs by stack and readiness; humans merge.', '/pitwall:merge-order'),
    ],
  },
  {
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
    group: 'Proof & review',
    items: [
      pb('gauge', 'Gauge', 'Pick proof by what changed: checks, a browser, or numbered steps for a human.', '/pitwall:gauge'),
      pb('verify-setup', 'Verify setup', 'Write a skill that drives the app (browser, or a headless Godot run) so level B proof needs no human.', '/pitwall:verify-setup'),
      pb('opening-a-pr', 'Opening a PR', 'Commit, push and open the PR with its evidence; the one home of the PR rules.'),
      pb('secretary', 'Secretary', 'Read past sessions and report what keeps repeating.', '/pitwall:secretary'),
    ],
  },
  {
    group: 'Principles · decide',
    items: ['attack-the-premise', 'foundational-thinking', 'redesign-from-first-principles', 'exhaust-the-design-space', 'experience-first', 'subtract-before-you-add'].map(principle),
  },
  {
    group: 'Principles · build',
    items: ['model-the-domain', 'type-system-discipline', 'boundary-discipline', 'make-operations-idempotent', 'separate-before-serializing-shared-state', 'sequence-verifiable-units', 'build-the-lever'].map(principle),
  },
  {
    group: 'Principles · prove',
    items: ['prove-it-works', 'fix-root-causes', 'explain-the-number'].map(principle),
  },
  {
    group: 'Principles · people & context',
    items: ['never-block-on-the-human', 'minimize-reader-load', 'guard-the-context-window', 'encode-lessons-in-structure'].map(principle),
  },
];

export const FLAT: NavItem[] = NAV.flatMap((g) => g.items);

/** Site path (no base) of a doc page, e.g. `docs/playbooks/lap/`. */
export const docPath = (item: Pick<NavItem, 'kind' | 'id'>): string => (item.kind === 'overview' ? 'docs/' : `docs/${item.kind}/${item.id}/`);

/** Site path of the page's raw markdown, e.g. `docs/playbooks/lap.md`. */
export const mdPath = (item: Pick<NavItem, 'kind' | 'id'>): string => (item.kind === 'overview' ? 'docs/index.md' : `docs/${item.kind}/${item.id}.md`);

/** Path of the source file in the repo. */
export const sourcePath = (item: Pick<NavItem, 'kind' | 'id'>): string =>
  item.kind === 'overview' ? 'README.md' : item.id === 'gauge' ? 'plugin/skills/gauge/SKILL.md' : `plugin/skills/pitwall/${item.kind}/${item.id}.md`;

export const groupOf = (item: NavItem): string => NAV.find((g) => g.items.includes(item))?.group ?? '';

export const find = (kind: DocKind, id: string): NavItem | undefined => FLAT.find((i) => i.kind === kind && i.id === id);
