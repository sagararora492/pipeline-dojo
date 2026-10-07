import type { LessonStatus } from '../content/schema';

const DESCRIPTIONS: Record<LessonStatus, string> = {
  draft: 'Draft: not reviewed yet. Claims marked [VERIFY] are unconfirmed.',
  reviewed: 'Reviewed by a person, still waiting on final checks.',
  verified: 'Verified: sources checked and every exercise passes in CI.',
};

export function StatusBadge({ status }: { status: LessonStatus }) {
  return (
    <span className={`badge badge-${status}`} title={DESCRIPTIONS[status]}>
      {status}
    </span>
  );
}
