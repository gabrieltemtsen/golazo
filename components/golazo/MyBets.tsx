'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Fixture } from '@/lib/fixtures';
import type { MatchState } from '@/lib/golazo';
import { OUTCOME, type OutcomeId } from '@/lib/contracts';
import { countdown } from '@/lib/format';
import { fmtDem } from '@/lib/demurrage';

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
export function MyBets({
  rows,
  now,
  onGoToClaim,
}: {
  rows: BetRow[];
  now: number;
  onGoToClaim?: () => void;
}) {
  const [open, setOpen] = useState(false);
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
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2"
        aria-expanded={open}
      >
        <h2 className="font-bold flex items-center gap-2">
          🎟️ Your bets <span className="text-muted-foreground font-normal text-sm">· {rows.length}</span>
        </h2>
        <span className="flex items-center gap-2">
          <span className="text-sm font-mono text-muted-foreground">{fmtDem(total)} in play</span>
          <ChevronDown
            size={16}
            className="text-muted-foreground transition-transform"
            style={{ transform: open ? 'rotate(180deg)' : 'none' }}
          />
        </span>
      </button>

      {claimable > 0n && (
        <button
          onClick={onGoToClaim}
          className="w-full mt-3 pill font-bold py-2.5 text-primary-foreground flex items-center justify-center gap-1.5"
          style={{ background: 'var(--gold)' }}
        >
          💰 Claim {fmtDem(claimable)} gCRC →
        </button>
      )}

      {open && (
      <div className="space-y-2 mt-3">
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
              chipText = r.payout > 0n ? `Claimed +${fmtDem(r.payout)}` : 'No win';
              chipColor = 'var(--muted-foreground)';
            } else {
              chipText = r.payout > 0n ? `Won +${fmtDem(r.payout)}` : 'No win';
              chipColor = r.payout > 0n ? 'var(--gold)' : 'var(--muted-foreground)';
            }
          } else if (status === 'Voided') {
            chipText = r.claimed ? 'Refunded ✓' : `Refund ${fmtDem(r.payout)}`;
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
                {picks.map((p) => `${fmtDem(p.amt)} ${labels[p.o]}`).join(' · ')}
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
      )}
    </div>
  );
}
