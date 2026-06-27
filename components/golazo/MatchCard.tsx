'use client';

import { useMemo, useState } from 'react';
import type { Fixture } from '@/lib/fixtures';
import type { MatchState } from '@/lib/golazo';
import { OUTCOME, type OutcomeId } from '@/lib/contracts';
import { fmtCrc, impliedPct, decimalOdds, countdown } from '@/lib/format';

type UserStake = { home: bigint; draw: bigint; away: bigint };

type Props = {
  fixture: Fixture;
  state: MatchState | null;
  userStake: UserStake;
  payout: bigint;
  now: number;
  connected: boolean;
  busyRef: string | null;
  onStake: (ref: string, outcome: OutcomeId, amount: string) => void;
  onClaim: (ref: string) => void;
};

const PRESETS = ['1', '5', '10', '25'];

export function MatchCard({
  fixture,
  state,
  userStake,
  payout,
  now,
  connected,
  busyRef,
  onStake,
  onClaim,
}: Props) {
  const [pick, setPick] = useState<OutcomeId | null>(null);
  const [amount, setAmount] = useState('5');

  const pool = state?.totalPool ?? 0n;
  const totals = useMemo<Record<OutcomeId, bigint>>(
    () => ({
      [OUTCOME.NONE]: 0n,
      [OUTCOME.HOME]: state?.homeTotal ?? 0n,
      [OUTCOME.DRAW]: state?.drawTotal ?? 0n,
      [OUTCOME.AWAY]: state?.awayTotal ?? 0n,
    }),
    [state]
  );

  const kickoffMs = (state?.kickoffTime ?? Math.floor(Date.parse(fixture.kickoff) / 1000)) * 1000;
  const locked = now >= kickoffMs;
  const status = state?.status ?? 'None';
  const resolved = status === 'Resolved';
  const voided = status === 'Voided';
  const open = status === 'Open' && !locked;

  const myTotal = userStake.home + userStake.draw + userStake.away;
  const hasBet = myTotal > 0n;
  const busy = busyRef === fixture.ref;

  const outcomeLabels: Record<OutcomeId, string> = {
    [OUTCOME.NONE]: '',
    [OUTCOME.HOME]: fixture.home.code,
    [OUTCOME.DRAW]: 'Draw',
    [OUTCOME.AWAY]: fixture.away.code,
  };
  const colorVar: Record<OutcomeId, string> = {
    [OUTCOME.NONE]: 'var(--muted)',
    [OUTCOME.HOME]: 'var(--home)',
    [OUTCOME.DRAW]: 'var(--draw)',
    [OUTCOME.AWAY]: 'var(--away)',
  };

  const myOutcome: OutcomeId | null =
    userStake.home > 0n ? OUTCOME.HOME : userStake.draw > 0n ? OUTCOME.DRAW : userStake.away > 0n ? OUTCOME.AWAY : null;
  const won = resolved && state && myOutcome === state.result && payout > 0n;
  const lost = resolved && state && myOutcome !== null && myOutcome !== state.result;

  return (
    <div className="card p-4">
      {/* Status row */}
      <div className="flex items-center justify-between mb-3 text-[11px] text-muted-foreground">
        <span className="font-mono">{fixture.group}</span>
        <span className="pill px-2 py-0.5 bg-muted">
          {resolved ? '✅ Final' : voided ? '↩ Void · refunded' : locked ? '🔒 Kicked off' : `⏱ ${countdown(kickoffMs, now)}`}
        </span>
      </div>

      {/* Teams */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-4">
        <Team flag={fixture.home.flag} name={fixture.home.name} win={resolved && state?.result === OUTCOME.HOME} align="right" />
        <div className="text-center">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{fixture.venue}</div>
          <div className="font-mono text-sm text-muted-foreground">vs</div>
        </div>
        <Team flag={fixture.away.flag} name={fixture.away.name} win={resolved && state?.result === OUTCOME.AWAY} align="left" />
      </div>

      {/* Live crowd-odds bar */}
      <div className="odds-track mb-1.5">
        {([OUTCOME.HOME, OUTCOME.DRAW, OUTCOME.AWAY] as OutcomeId[]).map((o) => {
          const pct = impliedPct(totals[o], pool);
          return (
            <div
              key={o}
              style={{ width: `${pool === 0n ? 33.33 : pct}%`, background: colorVar[o] }}
              title={`${outcomeLabels[o]} ${pct.toFixed(0)}%`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground mb-3 font-mono">
        <span>{outcomeLabels[OUTCOME.HOME]} {impliedPct(totals[OUTCOME.HOME], pool).toFixed(0)}%</span>
        <span>Draw {impliedPct(totals[OUTCOME.DRAW], pool).toFixed(0)}%</span>
        <span>{outcomeLabels[OUTCOME.AWAY]} {impliedPct(totals[OUTCOME.AWAY], pool).toFixed(0)}%</span>
      </div>

      {/* Outcome buttons with live parimutuel odds */}
      {open && (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {([OUTCOME.HOME, OUTCOME.DRAW, OUTCOME.AWAY] as OutcomeId[]).map((o) => {
              const odds = decimalOdds(totals[o], pool);
              const selected = pick === o;
              return (
                <button
                  key={o}
                  onClick={() => setPick(o)}
                  className="rounded-md border px-2 py-2 text-center transition"
                  style={{
                    borderColor: selected ? colorVar[o] : 'var(--border)',
                    background: selected ? `color-mix(in oklch, ${colorVar[o]} 22%, transparent)` : 'transparent',
                  }}
                >
                  <div className="text-xs font-semibold">{outcomeLabels[o]}</div>
                  <div className="font-mono text-sm" style={{ color: colorVar[o] }}>
                    {odds > 0 ? `${odds.toFixed(2)}×` : '—'}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Amount + stake */}
          <div className="flex items-center gap-2 mb-1">
            <div className="flex gap-1">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setAmount(p)}
                  className="pill px-2.5 py-1 text-xs bg-muted"
                  style={{ outline: amount === p ? '1px solid var(--primary)' : 'none' }}
                >
                  {p}
                </button>
              ))}
            </div>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              inputMode="decimal"
              className="w-16 bg-muted rounded-md px-2 py-1 text-sm font-mono text-right"
            />
            <span className="text-xs text-muted-foreground">CRC</span>
          </div>

          <button
            disabled={!connected || pick === null || !amount || Number(amount) <= 0 || busy}
            onClick={() => pick !== null && onStake(fixture.ref, pick, amount)}
            className="w-full mt-2 pill bg-primary text-primary-foreground font-bold py-2.5 disabled:opacity-50"
          >
            {busy
              ? 'Submitting…'
              : !connected
              ? 'Connect to back a result'
              : pick === null
              ? 'Pick a result'
              : `Back ${outcomeLabels[pick]} · win ~${(decimalOdds(totals[pick], pool) * Number(amount || 0)).toFixed(1)} CRC`}
          </button>
        </>
      )}

      {/* Your position */}
      {hasBet && (
        <div className="mt-3 rounded-md bg-muted/60 p-2.5 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Your stake</span>
            <span className="font-mono">
              {myOutcome !== null ? `${fmtCrc(totals[myOutcome] === 0n ? 0n : myTotal)} CRC on ${outcomeLabels[myOutcome]}` : ''}
            </span>
          </div>
          {resolved && (
            <div className="flex justify-between mt-1">
              <span className="text-muted-foreground">{won ? '🏆 You called it' : lost ? 'Result' : 'Payout'}</span>
              <span className="font-mono font-semibold" style={{ color: won ? 'var(--gold)' : 'var(--muted-foreground)' }}>
                {won ? `+${fmtCrc(payout)} CRC` : lost ? 'No payout' : '—'}
              </span>
            </div>
          )}
          {(won || voided) && payout > 0n && (
            <button
              disabled={busy}
              onClick={() => onClaim(fixture.ref)}
              className="w-full mt-2 pill font-bold py-2 text-primary-foreground"
              style={{ background: 'var(--gold)' }}
            >
              {busy ? 'Claiming…' : voided ? `Claim refund · ${fmtCrc(payout)} CRC` : `Claim winnings · ${fmtCrc(payout)} CRC`}
            </button>
          )}
        </div>
      )}

      {/* Pool footer */}
      <div className="mt-3 pt-2 border-t border-border/60 flex justify-between text-[11px] text-muted-foreground font-mono">
        <span>Pool {fmtCrc(pool)} CRC</span>
        <span>{status === 'None' ? 'opening soon' : 'parimutuel · no house'}</span>
      </div>
    </div>
  );
}

function Team({ flag, name, win, align }: { flag: string; name: string; win?: boolean; align: 'left' | 'right' }) {
  return (
    <div className={`flex items-center gap-2 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      <span className="text-2xl" aria-hidden>{flag}</span>
      <span className={`text-sm font-semibold ${win ? 'gold-text' : ''}`}>{name}</span>
    </div>
  );
}
