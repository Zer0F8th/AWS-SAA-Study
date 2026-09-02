import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const lectures = defineCollection({
  loader: glob({ base: './src/content/lectures', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    order: z.number().int().positive(),
    domain: z.enum(['secure', 'resilient', 'performance', 'cost']),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    difficulty: z.enum(['Foundation', 'Associate', 'Deep dive']).default('Associate'),
    tags: z.array(z.string()).default([]),
    objectives: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

export const collections = { lectures };
