import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY ?? "0x" + "0".repeat(64);
const BASE_RPC = process.env.BASE_RPC_URL ?? "https://base-mainnet.core.chainstack.com/1f396980c6a698065bdf9bbebbb7fd78";
const BASE_SEPOLIA_RPC = process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org";
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY ?? "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 8453,
      forking: {
        url: BASE_RPC,
        enabled: false, // enable for mainnet fork testing
      },
    },
    base: {
      url: BASE_RPC,
      chainId: 8453,
      accounts: [DEPLOYER_KEY],
    },
    baseSepolia: {
      url: BASE_SEPOLIA_RPC,
      chainId: 84532,
      accounts: [DEPLOYER_KEY],
    },
  },
  etherscan: {
    apiKey: { base: BASESCAN_API_KEY, baseSepolia: BASESCAN_API_KEY },
    customChains: [
      {
        network: "base",
        chainId: 8453,
        urls: { apiURL: "https://api.basescan.org/api", browserURL: "https://basescan.org" },
      },
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: { apiURL: "https://api-sepolia.basescan.org/api", browserURL: "https://sepolia.basescan.org" },
      },
    ],
  },
  gasReporter: { enabled: true, currency: "USD" },
};

export default config;
