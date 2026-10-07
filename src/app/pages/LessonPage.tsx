import { Link, useParams } from 'react-router-dom';
import { findLesson, lessonsForTrack } from '../../content/lessons';
import { trackById } from '../../content/tracks';
import { StatusBadge } from '../../components/StatusBadge';
import { SqlExercise } from '../../components/SqlExercise';
import { NotFoundPage } from './NotFoundPage';

const components = { SqlExercise };

export function LessonPage() {
  const { track: trackId = '', slug = '' } = useParams();
  const lesson = findLesson(trackId, slug);
  const track = trackById(trackId);
  if (!lesson || !track) return <NotFoundPage />;

  const siblings = lessonsForTrack(track.id);
  const index = siblings.indexOf(lesson);
  const prev = siblings[index - 1];
  const next = siblings[index + 1];

  return (
    <article className="lesson">
      <p className="crumbs">
        <Link to="/">Tracks</Link> / <Link to={`/${track.id}`}>{track.title}</Link>
      </p>
      <h1>{lesson.title}</h1>
      <p className="lesson-byline">
        <StatusBadge status={lesson.status} /> {lesson.estimated_minutes} min · tested on{' '}
        {Object.entries(lesson.verified_against).map(([engine, version]) => `${engine} ${version}`).join(', ')}
      </p>
      {lesson.status === 'draft' && (
        <p className="draft-note">
          This lesson is a draft. It hasn't been reviewed yet, and claims marked [VERIFY] are still
          unconfirmed.
        </p>
      )}

      <div className="prose">
        <lesson.Content components={components} />
      </div>

      <section className="sources">
        <h2>Sources</h2>
        <ul>
          {lesson.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url}>{s.title}</a> <span className="muted">({s.checked})</span>
            </li>
          ))}
        </ul>
      </section>

      <nav className="pager" aria-label="Lessons">
        {prev ? <Link to={`/${track.id}/${prev.slug}`}>← {prev.title}</Link> : <span />}
        {next && <Link to={`/${track.id}/${next.slug}`}>{next.title} →</Link>}
      </nav>
    </article>
  );
}
