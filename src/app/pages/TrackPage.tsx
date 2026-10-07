import { Link, useParams } from 'react-router-dom';
import { trackById } from '../../content/tracks';
import { lessonsForTrack } from '../../content/lessons';
import { StatusBadge } from '../../components/StatusBadge';
import { NotFoundPage } from './NotFoundPage';

export function TrackPage() {
  const { track: trackId = '' } = useParams();
  const track = trackById(trackId);
  if (!track) return <NotFoundPage />;
  const lessons = lessonsForTrack(track.id);

  return (
    <>
      <p className="crumbs"><Link to="/">Tracks</Link></p>
      <h1>{track.title}</h1>
      <p className="lede">{track.blurb}</p>
      {lessons.length === 0 ? (
        <p className="muted">Lessons for this track are still being researched.</p>
      ) : (
        <ol className="lesson-list">
          {lessons.map((lesson) => (
            <li key={lesson.slug}>
              <Link to={`/${track.id}/${lesson.slug}`}>
                <span className="lesson-title">{lesson.title}</span>
                <span className="lesson-summary">{lesson.summary}</span>
              </Link>
              <span className="lesson-meta">
                {lesson.estimated_minutes} min <StatusBadge status={lesson.status} />
              </span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
