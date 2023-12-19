// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

struct NFTListing {
  uint256 price;
  address seller;
}

error NFTMarket__NullPrice();
error NFTMarket__NftNotFound();
error NFTMarket__IncorrectPrice();
error NFTMarket__NotNftOwner();
error NFTMarket__NoFundsToWithdraw();


contract NFTMarket is ERC721URIStorage, Ownable {
  //use for creation and buying

  //if tokenURI not empty, then NFT was created
  //if price != 0, then nft was listed
  //if price is 0 && tokenURI is empty, then NFT was transferred, (either bought or canceled from listing)
  event NFTTransfer(uint256 tokenId, address to, string tokenURI, uint256 price);
  
  //counters library provided by openzeppelin
  using SafeMath for uint256;
  using Counters for Counters.Counter;
  Counters.Counter private _tokenIds;

  mapping(uint256 => NFTListing) private _listings;


  constructor() ERC721("whatever", "WTH") {}

  function createNFT(string calldata tokenURI) public {
    _tokenIds.increment();
    uint256 currentId = _tokenIds.current();
    _safeMint(msg.sender, currentId);
    _setTokenURI(currentId, tokenURI);
    emit NFTTransfer(currentId, msg.sender, tokenURI, 0);
  }

  //listNFT function
  function listNFT(uint256 tokenId, uint256 price) public {
    if(price < 1) {
      revert NFTMarket__NullPrice();
    }
    
    transferFrom(msg.sender, address(this), tokenId); //change the ownership of token to this contract

    //create listing
    _listings[tokenId] = NFTListing(price, msg.sender);

    emit NFTTransfer(tokenId, address(this), "", price);
  }

  //buy nft

  function buyNFT(uint256 tokenId) public payable {
    NFTListing memory listing = _listings[tokenId];
    if(listing.price < 1){
      revert NFTMarket__NftNotFound();
    }
    if(msg.value != listing.price){
      revert NFTMarket__IncorrectPrice();
    }

    //currently, the owner is the market, bc it was listed for sale
    // only the contract can call this transfer ownership function, because the msg.sender in this case is not authorized/approved to change ownership, and doesn't own the NFT token, so
    ERC721(address(this)).transferFrom(address(this), msg.sender, tokenId);

    clearListing(tokenId); //remove from listing

    //send money to seller, taking 5% cut
    payable(listing.seller).transfer(listing.price.mul(95).div(100));
    emit NFTTransfer(tokenId, msg.sender, "", 0);
  }

  //cancel listing
  function cancelListing(uint256 tokenId) public {
    NFTListing memory listing = _listings[tokenId];
    if(listing.price < 1){
      revert NFTMarket__NftNotFound();
    }
    if(listing.seller != msg.sender){
      revert NFTMarket__NotNftOwner();
    }
    ERC721(address(this)).transferFrom(address(this), msg.sender, tokenId); //transfer ownership back to seller
    clearListing(tokenId);
    emit NFTTransfer(tokenId, msg.sender, "", 0);
  }

  function clearListing(uint256 tokenId) private {
    _listings[tokenId].price = 0;
    _listings[tokenId].seller = address(0);
  }

  function withdrawFunds() public onlyOwner {
    if(address(this).balance < 1){
      revert NFTMarket__NoFundsToWithdraw();
    }
    payable(owner()).transfer(address(this).balance);
  }
}