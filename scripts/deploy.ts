import { ethers } from "hardhat";

async function main() {
  const nftMarket = await ethers.deployContract("NFTMarket")
  await nftMarket.waitForDeployment();

  console.log("Deployed contract to ", await nftMarket.getAddress())
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
