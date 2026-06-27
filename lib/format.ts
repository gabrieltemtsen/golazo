import { formatUnits } from 'viem';

export const CRC_DECIMALS = 18;

/** Format a CRC wei bigint to a short human string. */
export function fmtCrc(wei: bigint, max = 2): string {
  const n = Number(formatUnits(wei, CRC_DECIMALS));
  if (n === 0) return '0';
  if (n < 0.01) return '<0.01';
  return n.toLocaleString(undefined, { maximumFractionDigits: max });
}

/** Implied probability % for an outcome from the live pool split. */
export function impliedPct(outcomeTotal: bigint, poolTotal: bigint): number {
  if (poolTotal === 0n) return 0;
  return Number((outcomeTotal * 10000n) / poolTotal) / 100;
}

/** Parimutuel decimal odds: pool / outcomeStake (what 1 unit returns). */
export function decimalOdds(outcomeTotal: bigint, poolTotal: bigint): number {
  if (outcomeTotal === 0n) return 0;
  return Number((poolTotal * 100n) / outcomeTotal) / 100;
}

export function shortAddr(a?: string | null): string {
  if (!a) return '';
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function countdown(toMs: number, nowMs: number): string {
  const d = Math.max(0, toMs - nowMs);
  const h = Math.floor(d / 3.6e6);
  const m = Math.floor((d % 3.6e6) / 6e4);
  const s = Math.floor((d % 6e4) / 1000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
