import { defineSqlExercises } from '../../src/engines/sql/types';

const loginsSetup = `
CREATE TABLE logins (
  user_id    INTEGER,
  login_date DATE
);

INSERT INTO logins VALUES
  (1, DATE '2024-07-01'),
  (1, DATE '2024-07-02'),
  -- A second login on the same day.
  (1, DATE '2024-07-02'),
  (1, DATE '2024-07-03'),
  (1, DATE '2024-07-06'),
  (1, DATE '2024-07-07'),
  (2, DATE '2024-07-02'),
  (2, DATE '2024-07-04'),
  (2, DATE '2024-07-05');
`;

const eventsSetup = `
CREATE TABLE events (
  user_id  INTEGER,
  event_at TIMESTAMP
);

INSERT INTO events VALUES
  (1, TIMESTAMP '2024-07-01 09:00:00'),
  (1, TIMESTAMP '2024-07-01 09:10:00'),
  -- Exactly 30 minutes after the previous event: still the same session.
  (1, TIMESTAMP '2024-07-01 09:40:00'),
  -- 30 minutes and 40 seconds after the previous event: a new session.
  (1, TIMESTAMP '2024-07-01 10:10:40'),
  (1, TIMESTAMP '2024-07-01 10:20:00'),
  (2, TIMESTAMP '2024-07-01 09:05:00'),
  (2, TIMESTAMP '2024-07-01 09:50:00');
`;

