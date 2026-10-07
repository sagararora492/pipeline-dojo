import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { lessonFrontmatter, slugFromPath } from '../src/content/schema';

const contentDir = path.resolve(__dirname, '../content');
const lessonFiles = readdirSync(contentDir, { recursive: true, encoding: 'utf8' })
  .filter((f) => f.endsWith('.mdx'))
  .map((f) => path.join(contentDir, f));

function readLesson(file: string) {
  const text = readFileSync(file, 'utf8');
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  return { text, frontmatter: match ? parse(match[1]!) : undefined };
}

const lessons = lessonFiles.map((file) => ({ file, location: slugFromPath(file), ...readLesson(file) }));

describe('lesson files', () => {
  it('exist', () => expect(lessons.length).toBeGreaterThan(0));

  describe.each(lessons.map((l) => [path.relative(contentDir, l.file), l] as const))('%s', (_, lesson) => {
    it('is named content/<track>/NN-slug.mdx', () => expect(lesson.location).not.toBeNull());

    it('has valid frontmatter', () => {
      const result = lessonFrontmatter.safeParse(lesson.frontmatter);
      expect(result.success, result.error?.message).toBe(true);
    });

    it('matches its folder and number', () => {
      expect(lesson.frontmatter.track).toBe(lesson.location?.track);
      expect(lesson.frontmatter.order).toBe(lesson.location?.order);
    });

    it('only lists prerequisites that exist', () => {
      const known = new Set(lessons.map((l) => `${l.location?.track}/${l.location?.slug}`));
      for (const p of lesson.frontmatter.prerequisites as string[]) expect(known, `unknown prerequisite ${p}`).toContain(p);
    });

    it('has no [VERIFY] markers once verified', () => {
      if (lesson.frontmatter.status === 'verified') expect(lesson.text).not.toContain('[VERIFY');
    });
  });

  it('use unique track and order pairs', () => {
    const keys = lessons.map((l) => `${l.frontmatter.track}/${l.frontmatter.order}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
