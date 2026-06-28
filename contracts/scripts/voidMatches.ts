/**
 * Void the placeholder Round-of-32 matches so every staker can reclaim their
 * full CRC stake via claim() in the app.
 *
 *   GOLAZO_POOL=0x... npx hardhat run scripts/voidMatches.ts --network gnosis
 *
 * Owner-only (voidMatch). After this runs, open Golazo in Circles with the
 * wallet that staked and tap "Claim refund" on each match — the refund is a
 * pull payment, so it must come from the staker's wallet, not this script.
 */
import { ethers, network } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

// The original seeded refs that were opened (lib/fixtures.ts M01–M12).
const OLD_REFS = [
  "WC2026-R32-M01", "WC2026-R32-M02", "WC2026-R32-M03", "WC2026-R32-M04",
  "WC2026-R32-M05", "WC2026-R32-M06", "WC2026-R32-M07", "WC2026-R32-M08",
  "WC2026-R32-M09", "WC2026-R32-M10", "WC2026-R32-M11", "WC2026-R32-M12",
];

const STATUS = ["None", "Open", "Resolved", "Voided"] as const;

async function main() {
  const poolAddr = process.env.GOLAZO_POOL;
  if (!poolAddr || !ethers.isAddress(poolAddr)) {
    throw new Error(`GOLAZO_POOL missing or invalid: ${poolAddr}`);
  }

  const [signer] = await ethers.getSigners();
  const pool = await ethers.getContractAt("GolazoPool", poolAddr);

  const owner = await pool.owner();
  console.log(`\n↩  Golazo — Void placeholder matches on ${network.name}`);
  console.log(`Pool   : ${poolAddr}`);
  console.log(`Signer : ${signer.address}`);
  console.log(`Owner  : ${owner}`);
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error("Signer is not the contract owner — voidMatch will revert.");
  }
  console.log("");

  let voided = 0;
  for (const ref of OLD_REFS) {
    const matchId = ethers.keccak256(ethers.toUtf8Bytes(ref));
    const m = await pool.getMatch(matchId);
    const status = STATUS[Number(m.status)] ?? "Unknown";
    const pool_ = ethers.formatUnits(m.totalPool, 18);

    if (status === "Open") {
      const tx = await pool.voidMatch(matchId);
      await tx.wait();
      voided++;
      console.log(`  ✅ ${ref} voided  (pool ${pool_} CRC now refundable)`);
    } else {
      console.log(`  • ${ref} is ${status} — skipping`);
    }
  }

  console.log(`\nDone. Voided ${voided} match(es).`);
  console.log(
    "Next: open Golazo in Circles with the wallet that staked and tap " +
      '"Claim refund" on each voided match to pull your CRC back.\n'
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
