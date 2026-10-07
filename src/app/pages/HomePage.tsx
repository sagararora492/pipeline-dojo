import { Link } from 'react-router-dom';
import { TRACKS } from '../../content/tracks';
import { lessonsForTrack } from '../../content/lessons';

export function HomePage() {
  return (
    <>
      <section className="hero">
        <h1>Learn data engineering by doing it.</h1>
        <p className="lede">
          Read a short lesson, then write real SQL and Python against real data. Answers are
          checked right away, in your browser. No account, no server, no API key.
        </p>
      </section>

      <h2 className="section-title">Tracks</h2>
      <ul className="track-grid">
        {TRACKS.map((track) => {
          const count = lessonsForTrack(track.id).length;
          const body = (
            <>
              <h3>{track.title}</h3>
              <p>{track.blurb}</p>
              <p className="meta">
                {count > 0 ? `${count} lesson${count === 1 ? '' : 's'}` : 'Coming soon'} · {track.engine}
              </p>
            </>
          );
          return (
            <li key={track.id} className={count > 0 ? 'card' : 'card card-soon'}>
              {count > 0 ? <Link to={`/${track.id}`}>{body}</Link> : <div>{body}</div>}
            </li>
          );
        })}
      </ul>

      <section className="trust">
        <h2 className="section-title">Why you can trust it</h2>
        <p>
          Every lesson lists its sources and the engine version its exercises were tested on, and
          shows a status badge: <em>draft</em>, <em>reviewed</em> or <em>verified</em>. On every
          change, CI runs each exercise's reference solution and a set of known-wrong answers that
          must be rejected.
        </p>
      </section>
    </>
  );
}
