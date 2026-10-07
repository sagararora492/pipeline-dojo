import type { ComponentType } from 'react';
import type { MDXComponents } from 'mdx/types';
import { lessonFrontmatter, slugFromPath, type LessonFrontmatter } from './schema';

interface LessonModule {
  default: ComponentType<{ components?: MDXComponents }>;
  frontmatter: unknown;
}

export interface Lesson extends LessonFrontmatter {
  slug: string;
  Content: LessonModule['default'];
}

const modules = import.meta.glob<LessonModule>('/content/*/*.mdx', { eager: true });

function load(): Lesson[] {
  return Object.entries(modules).map(([path, mod]) => {
    const location = slugFromPath(path);
    if (!location) throw new Error(`${path}: lesson files must be named content/<track>/NN-slug.mdx`);
    const parsed = lessonFrontmatter.safeParse(mod.frontmatter);
    if (!parsed.success) throw new Error(`${path}: invalid frontmatter\n${parsed.error.message}`);
    return { ...parsed.data, slug: location.slug, Content: mod.default };
  });
}

export const LESSONS = load();

export const lessonsForTrack = (track: string) =>
  LESSONS.filter((l) => l.track === track).sort((a, b) => a.order - b.order);

export const findLesson = (track: string, slug: string) =>
  LESSONS.find((l) => l.track === track && l.slug === slug);
