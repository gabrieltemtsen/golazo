import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const DEPLOYER_PRIVATE_KEY =
  process.env.DEPLOYER_PRIVATE_KEY ??
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // hardhat default

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
      viaIR: true,
    },
  },
  networks: {
    localhost: { url: "http://127.0.0.1:8545" },
    gnosis: {
      url: process.env.GNOSIS_RPC_URL ?? "https://rpc.gnosischain.com",
      chainId: 100,
      accounts: [DEPLOYER_PRIVATE_KEY],
      gasPrice: "auto",
    },
    chiado: {
      url: process.env.CHIADO_RPC_URL ?? "https://rpc.chiadochain.net",
      chainId: 10200,
      accounts: [DEPLOYER_PRIVATE_KEY],
      gasPrice: "auto",
    },
  },
  sourcify: { enabled: true },
  etherscan: { enabled: false },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