export const exercises = defineSqlExercises({
  'sql-login-streaks': {
    title: 'Login streaks',
    setup: loginsSetup,
    starter: `SELECT user_id,
       login_date,
       row_number() OVER (PARTITION BY user_id ORDER BY login_date) AS rn
FROM logins
-- group consecutive days into streaks
`,
    reference: `
      WITH days AS (
        SELECT DISTINCT user_id, login_date FROM logins
      ),
      numbered AS (
        SELECT user_id, login_date,
               login_date - CAST(row_number() OVER (PARTITION BY user_id ORDER BY login_date) AS INTEGER) AS island
        FROM days
      )
      SELECT user_id,
             min(login_date) AS streak_start,
             max(login_date) AS streak_end,
             count(*) AS days
      FROM numbered
      GROUP BY user_id, island`,
    hints: [
      'In a run of consecutive days, the date and the row number both go up by 1, so the date minus the row number stays the same.',
      'User 1 logged in twice on 2024-07-02. Two rows with the same date get different row numbers, which splits the streak. Remove duplicate days first.',
      'Group by user_id and the date-minus-row-number value, then take min(login_date), max(login_date) and count(*).',
    ],
    wrongAnswers: [
      {
        why: 'Without removing the duplicate login on 2024-07-02, the two copies get different row numbers and user 1’s first streak splits in two.',
        sql: `WITH numbered AS (
                SELECT user_id, login_date,
                       login_date - CAST(row_number() OVER (PARTITION BY user_id ORDER BY login_date) AS INTEGER) AS island
                FROM logins)
              SELECT user_id, min(login_date), max(login_date), count(*) FROM numbered GROUP BY user_id, island`,
      },
      {
        why: 'dense_rank() keeps the duplicate day in the right island, but count(*) then counts it twice: 4 days instead of 3.',
        sql: `WITH numbered AS (
                SELECT user_id, login_date,
                       login_date - CAST(dense_rank() OVER (PARTITION BY user_id ORDER BY login_date) AS INTEGER) AS island
                FROM logins)
              SELECT user_id, min(login_date), max(login_date), count(*) FROM numbered GROUP BY user_id, island`,
      },
      {
        why: 'Without PARTITION BY, row numbers run across both users, so each user’s dates no longer move in step with them.',
        sql: `WITH days AS (SELECT DISTINCT user_id, login_date FROM logins),
              numbered AS (
                SELECT user_id, login_date,
                       login_date - CAST(row_number() OVER (ORDER BY login_date, user_id) AS INTEGER) AS island
                FROM days)
              SELECT user_id, min(login_date), max(login_date), count(*) FROM numbered GROUP BY user_id, island`,
      },
      {
        why: 'Grouping by user alone returns one row per user, from the first login to the last, and ignores the gaps.',
        sql: `SELECT user_id, min(login_date), max(login_date), count(DISTINCT login_date) FROM logins GROUP BY user_id`,
      },
    ],
  },

  'sql-sessionize-events': {
    title: 'Split events into sessions',
    setup: eventsSetup,
    starter: `SELECT user_id,
       event_at,
       lag(event_at) OVER (PARTITION BY user_id ORDER BY event_at) AS previous_event_at
FROM events
-- start a new session when the gap is more than 30 minutes
`,
    reference: `
      WITH flagged AS (
        SELECT user_id, event_at,
               lag(event_at) OVER (PARTITION BY user_id ORDER BY event_at) AS previous_event_at
        FROM events
      ),
      numbered AS (
        SELECT user_id, event_at,
               sum(CASE WHEN previous_event_at IS NULL
                          OR event_at - previous_event_at > INTERVAL '30 minutes'
                        THEN 1 ELSE 0 END)
                 OVER (PARTITION BY user_id ORDER BY event_at
                       ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS session_number
        FROM flagged
      )
      SELECT user_id, session_number,
             min(event_at) AS session_start,
             max(event_at) AS session_end,
             count(*) AS events
      FROM numbered
      GROUP BY user_id, session_number`,
    hints: [
      'Flag each event that starts a session: 1 when it has no previous event or the gap is more than 30 minutes, otherwise 0.',
      'A running sum of that flag, per user and in time order, gives every event its session number.',
      'Compare the gap as an interval, such as event_at - previous_event_at > INTERVAL \'30 minutes\'. Whole minutes lose the seconds.',
    ],
    wrongAnswers: [
      {
        why: '>= starts a new session at exactly 30 minutes, so the 09:40 event is split from its session.',
        sql: `WITH f AS (SELECT user_id, event_at, lag(event_at) OVER (PARTITION BY user_id ORDER BY event_at) AS p FROM events),
              n AS (SELECT user_id, event_at,
                           sum(CASE WHEN p IS NULL OR event_at - p >= INTERVAL '30 minutes' THEN 1 ELSE 0 END)
                             OVER (PARTITION BY user_id ORDER BY event_at ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS s
                    FROM f)
              SELECT user_id, s, min(event_at), max(event_at), count(*) FROM n GROUP BY user_id, s`,
      },
      {
        why: 'date_diff in minutes ignores the seconds: a gap of 30 minutes 40 seconds counts as 30, so the 10:10:40 event doesn’t start a session.',
        sql: `WITH f AS (SELECT user_id, event_at, lag(event_at) OVER (PARTITION BY user_id ORDER BY event_at) AS p FROM events),
              n AS (SELECT user_id, event_at,
                           sum(CASE WHEN p IS NULL OR date_diff('minute', p, event_at) > 30 THEN 1 ELSE 0 END)
                             OVER (PARTITION BY user_id ORDER BY event_at ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS s
                    FROM f)
              SELECT user_id, s, min(event_at), max(event_at), count(*) FROM n GROUP BY user_id, s`,
      },
      {
        why: 'The first event has no previous event, so its gap is NULL and it isn’t flagged: session numbers start at 0 instead of 1.',
        sql: `WITH f AS (SELECT user_id, event_at, lag(event_at) OVER (PARTITION BY user_id ORDER BY event_at) AS p FROM events),
              n AS (SELECT user_id, event_at,
                           sum(CASE WHEN event_at - p > INTERVAL '30 minutes' THEN 1 ELSE 0 END)
                             OVER (PARTITION BY user_id ORDER BY event_at ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS s
                    FROM f)
              SELECT user_id, s, min(event_at), max(event_at), count(*) FROM n GROUP BY user_id, s`,
      },
      {
        why: 'Without PARTITION BY, each event is compared with the previous event of any user, so one user’s activity hides the other’s gaps.',
        sql: `WITH f AS (SELECT user_id, event_at, lag(event_at) OVER (ORDER BY event_at) AS p FROM events),
              n AS (SELECT user_id, event_at,
                           sum(CASE WHEN p IS NULL OR event_at - p > INTERVAL '30 minutes' THEN 1 ELSE 0 END)
                             OVER (ORDER BY event_at ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS s
                    FROM f)
              SELECT user_id, s, min(event_at), max(event_at), count(*) FROM n GROUP BY user_id, s`,
      },
      {
        why: 'Grouping by the flag itself, without the running sum, puts every session-starting event of a user into one group.',
        sql: `WITH f AS (SELECT user_id, event_at, lag(event_at) OVER (PARTITION BY user_id ORDER BY event_at) AS p FROM events),
              n AS (SELECT user_id, event_at,
                           CASE WHEN p IS NULL OR event_at - p > INTERVAL '30 minutes' THEN 1 ELSE 0 END AS s
                    FROM f)
              SELECT user_id, s, min(event_at), max(event_at), count(*) FROM n GROUP BY user_id, s`,
      },
    ],
  },
});
