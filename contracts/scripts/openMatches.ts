/**
 * Open the knockout fixtures on-chain. Reads the SAME fixtures.json the
 * frontend uses, so the app and the contract never drift.
 *
 *   GOLAZO_POOL=0x... npx hardhat run scripts/openMatches.ts --network gnosis
 */
import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config();

type Fixture = { ref: string; kickoff: string };

async function main() {
  const poolAddr = process.env.GOLAZO_POOL;
  if (!poolAddr) throw new Error("GOLAZO_POOL missing");

  const fixturesPath = path.join(__dirname, "..", "fixtures.json");
  const fixtures: Fixture[] = JSON.parse(fs.readFileSync(fixturesPath, "utf8"));

  const pool = await ethers.getContractAt("GolazoPool", poolAddr);
  console.log(`⚽  Opening ${fixtures.length} matches on ${network.name}...`);

  for (const f of fixtures) {
    const matchId = ethers.keccak256(ethers.toUtf8Bytes(f.ref));
    const kickoff = Math.floor(new Date(f.kickoff).getTime() / 1000);
    const existing = await pool.getMatch(matchId);
    if (existing.status !== 0n) {
      console.log(`  • ${f.ref} already open — skipping`);
      continue;
    }
    const tx = await pool.openMatch(matchId, kickoff);
    await tx.wait();
    console.log(`  ✅ ${f.ref} opened (kickoff ${f.kickoff})`);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
