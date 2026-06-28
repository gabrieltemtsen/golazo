/**
 * Resolve a finished match: sign the result with the oracle key AND submit
 * resolveMatch in one step. Run it once per match after full time.
 *
 *   REF=WC2026-R32-RSACAN OUTCOME=HOME \
 *     npx hardhat run scripts/resolveMatch.ts --network gnosis
 *
 * OUTCOME = HOME | DRAW | AWAY, judged on the 90-minute (regulation) result —
 * a knockout level after 90' settles DRAW even if decided in ET / penalties.
 *
 * Requires the hardhat signer to be the oracleSigner (it signs the result).
 * If nobody backed the winning outcome the contract auto-voids and everyone
 * is refunded via claim().
 */
import { ethers, network } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

const OUTCOME: Record<string, number> = { HOME: 1, DRAW: 2, AWAY: 3 };
const STATUS = ["None", "Open", "Resolved", "Voided"] as const;

async function main() {
  const ref = process.env.REF;
  const outcomeName = (process.env.OUTCOME ?? "").toUpperCase();
  const outcome = OUTCOME[outcomeName];
  if (!ref || !outcome) {
    throw new Error(
      'Usage: REF=<fixtureRef> OUTCOME=<HOME|DRAW|AWAY> npx hardhat run scripts/resolveMatch.ts --network gnosis'
    );
  }

  const poolAddr = process.env.GOLAZO_POOL;
  if (!poolAddr || !ethers.isAddress(poolAddr)) {
    throw new Error(`GOLAZO_POOL missing or invalid: ${poolAddr}`);
  }

  const [signer] = await ethers.getSigners();
  const pool = await ethers.getContractAt("GolazoPool", poolAddr);
  const chainId = (await ethers.provider.getNetwork()).chainId;

  const oracle = await pool.oracleSigner();
  if (oracle.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(
      `Signer ${signer.address} is not the oracleSigner ${oracle} — the signature would be rejected.`
    );
  }

  const matchId = ethers.keccak256(ethers.toUtf8Bytes(ref));
  const m = await pool.getMatch(matchId);
  const status = STATUS[Number(m.status)] ?? "Unknown";
  console.log(`\n⚖️  Resolve ${ref} → ${outcomeName} on ${network.name}`);
  console.log(`Pool    : ${poolAddr}`);
  console.log(`Match   : ${status}`);
  console.log(
    `Totals  : H ${ethers.formatUnits(m.homeTotal, 18)} · D ${ethers.formatUnits(
      m.drawTotal,
      18
    )} · A ${ethers.formatUnits(m.awayTotal, 18)} CRC`
  );
  if (status !== "Open") {
    throw new Error(`Match is ${status}, not Open — cannot resolve.`);
  }

  // Same digest the contract verifies: keccak256(matchId,uint8,chainId,pool)
  // then EIP-191 personal-sign prefix (signMessage applies it).
  const inner = ethers.solidityPackedKeccak256(
    ["bytes32", "uint8", "uint256", "address"],
    [matchId, outcome, chainId, poolAddr]
  );
  const signature = await signer.signMessage(ethers.getBytes(inner));

  const tx = await pool.resolveMatch(matchId, outcome, signature);
  console.log(`\nSubmitting… tx ${tx.hash}`);
  await tx.wait();

  const after = STATUS[Number((await pool.getMatch(matchId)).status)] ?? "Unknown";
  if (after === "Voided") {
    console.log(`↩  No CRC backed ${outcomeName} — match VOIDED; everyone can claim a refund.`);
  } else {
    console.log(`✅  ${ref} resolved ${outcomeName}. Winners can now claim().`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
