/**
 * Oracle signing helper — the backend runs this to authorise a match result.
 *
 *   ORACLE_PRIVATE_KEY=0x... GOLAZO_POOL=0x... \
 *   ts-node scripts/signResult.ts WC2026-R32-M01 HOME
 *
 * Outcome arg: HOME | DRAW | AWAY
 * Prints a signature you pass to resolveMatch(matchId, outcome, signature).
 *
 * The digest is domain-separated by (matchId, outcome, chainId, poolAddress)
 * so a signature can never be replayed on another outcome, match, chain or
 * contract.
 */
import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();

const OUTCOME: Record<string, number> = { NONE: 0, HOME: 1, DRAW: 2, AWAY: 3 };

async function main() {
  const [ref, outcomeName] = process.argv.slice(2);
  if (!ref || !outcomeName) {
    throw new Error('Usage: ts-node scripts/signResult.ts <fixtureRef> <HOME|DRAW|AWAY>');
  }
  const outcome = OUTCOME[outcomeName.toUpperCase()];
  if (!outcome) throw new Error(`Bad outcome: ${outcomeName}`);

  const pk = process.env.ORACLE_PRIVATE_KEY;
  const pool = process.env.GOLAZO_POOL;
  const chainId = Number(process.env.CHAIN_ID ?? 100);
  if (!pk) throw new Error("ORACLE_PRIVATE_KEY missing");
  if (!pool) throw new Error("GOLAZO_POOL missing");

  const matchId = ethers.keccak256(ethers.toUtf8Bytes(ref));
  const inner = ethers.solidityPackedKeccak256(
    ["bytes32", "uint8", "uint256", "address"],
    [matchId, outcome, chainId, pool]
  );
  const wallet = new ethers.Wallet(pk);
  const signature = await wallet.signMessage(ethers.getBytes(inner));

  console.log(JSON.stringify({ fixtureRef: ref, matchId, outcome: outcomeName.toUpperCase(), signature }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
