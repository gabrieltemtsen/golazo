# Golazo ⚽

Parimutuel World Cup 2026 prediction pools, staked in Circles (CRC) on Gnosis Chain.

No house, no fixed odds: back **Home / Draw / Away** with CRC, and the crowd that called a
match right splits the whole pool. Invite a friend and the contract pays you a bounty the
moment their new Circles wallet places its first stake.

- **Frontend:** Next.js 16 mini-app embedded in the Circles host (this folder).
- **Contract:** [`../golazo-contracts`](../golazo-contracts) — `GolazoPool.sol` + 26 passing tests.
- **Full write-up & judging-criteria mapping:** [`SUBMISSION.md`](./SUBMISSION.md).

## Quickstart

```bash
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_GOLAZO_POOL + NEXT_PUBLIC_CRC_TOKEN
npm run dev
```

Then open it inside Circles:
`https://circles.gnosis.io/playground?url=http://localhost:3000`

Without a deployed pool address the app runs in **preview mode** — fixtures and odds render so
you can see the UX before wiring the contract.

## How it fits the Circles mini-app brief

Stakes, payouts, and referral bounties are all denominated in personal CRC and flow through
the user's host Safe via the trust graph. The referral system rewards the exact event Circles
cares about — an invite that lands a new active wallet — as a first-class on-chain bounty.
See `SUBMISSION.md` for the detailed breakdown.
