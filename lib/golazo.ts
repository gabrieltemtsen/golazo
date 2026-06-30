/**
 * Golazo read/write layer.
 *
 * Reads hit the Gnosis RPC directly via viem (no wallet needed) so the app
 * shows live pool odds to anyone. Writes are returned as plain {to,data,value}
 * txs handed to the Circles miniapp SDK's sendTransactions, which routes them
 * through the user's host Safe.
 */
import {
  encodeFunctionData,
  parseUnits,
  type Address,
  type Hex,
} from 'viem';
import {
  publicClient,
  GOLAZO_POOL,
  CRC_TOKEN,
  GOLAZO_ABI,
  ERC20_ABI,
  matchIdOf,
  isConfigured,
  type OutcomeId,
} from './contracts';
import { CRC_DECIMALS } from './format';

export const STATUS = ['None', 'Open', 'Resolved', 'Voided'] as const;
export type StatusName = (typeof STATUS)[number];

export type MatchState = {
  ref: string;
  matchId: Hex;
  status: StatusName;
  result: OutcomeId;
  kickoffTime: number; // unix seconds
  totalPool: bigint;
  homeTotal: bigint;
  drawTotal: bigint;
  awayTotal: bigint;
};

export async function readMatch(ref: string): Promise<MatchState | null> {
  if (!isConfigured()) return null;
  const matchId = matchIdOf(ref);
  try {
    const r = (await publicClient.readContract({
      address: GOLAZO_POOL,
      abi: GOLAZO_ABI,
      functionName: 'getMatch',
      args: [matchId],
    })) as readonly [number, number, bigint, bigint, bigint, bigint, bigint];
    return {
      ref,
      matchId,
      status: STATUS[r[0]] ?? 'None',
      result: r[1] as OutcomeId,
      kickoffTime: Number(r[2]),
      totalPool: r[3],
      homeTotal: r[4],
      drawTotal: r[5],
      awayTotal: r[6],
    };
  } catch {
    return null;
  }
}

export async function readUserStake(
  ref: string,
  user: Address
): Promise<{ home: bigint; draw: bigint; away: bigint }> {
  if (!isConfigured()) return { home: 0n, draw: 0n, away: 0n };
  try {
    const r = (await publicClient.readContract({
      address: GOLAZO_POOL,
      abi: GOLAZO_ABI,
      functionName: 'getUserStake',
      args: [matchIdOf(ref), user],
    })) as readonly [bigint, bigint, bigint];
    return { home: r[0], draw: r[1], away: r[2] };
  } catch {
    return { home: 0n, draw: 0n, away: 0n };
  }
}

export async function readClaimed(ref: string, user: Address): Promise<boolean> {
  if (!isConfigured()) return false;
  try {
    return (await publicClient.readContract({
      address: GOLAZO_POOL,
      abi: GOLAZO_ABI,
      functionName: 'claimed',
      args: [matchIdOf(ref), user],
    })) as boolean;
  } catch {
    return false;
  }
}

export async function previewPayout(ref: string, user: Address): Promise<bigint> {
  if (!isConfigured()) return 0n;
  try {
    return (await publicClient.readContract({
      address: GOLAZO_POOL,
      abi: GOLAZO_ABI,
      functionName: 'previewPayout',
      args: [matchIdOf(ref), user],
    })) as bigint;
  } catch {
    return 0n;
  }
}

export type ReferralStats = {
  count: bigint;
  credits: bigint;
  bounty: bigint;
};

export async function readReferralStats(user: Address): Promise<ReferralStats> {
  if (!isConfigured()) return { count: 0n, credits: 0n, bounty: 0n };
  try {
    const [count, credits, bounty] = await Promise.all([
      publicClient.readContract({
        address: GOLAZO_POOL,
        abi: GOLAZO_ABI,
        functionName: 'referralCount',
        args: [user],
      }) as Promise<bigint>,
      publicClient.readContract({
        address: GOLAZO_POOL,
        abi: GOLAZO_ABI,
        functionName: 'referralCredits',
        args: [user],
      }) as Promise<bigint>,
      publicClient.readContract({
        address: GOLAZO_POOL,
        abi: GOLAZO_ABI,
        functionName: 'newWalletBounty',
        args: [],
      }) as Promise<bigint>,
    ]);
    return { count, credits, bounty };
  } catch {
    return { count: 0n, credits: 0n, bounty: 0n };
  }
}

export async function readCrcBalance(user: Address): Promise<bigint> {
  if (!isConfigured()) return 0n;
  try {
    return (await publicClient.readContract({
      address: CRC_TOKEN,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [user],
    })) as bigint;
  } catch {
    return 0n;
  }
}

async function readAllowance(user: Address): Promise<bigint> {
  try {
    return (await publicClient.readContract({
      address: CRC_TOKEN,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [user, GOLAZO_POOL],
    })) as bigint;
  } catch {
    return 0n;
  }
}

export type Tx = { to: Address; data: Hex; value: string };

/**
 * Build the tx batch to stake: an approve (only if allowance is short) then
 * the stake call. The Circles SDK executes them atomically via the Safe.
 */
export async function buildStakeTxs(args: {
  user: Address;
  ref: string;
  outcome: OutcomeId;
  amount: string;
  referrer?: Address | null;
}): Promise<Tx[]> {
  const amountWei = parseUnits(args.amount, CRC_DECIMALS);
  const txs: Tx[] = [];

  const allowance = await readAllowance(args.user);
  if (allowance < amountWei) {
    txs.push({
      to: CRC_TOKEN,
      data: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [GOLAZO_POOL, amountWei],
      }),
      value: '0',
    });
  }

  txs.push({
    to: GOLAZO_POOL,
    data: encodeFunctionData({
      abi: GOLAZO_ABI,
      functionName: 'stake',
      args: [
        matchIdOf(args.ref),
        args.outcome,
        amountWei,
        (args.referrer ?? '0x0000000000000000000000000000000000000000') as Address,
      ],
    }),
    value: '0',
  });

  return txs;
}

export function buildClaimTx(ref: string): Tx {
  return {
    to: GOLAZO_POOL,
    data: encodeFunctionData({
      abi: GOLAZO_ABI,
      functionName: 'claim',
      args: [matchIdOf(ref)],
    }),
    value: '0',
  };
}

export function buildClaimReferralTx(): Tx {
  return {
    to: GOLAZO_POOL,
    data: encodeFunctionData({
      abi: GOLAZO_ABI,
      functionName: 'claimReferral',
      args: [],
    }),
    value: '0',
  };
}

/** Send a tx batch through the Circles host Safe. Returns the last tx hash. */
export async function send(txs: Tx[]): Promise<Hex> {
  const { sendTransactions } = await import('@aboutcircles/miniapp-sdk');
  const hashes = await sendTransactions(txs);
  return hashes[hashes.length - 1] as Hex;
}
