import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config"

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL as string
const ACCOUNT_PRIVATE_KEY = process.env.ACCOUNT_PRIVATE_KEY as string

const config = {
  solidity: "0.8.11",
  networks: {
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: [ACCOUNT_PRIVATE_KEY],
      chainId: 11155111,
    },
  },
}

export default config;
