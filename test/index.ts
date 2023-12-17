import { expect } from "chai"
import { ethers } from "hardhat"

describe("NFTMarket", () => {
  it("should make sure the NFT is properly minted", async () => {
    //deploy the contract
    const nftMarket = await ethers.deployContract("NFTMarket")

    //mint nft
    const tokenURI = "https://some-token.uri/" //mocking token URI

    //the functions that are not pure or view, return the transaction, because they change the state of blockchain, hence performing a transaction
    const txResponse = await nftMarket.createNFT(tokenURI)
    const txReceipt = await txResponse.wait()

    // @ts-expect-error the args is not undefined
    const tokenId = txReceipt?.logs[0].args[2] //returned by smc event

    const mintedTokenURI = await nftMarket.tokenURI(tokenId) //this function returns an expected value, bc it is pure and doesn't change the state, hence NO Tx performed, no Tx returned

    //the uri should be the one we sent above
    expect(mintedTokenURI).to.equal(tokenURI)

    //make sure the owner is correct
    const ownerAddress = await nftMarket.ownerOf(tokenId);
    const signers = await ethers.getSigners();
    const currectAddress = await signers[0].getAddress()

    expect(ownerAddress).to.equal(currectAddress)
  })
})
