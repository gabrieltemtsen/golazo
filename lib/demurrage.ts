/**
 * Circles demurrage conversion.
 *
 * The gCRC ERC-20 we read is the *static / inflationary* representation: its
 * balanceOf doesn't visibly decay. Circles applies demurrage (~7%/yr since
 * 2020-10-15), so the value a wallet like Metri shows — the real, spendable
 * value today — is smaller. We convert static → demurraged for display, and
 * demurraged → static when building a stake tx, so what the user sees and what
 * they sign match their wallet.
 *
 * Demurrage is a single uniform factor, so ODDS and PERCENTAGES are unchanged
 * (it cancels in every ratio); only absolute amounts differ.
 *
 * Constants are the Circles v2 protocol values — verify against a live balance
 * (compare the header to Metri) before trusting exact figures.
 */
import { fmtCrc } from './format';

// Master switch. If the demurraged figures ever look wrong, set this to false
// (or NEXT_PUBLIC_DEMURRAGE=off) to fall back to raw static values instantly.
const DEMURRAGE_ENABLED = process.env.NEXT_PUBLIC_DEMURRAGE !== 'off';

// Circles inflation day zero: 2020-10-15 00:00:00 UTC.
const INFLATION_DAY_ZERO = 1602720000;
// Per-day demurrage factor: gamma^365.25 ≈ 0.93 (7% annual decay).
const GAMMA = 0.9998013320085989;

const SCALE = 1_000_000_000_000_000n; // 1e15 fixed-point for bigint math

function dayNow(atSec: number): number {
  return Math.floor((atSec - INFLATION_DAY_ZERO) / 86400);
}

/** Scaled demurrage factor (γ^day) as a bigint over SCALE. */
function factorScaled(atSec: number): bigint {
  const f = Math.pow(GAMMA, dayNow(atSec));
  return BigInt(Math.round(f * 1e15));
}

/** Static (inflationary) wei → demurraged wei, for display. */
export function toDemurraged(staticWei: bigint, atSec = Date.now() / 1000): bigint {
  if (!DEMURRAGE_ENABLED) return staticWei;
  return (staticWei * factorScaled(atSec)) / SCALE;
}

/** Demurraged wei → static wei, for building a transfer/stake tx. */
export function toStatic(demurragedWei: bigint, atSec = Date.now() / 1000): bigint {
  if (!DEMURRAGE_ENABLED) return demurragedWei;
  return (demurragedWei * SCALE) / factorScaled(atSec);
}

/** Format a static-wei amount as its demurraged human value. */
export function fmtDem(staticWei: bigint, max = 2): string {
  return fmtCrc(toDemurraged(staticWei), max);
}
