import { z } from 'zod';

export const TRACK_IDS = ['sql', 'python', 'dsa', 'modelling', 'rust'] as const;
export type TrackId = (typeof TRACK_IDS)[number];

export const LESSON_STATUSES = ['draft', 'reviewed', 'verified'] as const;
export type LessonStatus = (typeof LESSON_STATUSES)[number];

const source = z.object({
  title: z.string().min(1),
  url: z.url(),
  /** When the source was read, or the version it describes. */
  checked: z.string().min(1),
});

/** Required on every lesson. CI rejects a lesson that doesn't match. */
export const lessonFrontmatter = z.strictObject({
  title: z.string().min(1),
  summary: z.string().min(1),
  track: z.enum(TRACK_IDS),
  order: z.number().int().positive(),
  prerequisites: z.array(z.string()),
  estimated_minutes: z.number().int().positive(),
  status: z.enum(LESSON_STATUSES),
  sources: z.array(source).min(1),
  /** Engine versions the exercises were run against, e.g. { duckdb: "1.4.3" }. */
  verified_against: z.record(z.string(), z.string()).refine((v) => Object.keys(v).length > 0, {
    message: 'List at least one engine version',
  }),
});

export type LessonFrontmatter = z.infer<typeof lessonFrontmatter>;

/** A lesson's slug is its file name without the NN- prefix and extension. */
export function slugFromPath(path: string): { track: string; order: number; slug: string } | null {
  const match = /content\/([^/]+)\/(\d{2})-([a-z0-9-]+)\.mdx$/.exec(path);
  if (!match) return null;
  return { track: match[1]!, order: Number(match[2]), slug: match[3]! };
}
