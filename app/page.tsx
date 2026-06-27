'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Address } from 'viem';
import { useWallet } from '@/components/wallet/WalletProvider';
import { Header } from '@/components/golazo/Header';
import { MatchCard } from '@/components/golazo/MatchCard';
import { ReferralPanel } from '@/components/golazo/ReferralPanel';
import { FIXTURES } from '@/lib/fixtures';
import { isConfigured, type OutcomeId } from '@/lib/contracts';
import {
  readMatch,
  readUserStake,
  previewPayout,
  readReferralStats,
  readCrcBalance,
  buildStakeTxs,
  buildClaimTx,
  buildClaimReferralTx,
  send,
  type MatchState,
  type ReferralStats,
} from '@/lib/golazo';

type Stakes = Record<string, { home: bigint; draw: bigint; away: bigint }>;
type Payouts = Record<string, bigint>;

export default function Home() {
  const { address, isConnected } = useWallet();

  const [now, setNow] = useState(() => Date.now());
  const [states, setStates] = useState<Record<string, MatchState | null>>({});
  const [stakes, setStakes] = useState<Stakes>({});
  const [payouts, setPayouts] = useState<Payouts>({});
  const [referral, setReferral] = useState<ReferralStats>({ count: 0n, credits: 0n, bounty: 0n });
  const [balance, setBalance] = useState<bigint | null>(null);
  const [referrer, setReferrer] = useState<Address | null>(null);
  const [busyRef, setBusyRef] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err' | 'info'; msg: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flash(kind: 'ok' | 'err' | 'info', msg: string) {
    setToast({ kind, msg });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  }

  // Capture referrer from ?ref= (persists across the connect redirect).
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const r = url.searchParams.get('ref');
      const stored = window.localStorage.getItem('golazo_ref');
      const ref = (r || stored) as Address | null;
      if (r && /^0x[a-fA-F0-9]{40}$/.test(r)) {
        window.localStorage.setItem('golazo_ref', r);
        setReferrer(r as Address);
      } else if (ref && /^0x[a-fA-F0-9]{40}$/.test(ref)) {
        setReferrer(ref as Address);
      }
    } catch {
      /* no-op */
    }
  }, []);

  // Clock for countdowns.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Read all pool states (works without a wallet).
  const refreshPools = useCallback(async () => {
    const entries = await Promise.all(
      FIXTURES.map(async (f) => [f.ref, await readMatch(f.ref)] as const)
    );
    setStates(Object.fromEntries(entries));
  }, []);

  // Read the connected user's positions + referral + balance.
  const refreshUser = useCallback(async () => {
    if (!address) {
      setStakes({});
      setPayouts({});
      setReferral({ count: 0n, credits: 0n, bounty: 0n });
      setBalance(null);
      return;
    }
    const [stk, pay, ref, bal] = await Promise.all([
      Promise.all(FIXTURES.map(async (f) => [f.ref, await readUserStake(f.ref, address)] as const)),
      Promise.all(FIXTURES.map(async (f) => [f.ref, await previewPayout(f.ref, address)] as const)),
      readReferralStats(address),
      readCrcBalance(address),
    ]);
    setStakes(Object.fromEntries(stk));
    setPayouts(Object.fromEntries(pay));
    setReferral(ref);
    setBalance(bal);
  }, [address]);

  useEffect(() => {
    refreshPools();
    const t = setInterval(refreshPools, 15000);
    return () => clearInterval(t);
  }, [refreshPools]);

  useEffect(() => {
    refreshUser();
    const t = setInterval(refreshUser, 15000);
    return () => clearInterval(t);
  }, [refreshUser]);

  async function handleStake(ref: string, outcome: OutcomeId, amount: string) {
    if (!address) return flash('info', 'Connect your wallet first.');
    setBusyRef(ref);
    try {
      const txs = await buildStakeTxs({ user: address, ref, outcome, amount, referrer });
      await send(txs);
      flash('ok', `Backed ${amount} CRC. Good luck! ⚽`);
      await Promise.all([refreshPools(), refreshUser()]);
    } catch (e) {
      flash('err', e instanceof Error ? e.message.slice(0, 90) : 'Stake failed.');
    } finally {
      setBusyRef(null);
    }
  }

  async function handleClaim(ref: string) {
    setBusyRef(ref);
    try {
      await send([buildClaimTx(ref)]);
      flash('ok', 'Winnings claimed 🏆');
      await Promise.all([refreshPools(), refreshUser()]);
    } catch (e) {
      flash('err', e instanceof Error ? e.message.slice(0, 90) : 'Claim failed.');
    } finally {
      setBusyRef(null);
    }
  }

  async function handleClaimReferral() {
    setBusyRef('__ref__');
    try {
      await send([buildClaimReferralTx()]);
      flash('ok', 'Referral earnings withdrawn 🎁');
      await refreshUser();
    } catch (e) {
      flash('err', e instanceof Error ? e.message.slice(0, 90) : 'Claim failed.');
    } finally {
      setBusyRef(null);
    }
  }

  const live = FIXTURES.filter((f) => {
    const s = states[f.ref];
    const k = (s?.kickoffTime ?? Date.parse(f.kickoff) / 1000) * 1000;
    return now < k && s?.status !== 'Resolved';
  });
  const settled = FIXTURES.filter((f) => states[f.ref]?.status === 'Resolved' || states[f.ref]?.status === 'Voided');

  return (
    <div className="min-h-full pb-24">
      <Header balance={balance} />

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-4 pt-6 pb-2 text-center">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          Call the <span className="gold-text">knockouts</span>. Split the pot.
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-xl mx-auto">
          No bookie, no fixed odds. Back a result with your Circles, and if the crowd that called it
          right is small, your slice is big. Round of 32 → the Final.
        </p>
        {referrer && (
          <div className="mt-3 inline-block pill bg-muted px-3 py-1 text-xs">
            🎁 Invited by <span className="font-mono">{referrer.slice(0, 6)}…{referrer.slice(-4)}</span> — your first stake lands them a bounty.
          </div>
        )}
      </section>

      {!isConfigured() && (
        <div className="mx-auto max-w-3xl px-4 my-3">
          <div className="card p-3 text-xs text-muted-foreground border-gold/40">
            <strong className="text-gold">Preview mode.</strong> Pools go live once{' '}
            <code className="font-mono">NEXT_PUBLIC_GOLAZO_POOL</code> is set to the deployed
            GolazoPool address. Fixtures and odds below are illustrative until then.
          </div>
        </div>
      )}

      {/* Referral */}
      <section className="mx-auto max-w-3xl px-4 mt-3">
        <ReferralPanel stats={referral} busy={busyRef === '__ref__'} onClaim={handleClaimReferral} />
      </section>

      {/* Live matches */}
      <section className="mx-auto max-w-3xl px-4 mt-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
          <span className="live-dot h-2 w-2 rounded-full bg-primary" /> Open pools
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {live.map((f) => (
            <MatchCard
              key={f.ref}
              fixture={f}
              state={states[f.ref] ?? null}
              userStake={stakes[f.ref] ?? { home: 0n, draw: 0n, away: 0n }}
              payout={payouts[f.ref] ?? 0n}
              now={now}
              connected={isConnected}
              busyRef={busyRef}
              onStake={handleStake}
              onClaim={handleClaim}
            />
          ))}
        </div>
      </section>

      {/* Settled */}
      {settled.length > 0 && (
        <section className="mx-auto max-w-3xl px-4 mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Results</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {settled.map((f) => (
              <MatchCard
                key={f.ref}
                fixture={f}
                state={states[f.ref] ?? null}
                userStake={stakes[f.ref] ?? { home: 0n, draw: 0n, away: 0n }}
                payout={payouts[f.ref] ?? 0n}
                now={now}
                connected={isConnected}
                busyRef={busyRef}
                onStake={handleStake}
                onClaim={handleClaim}
              />
            ))}
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="mx-auto max-w-3xl px-4 mt-8">
        <div className="card p-4">
          <h2 className="font-bold mb-2">How Golazo works</h2>
          <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
            <li>Pick a match and back <strong>Home</strong>, <strong>Draw</strong> or <strong>Away</strong> with CRC.</li>
            <li>Everyone&apos;s stake flows into one pool. The live bar is the crowd&apos;s real-time odds.</li>
            <li>The oracle posts the final result on-chain (cryptographically signed — no one can fake it).</li>
            <li>Backers of the winning result split the whole pool, pro-rata to their stake.</li>
            <li>Invite friends: an invite that lands a new wallet pays you an instant CRC bounty.</li>
          </ol>
        </div>
      </section>

      <footer className="mx-auto max-w-3xl px-4 mt-8 text-center text-[11px] text-muted-foreground">
        Built on Circles · Gnosis Chain · parimutuel pools, settled in CRC. Predictions are for fun —
        only stake what you can afford.
      </footer>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 px-4">
          <div
            className="pill px-4 py-2.5 text-sm font-medium shadow-lg"
            style={{
              background:
                toast.kind === 'ok' ? 'var(--primary)' : toast.kind === 'err' ? 'var(--away)' : 'var(--muted)',
              color: toast.kind === 'info' ? 'var(--foreground)' : 'var(--primary-foreground)',
            }}
          >
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}
