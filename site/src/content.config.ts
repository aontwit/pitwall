import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// ponytail: content is read straight from the plugin, so the site never drifts from what ships
const skill = '../plugin/skills/pitwall';
const frontmatter = z.object({ name: z.string().optional(), description: z.string().optional() });

export const collections = {
  overview: defineCollection({ loader: glob({ pattern: 'README.md', base: '..' }), schema: frontmatter }),
  playbooks: defineCollection({ loader: glob({ pattern: '*.md', base: `${skill}/playbooks` }), schema: frontmatter }),
  principles: defineCollection({ loader: glob({ pattern: '*.md', base: `${skill}/principles` }), schema: frontmatter }),
  // written for people: what a command does, with examples; the playbook stays the agent's full spec
  guides: defineCollection({ loader: glob({ pattern: '*.md', base: './src/content/guides' }), schema: z.object({ playbook: z.string() }) }),
};
