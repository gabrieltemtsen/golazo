import {
  createPublicClient,
  http,
  keccak256,
  toBytes,
  type Address,
} from 'viem';
import { gnosis } from 'viem/chains';

/** Deployed GolazoPool + the CRC ERC-20 it settles in. Set via env. */
export const GOLAZO_POOL = (process.env.NEXT_PUBLIC_GOLAZO_POOL ??
  '0x0000000000000000000000000000000000000000') as Address;

export const CRC_TOKEN = (process.env.NEXT_PUBLIC_CRC_TOKEN ??
  '0x0000000000000000000000000000000000000000') as Address;

export const isConfigured = () =>
  GOLAZO_POOL !== '0x0000000000000000000000000000000000000000';

export const publicClient = createPublicClient({
  chain: gnosis,
  transport: http(
    process.env.NEXT_PUBLIC_GNOSIS_RPC ?? 'https://rpc.gnosischain.com'
  ),
});

/** On-chain matchId for a fixture ref (matches the contract + deploy script). */
export function matchIdOf(ref: string): `0x${string}` {
  return keccak256(toBytes(ref));
}

export const OUTCOME = { NONE: 0, HOME: 1, DRAW: 2, AWAY: 3 } as const;
export type OutcomeId = (typeof OUTCOME)[keyof typeof OUTCOME];

/** Minimal ABI — only what the miniapp reads/writes. */
export const GOLAZO_ABI = [
  {
    type: 'function',
    name: 'getMatch',
    stateMutability: 'view',
    inputs: [{ name: 'matchId', type: 'bytes32' }],
    outputs: [
      { name: 'status', type: 'uint8' },
      { name: 'result', type: 'uint8' },
      { name: 'kickoffTime', type: 'uint64' },
      { name: 'totalPool', type: 'uint256' },
      { name: 'homeTotal', type: 'uint256' },
      { name: 'drawTotal', type: 'uint256' },
      { name: 'awayTotal', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'getUserStake',
    stateMutability: 'view',
    inputs: [
      { name: 'matchId', type: 'bytes32' },
      { name: 'user', type: 'address' },
    ],
    outputs: [
      { name: 'home', type: 'uint256' },
      { name: 'draw', type: 'uint256' },
      { name: 'away', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'previewPayout',
    stateMutability: 'view',
    inputs: [
      { name: 'matchId', type: 'bytes32' },
      { name: 'user', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'referralCount',
    stateMutability: 'view',
    inputs: [{ name: 'referrer', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'referralCredits',
    stateMutability: 'view',
    inputs: [{ name: 'referrer', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'newWalletBounty',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'hasPlayed',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'stake',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'matchId', type: 'bytes32' },
      { name: 'outcome', type: 'uint8' },
      { name: 'amount', type: 'uint256' },
      { name: 'referrer', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'claim',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'matchId', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'claimReferral',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'event',
    name: 'ReferralLanded',
    inputs: [
      { name: 'referrer', type: 'address', indexed: true },
      { name: 'newWallet', type: 'address', indexed: true },
      { name: 'bounty', type: 'uint256', indexed: false },
    ],
  },
] as const;

export const ERC20_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;
