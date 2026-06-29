/**
 * Turn raw wallet / contract / RPC errors into short, human messages.
 *
 * Wallet and node errors are huge, nested, and full of hex — never show them
 * to a user. We pattern-match the common cases and fall back to a calm generic
 * line. Keep every message one sentence and actionable.
 */
type Ctx = 'stake' | 'claim' | 'approve' | 'connect';

function raw(e: unknown): string {
  if (!e) return '';
  if (typeof e === 'string') return e;
  if (e instanceof Error) {
    // viem nests the useful bit in .shortMessage / .cause / .details
    const anyE = e as Error & { shortMessage?: string; details?: string; cause?: unknown };
    return [anyE.shortMessage, anyE.message, anyE.details, raw(anyE.cause)]
      .filter(Boolean)
      .join(' · ');
  }
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

export function friendlyError(e: unknown, ctx: Ctx = 'stake'): string {
  const s = raw(e).toLowerCase();

  // User dismissed the wallet prompt — not really an error.
  if (/user rejected|user denied|denied (the )?(transaction|request|signature)|request rejected|action_rejected|rejected by user|cancell?ed|4001/.test(s)) {
    return 'Cancelled — you dismissed the request in your wallet.';
  }

  // Not enough CRC to cover the stake (ERC-20 transferFrom reverts).
  if (/transfer amount exceeds balance|exceeds balance|insufficient balance|erc20:?\s*transfer|safeerc20|transferfrom|transfer_from_failed/.test(s)) {
    return "Not enough CRC — you don't have enough Circles for this stake. Lower the amount or top up your wallet.";
  }

  // Allowance not set (should be auto-approved, but just in case).
  if (/insufficient allowance|exceeds allowance|erc20:?\s*insufficient/.test(s)) {
    return 'Approval needed — approve CRC spending in your wallet, then try again.';
  }

  // No xDAI to pay the network fee.
  if (/insufficient funds for (gas|intrinsic)|out of gas|gas required exceeds|max fee per gas|fee.*exceeds balance|insufficient funds for transfer/.test(s)) {
    return 'Not enough xDAI for the network fee — add a little xDAI to your wallet and try again.';
  }

  // Match-state custom errors from GolazoPool.
  if (/stakingclosed|staking closed|staking is closed/.test(s)) return 'Staking has closed — this match already kicked off.';
  if (/matchnotopen|matchnotfound|match not (open|found)|matchnotresolvable/.test(s)) return "This pool isn't open for staking right now.";
  if (/kickoffinpast/.test(s)) return 'That kickoff time has already passed.';
  if (/alreadyclaimed|already claimed/.test(s)) return 'You already claimed this match.';
  if (/nothingtoclaim|nothing to claim/.test(s)) return ctx === 'claim' ? 'Nothing to claim here yet.' : 'Nothing to do here yet.';
  if (/zerostake|zero stake/.test(s)) return 'Enter an amount greater than zero.';
  if (/invalidoutcome|invalidresult/.test(s)) return 'Pick a result first.';
  if (/invalidsignature/.test(s)) return "Couldn't verify the result signature.";

  // Network / RPC trouble.
  if (/timeout|timed out|deadline|network error|fetch failed|failed to fetch|econn|enotfound|eai_again|503|502|504|rate.?limit|too many requests|nonce|replacement transaction underpriced/.test(s)) {
    return 'Network hiccup — please try again in a moment.';
  }

  // Calm, generic fallback — never dump the raw error.
  switch (ctx) {
    case 'claim':
      return "Couldn't complete the claim. Please try again.";
    case 'connect':
      return "Couldn't connect your wallet. Please try again.";
    default:
      return "Couldn't place your stake — nothing was charged. Please try again.";
  }
}
