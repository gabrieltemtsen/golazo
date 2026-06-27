# golazo-contracts

On-chain core for **Golazo** — parimutuel World Cup 2026 prediction pools settled in
Circles (CRC) on Gnosis Chain. Hardhat + OpenZeppelin v5.

`GolazoPool.sol` runs one parimutuel pool per knockout match: fans stake CRC on
Home / Draw / Away, an admin-signed oracle posts the result, and backers of the winning
outcome split the pool pro-rata minus a small rake. A sponsor-funded referral system pays
an instant CRC bounty when an invite lands a brand-new wallet, plus an ongoing rake stream
to referrers of active winners.

## Develop

```bash
npm install
npm run compile
npm test            # 26 passing
```

## Deploy

```bash
cp .env.example .env     # DEPLOYER_PRIVATE_KEY, CRC_TOKEN_ADDRESS, ORACLE_SIGNER_ADDRESS, FEE_RECIPIENT_ADDRESS
npm run deploy:gnosis    # or deploy:chiado / deploy:local
npm run open-matches     # opens fixtures.json on-chain (reuses the frontend's fixture refs)
```

## Resolve a match (oracle)

```bash
ORACLE_PRIVATE_KEY=0x… GOLAZO_POOL=0x… \
  npx ts-node scripts/signResult.ts WC2026-R32-M01 HOME
```

Pass the printed signature to `resolveMatch(matchId, HOME, signature)`. The digest is
domain-separated by `(matchId, outcome, chainId, poolAddress)`, so a signature can never be
replayed on another outcome, match, chain, or contract.

## Design notes

- **Parimutuel, no house:** `payout = stake + stake/winningPool × (losingPool − rake)`.
- **No-winner auto-void:** if nobody backed the winning side, everyone reclaims their stake.
- **Safety:** Checks-Effects-Interactions, `ReentrancyGuard`, `SafeERC20`, pull payments,
  rake hard-capped at 10%.

See [`../golazo/SUBMISSION.md`](../golazo/SUBMISSION.md) for the full architecture and the
mapping to the judging criteria.
