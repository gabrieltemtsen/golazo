# Golazo ⚽ — parimutuel World Cup pools on Circles

**Back a result in the World Cup 2026 knockouts with your Circles (CRC). No house, no
fixed odds — everyone's stake flows into one pool and the crowd that called it right
splits the pot. Invite a friend and the contract pays you a bounty the moment their new
wallet places its first stake.**

Built for the Circles mini-app track. Round of 32 → the Final, one pool per match, settled
on Gnosis Chain in CRC.

---

## Why this wins on the five criteria

The judges weigh five things. Golazo was designed backwards from them.

### 1. Depth of Circles-primitive use

- **CRC is the unit of account for the entire app.** Every pool, payout, rake and referral
  bounty is denominated in personal Circles tokens — not a side-token. The contract holds
  and pays CRC directly (`GolazoPool.sol`).
- **Stakes ride the trust graph.** The miniapp builds each stake as a Safe transaction batch
  routed through the Circles host wallet, so a fan funds a pool from their own Circles balance
  via the trust network rather than needing the pool's token directly.
- **The referral primitive rewards exactly what Circles values:** an invite that lands a
  *new active wallet*. That's a first-class on-chain event (`ReferralLanded`), not an
  off-chain analytics guess.
- **Oracle is domain-separated and trust-minimised:** results are signed off-chain and
  verified on-chain (ECDSA over `matchId · outcome · chainId · poolAddress`), the same proven
  pattern as the team's ChessBuddy escrow — extended here to a multi-outcome parimutuel.

### 2. Would a non-crypto person open it twice?

- **It's a World Cup pool, opening during the knockouts** — there's a new match to call almost
  every day from June 28 to the Final. The reason to come back is built into the tournament.
- **Zero jargon.** You see two flags, a live odds bar, three buttons (Home / Draw / Away), and
  a "win ~X CRC" preview. No order books, no slippage, no gas-token mental model.
- **Open twice loop:** stake today → come back when the match settles to claim → a new pool is
  already live for tomorrow's fixture. Settled results stay visible with your payout.

### 3. UX

- One-tap connect via the Circles host passkey/Safe flow; read-only browsing works with no
  wallet so the pools and odds are visible to anyone immediately.
- Live parimutuel odds render as a single colored bar that moves as the crowd bets; each
  outcome button shows real decimal odds (`pool / sideStake`).
- Approve + stake are bundled into one Safe batch — the user signs once.
- Optimistic toasts, countdown timers, preset stake chips, and a stadium-at-night theme.

### 4. Weekly referrals (invites that landed a new wallet)

This is a **contract-native** mechanic, not a tracked link:

- A user's referrer is recorded once, on their **first ever stake** (`referrerOf`).
- If that user is a brand-new wallet (`hasPlayed == false`), the referrer is immediately
  credited a **CRC bounty from a sponsor pool** and `referralCount` increments — emitting
  `ReferralLanded(referrer, newWallet, bounty)`. That event *is* the metric: a verifiable
  "this invite produced a new active wallet inside the app."
- Referrers also earn an ongoing slice of the protocol rake every time someone they brought
  in wins (`referralRakeBps`), so inviting *active* friends keeps paying — retention, not just
  acquisition.
- The app surfaces a share link (`circles.gnosis.io/playground?url=…?ref=<you>`) that opens
  Golazo already embedded in the Circles host, so the invitee can create a wallet and stake in
  the same session the bounty fires on.

### 5. Weekly activity inside the Circles app

- A fresh pool per knockout fixture means a recurring reason to transact in CRC every match
  day, all the way to the Final.
- Each stake, claim, and referral withdrawal is a real CRC transaction through the user's
  Circles Safe — activity that shows up natively in the Circles app.

---

## Smart contract — `GolazoPool.sol`

A multi-outcome **parimutuel** pool with an admin-signed oracle and on-chain referrals.

| Concern | How it's handled |
| --- | --- |
| Pricing | No house. `payout = yourStake + yourStake/winningPool × (losingPool − rake)`. Odds are emergent from the live split. |
| Result authenticity | ECDSA signature from `oracleSigner` over `(matchId, outcome, chainId, address(this))` — can't be replayed across outcome / match / chain / contract. |
| No-winner edge case | If nobody backed the winning side, the match auto-**voids** and everyone reclaims their full stake. Owner can also `voidMatch` an abandoned game. |
| Referral bounty | Sponsor-funded pot pays a fixed CRC bounty when an invite lands a new wallet; counts are kept on-chain for a leaderboard. |
| Referral rake stream | A configurable share of the rake a referee generates is credited to their referrer. |
| Safety | Checks-Effects-Interactions + `ReentrancyGuard`; **pull payments** for winnings and referral credits; `SafeERC20`; rake hard-capped at 10%. |
| Transparency | `previewPayout`, `getMatch`, `getUserStake`, `resultDigest` view helpers for the UI and oracle. |

### Test coverage

`npx hardhat test` → **26 passing**, covering staking, pro-rata parimutuel math (exact
payouts), rake + referral-rake accounting, signature forgery / cross-outcome / cross-match
replay rejection, auto-void refunds, first-touch referral attribution, self-referral guards,
new-wallet bounty (funded and underfunded), double-claim and access-control.

---

## Repo layout

```
golazo/                Next.js 16 Circles mini-app (frontend)
  app/                 layout, theme, the board (page.tsx)
  components/golazo/   MatchCard, ReferralPanel, Header
  components/wallet/   Circles host wallet provider
  lib/                 contracts ABI+addresses, golazo read/write layer, fixtures, format
golazo-contracts/      Hardhat project (the on-chain core)
  contracts/GolazoPool.sol
  test/GolazoPool.test.ts   (26 tests)
  scripts/             deploy.ts · openMatches.ts · signResult.ts
  fixtures.json        shared Round-of-32 fixture refs (same ids the app uses)
```

## Run it

**Contracts**

```bash
cd golazo-contracts
npm install
npm test                    # 26 passing
cp .env.example .env        # set DEPLOYER/ORACLE/FEE + CRC token
npm run deploy:gnosis
npm run open-matches        # opens the R32 fixtures on-chain
```

**Frontend**

```bash
cd golazo
npm install
cp .env.example .env.local  # NEXT_PUBLIC_GOLAZO_POOL + NEXT_PUBLIC_CRC_TOKEN
npm run dev
```

Open it embedded in the Circles host:
`https://circles.gnosis.io/playground?url=<your-app-url>`

**Resolving a match (oracle):**

```bash
ORACLE_PRIVATE_KEY=0x… GOLAZO_POOL=0x… \
  npx ts-node scripts/signResult.ts WC2026-R32-M01 HOME
# → pass the signature to resolveMatch(matchId, HOME, signature)
```

> Predictions are for fun and use small amounts of CRC. The fixtures are seeded for the demo
> and reconciled to the official bracket by the oracle as group results finalise — the
> contract only ever keys on the fixture ref, kickoff, and signed result.
