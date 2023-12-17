import { expect } from "chai"
import { ethers } from "hardhat"
import { NFTMarket } from "../typechain-types"
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"
import { BigNumberish, EventLog, Result } from "ethers"

describe("NFTMarket", () => {
  let nftMarket: NFTMarket
  let signers: SignerWithAddress[]

  before(async () => {
    nftMarket = await ethers.deployContract("NFTMarket")
    signers = await ethers.getSigners()
  })

  const createNFT = async (tokenURI: string) => {
    //the functions that are not pure or view, return the transaction, because they change the state of blockchain, hence performing a transaction
    const txResponse = await nftMarket.createNFT(tokenURI)
    const txReceipt = await txResponse.wait()

    //@ts-expect-error the typed one is below, gonna keep this here just for reference tho
    const tokenId = txReceipt?.logs[0].args[2] //returned by smc event
    return tokenId
  }

  const createAndListNFT = async (price: BigNumberish) => {
    const tokenId = await createNFT("some-token-uri")
    const tx = await nftMarket.listNFT(tokenId, price)
    await tx.wait()
    return tokenId
  }

  describe("createNFT", () => {
    it("should create an NFT with correct owner and tokenURI", async () => {
      //mint nft
      const tokenURI = "https://some-token.uri/" //mocking token URI

      const txResponse = await nftMarket.createNFT(tokenURI)
      const txReceipt = await txResponse.wait()
      const tokenId = (txReceipt?.logs[0] as EventLog).args[2]
      const mintedTokenURI = await nftMarket.tokenURI(tokenId) //this function returns an expected value, bc it is pure and doesn't change the state, hence NO Tx performed, no Tx returned

      //the uri should be the one we sent above
      expect(mintedTokenURI).to.equal(tokenURI)

      //make sure the owner is correct
      const ownerAddress = await nftMarket.ownerOf(tokenId)
      const currectAddress = await signers[0].getAddress()

      expect(ownerAddress).to.equal(currectAddress)

      //assert that NFTTransfer event has correct arguments
      const args = (txReceipt?.logs[1] as EventLog).args as Result
      expect(args[0]).to.equal(tokenId)
      expect(args[1]).to.equal(ownerAddress)
      expect(args[2]).to.equal(tokenURI)
      expect(args[3]).to.equal(0) // This SHOULD be zero
    })
  })

  describe("listNFT", () => {
    it("should revert if price is zero", async () => {
      const tokenURI = "some-token-uri"
      const tokenId = await createNFT(tokenURI)

      await expect(nftMarket.listNFT(tokenId, 0)).to.be.revertedWithCustomError(
        nftMarket,
        "NFTMarket__NullPrice()"
      )
    })
    it("should revert if not called by the owner", async () => {
      const tokenURI = "some-token-uri"
      const tokenId = await createNFT(tokenURI) //create with first one
      const tx = nftMarket.connect(signers[1]).listNFT(tokenId, 12) //connect the second one

      await expect(tx).to.be.revertedWith(
        "ERC721: transfer caller is not owner nor approved"
      )
    })
    it("should list the token for sale if all requirements are met", async () => {
      const price = 12
      const tokenURI = "some-token-uri"
      const tokenId = await createNFT(tokenURI) //create with first one
      const tx = await nftMarket.listNFT(tokenId, price) //connect the second one
      const txReceipt = await tx.wait()
      const args = (txReceipt?.logs[2] as EventLog).args as Result
      expect(args[0]).to.equal(tokenId)
      expect(args[1]).to.equal(await nftMarket.getAddress())
      expect(args[2]).to.equal("") //this SHOULD be empty
      expect(args[3]).to.equal(price) // the price must match
    })
  })
  describe("buyNFT", async () => {
    let tokenId: BigNumberish
    beforeEach(async () => {
      const tokenURI = "some-token-uri"
      tokenId = await createNFT(tokenURI) //created but not listed for sale
    })
    it("should revert if NFT is not listed for sale", async () => {
      await expect(nftMarket.buyNFT(12)).to.be.revertedWithCustomError(
        nftMarket,
        "NFTMarket__NftNotFound()"
      )
    })
    it("should revert if not enough ETH is sent", async () => {
      const tokenId = await createAndListNFT(100)
      //now let's not send enough eth
      const tx = nftMarket.buyNFT(tokenId, { value: 12 })

      await expect(tx).to.be.revertedWithCustomError(
        nftMarket,
        "NFTMarket__IncorrectPrice()"
      )
    })
    it("should transfer ownership to buyer and send price to seller", async () => {
      const price = 12;
      const tokenId = await createAndListNFT(12)
      const tx = await nftMarket.connect(signers[1]).buyNFT(tokenId, {value: price})
      const txReceipt = await tx.wait();

      //check if 95 of the price has been added in seller's account
      // 5% was kept in contract's balance
      // NFT ownership was transfered successfully
    })
  })
})
