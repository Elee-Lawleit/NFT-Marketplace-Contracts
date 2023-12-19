import { expect } from "chai"
import { ethers } from "hardhat"
import { NFTMarket } from "../typechain-types"
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"
import {
  BigNumberish,
  Contract,
  EventLog,
  Result,
  formatEther,
  formatUnits,
  parseEther,
  parseUnits,
} from "ethers"

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

  const createAndListNFT = async (
    price: BigNumberish
  ): Promise<BigNumberish> => {
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

      //ownership should be transfered to the contract
      const ownerAddress = await nftMarket.ownerOf(tokenId)
      expect(ownerAddress).to.equal(await nftMarket.getAddress())

      //event should have the right arguments
      expect(args[0]).to.equal(tokenId)
      expect(args[1]).to.equal(await nftMarket.getAddress())
      expect(args[2]).to.equal("") //this SHOULD be empty
      expect(args[3]).to.equal(price) // the price must match
    })
  })
  describe("buyNFT", async () => {
    it("should revert if NFT is not listed for sale", async () => {
      const tokenURI = "some-token-uri"
      const tokenId = await createNFT(tokenURI) //created but not listed for sale
      //passing in a wrong token id of 12
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
    it("should transfer ownership to the buyer and send the price to the seller", async () => {
      const price = parseEther("1") //converts ether into wei
      const tokenId = await createAndListNFT(price)
      const initialContractBalance = await ethers.provider.getBalance(
        await nftMarket.getAddress()
      )

      // Check if 95% of the price has been added to the seller's account
      const oldSellerBalance = await signers[0].provider.getBalance(
        signers[0].address
      )

      // Buy NFT with signer 2
      const tx = await nftMarket
        .connect(signers[1])
        .buyNFT(tokenId, { value: price })
      const txReceipt = await tx.wait()

      // New seller balance
      const newSellerBalance = await signers[0].provider.getBalance(
        signers[0].address
      )

      const difference = newSellerBalance - oldSellerBalance
      const sellerProfit = (price * BigInt(95)) / BigInt(100) //95% of the actual price

      //1. 95% of the price was added to the seller balance
      expect(difference).to.equal(sellerProfit)
      //2. check if 5% was kept in contract's balance
      const newContractBalance = await ethers.provider.getBalance(
        await nftMarket.getAddress()
      )
      const contractBalanceDifference =
        newContractBalance - initialContractBalance
      const fee = price - sellerProfit
      expect(contractBalanceDifference).to.equal(fee)

      //check if owner is correct
      const ownerAddress = await nftMarket.ownerOf(tokenId)
      expect(ownerAddress).to.equal(signers[1].address)

      //check if event has correct args
      const args = (txReceipt?.logs[2] as EventLog).args as Result
      expect(args[0]).to.equal(tokenId)
      expect(args[1]).to.equal(ownerAddress)
      expect(args[2]).to.equal("")
      expect(args[3]).to.equal(0)
    })
  })
  describe("cancelListing", async () => {
    it("should revert if listing doesn't exist", async () => {
      const tokenURI = "some-token-uri"
      const tokenId = await createNFT(tokenURI)

      const tx = nftMarket.cancelListing(tokenId)
      expect(tx).to.be.revertedWithCustomError(
        nftMarket,
        "NFTMarket__NftNotFound()"
      )
    })
    it("should revert if someone other than owner tries to cancel nft listing", async () => {
      const price = parseEther("1")
      const tokenId = await createAndListNFT(price)

      await expect(
        nftMarket.connect(signers[1]).cancelListing(tokenId)
      ).to.be.revertedWithCustomError(nftMarket, "NFTMarket__NotNftOwner()")
    })
    it("should transfer ownership back to seller", async () => {
      const price = parseEther("1")
      const tokenId = await createAndListNFT(price)

      expect(await nftMarket.ownerOf(tokenId)).to.equal(
        await nftMarket.getAddress()
      )
      const tx = await nftMarket.cancelListing(tokenId)

      expect(await nftMarket.ownerOf(tokenId)).to.equal(signers[0].address)

      //check nft transfer event
      const txReceipt = await tx.wait()
      const args = (txReceipt?.logs[2] as EventLog).args as Result
      expect(args[0]).to.equal(tokenId)
      expect(args[1]).to.equal(signers[0].address)
      expect(args[2]).to.equal("")
      expect(args[3]).to.equal(0)
    })
  })
  describe("withdrawFunds", () => {
    it("should revert if called by a signer other than the owner", async () => {
      const tx = nftMarket.connect(signers[1]).withdrawFunds()
      expect(tx).to.be.revertedWith("Ownable: caller is not the owner")
    })
    it("should revert if contract balance is zero", async () => {
      await nftMarket.withdrawFunds()
      await expect(nftMarket.withdrawFunds()).to.be.revertedWithCustomError(
        nftMarket,
        "NFTMarket__NoFundsToWithdraw()"
      )
    })
    it("should transfer all funds to the owner", async () => {
      const price = parseEther("1")
      const tokenId = await createAndListNFT(price)
      await nftMarket.connect(signers[1]).buyNFT(tokenId, { value: price })

      const oldOwnerBalance = await signers[0].provider.getBalance(
        signers[0].address
      )

      const tx = await nftMarket.withdrawFunds()
      const txReceipt = await tx.wait()

      //calculate gas price used by withdrawFunds function
      const gasPrice = txReceipt?.gasUsed! * txReceipt?.gasPrice!

      const newOwnerBalance = await signers[0].provider.getBalance(
        signers[0].address
      )

      const fivePercentOfPrice = (price * 5n) / 100n
      expect(newOwnerBalance).to.equal(
        oldOwnerBalance + fivePercentOfPrice - gasPrice
      )
    })
  })
})
