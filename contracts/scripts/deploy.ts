/**
 * Deploy GolazoPool to Gnosis Chain (or chiado / localhost).
 *
 *   npx hardhat run scripts/deploy.ts --network gnosis
 *
 * Required .env:
 *   DEPLOYER_PRIVATE_KEY   — pays gas
 *   CRC_TOKEN_ADDRESS      — Circles ERC-20 (CRC) used for stakes
 *   ORACLE_SIGNER_ADDRESS  — backend wallet that signs match results
 *   FEE_RECIPIENT_ADDRESS  — wallet / Circles group that receives the rake
 *
 * On localhost a MockCRC is deployed automatically if CRC_TOKEN_ADDRESS is unset.
 */
import { ethers, network } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = (await ethers.provider.getNetwork()).chainId;

  console.log("\n⚽  Golazo — Deploy");
  console.log(`Network   : ${network.name} (chainId ${chainId})`);
  console.log(`Deployer  : ${deployer.address}`);
  console.log(
    `Balance   : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} xDAI\n`
  );

  let crc = process.env.CRC_TOKEN_ADDRESS;
  if (!crc) {
    if (network.name === "localhost" || network.name === "hardhat") {
      console.log("⟳  No CRC_TOKEN_ADDRESS — deploying MockCRC for local dev...");
      const Mock = await ethers.getContractFactory("MockCRC");
      const mock = await Mock.deploy();
      await mock.waitForDeployment();
      crc = await mock.getAddress();
      console.log(`   MockCRC: ${crc}`);
    } else {
      throw new Error("CRC_TOKEN_ADDRESS is required on live networks");
    }
  }

  const oracle = process.env.ORACLE_SIGNER_ADDRESS ?? deployer.address;
  const feeRecipient = process.env.FEE_RECIPIENT_ADDRESS ?? deployer.address;

  console.log(`CRC token : ${crc}`);
  console.log(`Oracle    : ${oracle}`);
  console.log(`Fee recip : ${feeRecipient}\n`);

  const Pool = await ethers.getContractFactory("GolazoPool");
  const pool = await Pool.deploy(crc, oracle, feeRecipient);
  await pool.waitForDeployment();
  const addr = await pool.getAddress();

  console.log(`✅  GolazoPool deployed at: ${addr}\n`);
  console.log("NEXT STEPS:");
  console.log(`  1. golazo/.env.local  → NEXT_PUBLIC_GOLAZO_POOL=${addr}`);
  console.log(`                          NEXT_PUBLIC_CRC_TOKEN=${crc}`);
  console.log(`  2. Open matches       → npm run open-matches`);
  console.log(`  3. (optional) verify  → npx hardhat verify --network ${network.name} ${addr} ${crc} ${oracle} ${feeRecipient}\n`);
  return addr;
}

main()
  .then((a) => {
    console.log(`Done. GolazoPool: ${a}`);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
