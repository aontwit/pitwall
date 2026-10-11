// llms.txt: the docs as an index an agent can read, every page linked as markdown.
import type { APIRoute } from 'astro';
import { NAV, mdPath } from '../docs/nav';
import { href } from '../i18n/ui';

export const GET: APIRoute = ({ site }) => {
  const abs = (p: string): string => new URL(href(p), site).toString();
  const lines = [
    '# pitwall',
    '',
    '> The agent loop that queues your work, proves every PR, and leaves the merge to you. A Claude Code plugin.',
    '',
    ...NAV.flatMap((g) => [
      `## ${g.group}`,
      '',
      ...g.items.map((i) => `- [${i.label}${i.command ? ` (${i.command})` : ''}](${abs(mdPath(i))})${i.summary ? `: ${i.summary}` : ''}`),
      '',
    ]),
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
