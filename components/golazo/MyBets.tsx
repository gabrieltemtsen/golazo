'use client';

import type { Fixture } from '@/lib/fixtures';
import type { MatchState } from '@/lib/golazo';
import { OUTCOME, type OutcomeId } from '@/lib/contracts';
import { fmtCrc, countdown } from '@/lib/format';

export type BetRow = {
  fixture: Fixture;
  state: MatchState | null;
  stake: { home: bigint; draw: bigint; away: bigint };
  payout: bigint;
  claimed: boolean;
};

/**
 * A single place that answers "where are my stakes?" — every match the user
 * has backed, with amounts and live status, each row jumping to its card.
 */
export function MyBets({ rows, now }: { rows: BetRow[]; now: number }) {
  if (rows.length === 0) return null;

  const total = rows.reduce((a, r) => a + r.stake.home + r.stake.draw + r.stake.away, 0n);
  const claimable = rows.reduce(
    (a, r) =>
      a +
      ((r.state?.status === 'Resolved' || r.state?.status === 'Voided') && !r.claimed ? r.payout : 0n),
    0n
  );

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold flex items-center gap-2">
          🎟️ Your bets <span className="text-muted-foreground font-normal text-sm">· {rows.length}</span>
        </h2>
        <span className="text-sm font-mono">{fmtCrc(total)} CRC in play</span>
      </div>

      <div className="space-y-2">
        {rows.map((r) => {
          const labels: Record<OutcomeId, string> = {
            [OUTCOME.NONE]: '',
            [OUTCOME.HOME]: r.fixture.home.code,
            [OUTCOME.DRAW]: 'Draw',
            [OUTCOME.AWAY]: r.fixture.away.code,
          };
          const picks = ([OUTCOME.HOME, OUTCOME.DRAW, OUTCOME.AWAY] as OutcomeId[])
            .map((o) => ({
              o,
              amt: o === OUTCOME.HOME ? r.stake.home : o === OUTCOME.DRAW ? r.stake.draw : r.stake.away,
            }))
            .filter((p) => p.amt > 0n);

          const status = r.state?.status ?? 'None';
          const kickoff = (r.state?.kickoffTime ?? Date.parse(r.fixture.kickoff) / 1000) * 1000;
          const locked = now > 0 && now >= kickoff;

          let chipText = 'Open';
          let chipColor = 'var(--primary)';
          if (status === 'Resolved') {
            if (r.claimed) {
              chipText = r.payout > 0n ? `Claimed +${fmtCrc(r.payout)}` : 'No win';
              chipColor = 'var(--muted-foreground)';
            } else {
              chipText = r.payout > 0n ? `Won +${fmtCrc(r.payout)}` : 'No win';
              chipColor = r.payout > 0n ? 'var(--gold)' : 'var(--muted-foreground)';
            }
          } else if (status === 'Voided') {
            chipText = r.claimed ? 'Refunded ✓' : `Refund ${fmtCrc(r.payout)}`;
            chipColor = r.claimed ? 'var(--muted-foreground)' : 'var(--draw)';
          } else if (locked) {
            chipText = 'Locked';
            chipColor = 'var(--muted-foreground)';
          } else if (now > 0) {
            chipText = `${countdown(kickoff, now)} left`;
          }

          return (
            <a
              key={r.fixture.ref}
              href={`#match-${r.fixture.ref}`}
              className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-2 hover:bg-muted transition"
            >
              <span className="flex items-center gap-1.5 min-w-0 shrink-0">
                <span aria-hidden>{r.fixture.home.flag}</span>
                <span className="text-sm font-semibold">
                  {r.fixture.home.code}–{r.fixture.away.code}
                </span>
                <span aria-hidden>{r.fixture.away.flag}</span>
              </span>
              <span className="font-mono text-xs text-muted-foreground truncate flex-1 text-right">
                {picks.map((p) => `${fmtCrc(p.amt)} ${labels[p.o]}`).join(' · ')}
              </span>
              <span
                className="font-mono text-xs whitespace-nowrap shrink-0"
                style={{ color: chipColor }}
              >
                {chipText}
              </span>
            </a>
          );
        })}
      </div>

      {claimable > 0n && (
        <p className="text-[11px] text-muted-foreground mt-2.5">
          💰 {fmtCrc(claimable)} CRC ready to claim — open the match below and tap claim.
        </p>
      )}
    </div>
  );
}
