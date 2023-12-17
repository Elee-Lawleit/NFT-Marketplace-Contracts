// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";


struct NFTListing {
  uint256 price;
  address seller;
}

error NFTMarket__NullPrice();


contract NFTMarket is ERC721URIStorage {
  
  //counters library provided by openzeppelin
  using Counters for Counters.Counter;
  Counters.Counter private _tokenIds;

  mapping(uint256 => NFTListing) private _listings;

  constructor() ERC721("whatever", "WTH") {}

  function createNFT(string calldata tokenURI) public {
    _tokenIds.increment();
    uint256 currentId = _tokenIds.current();
    _safeMint(msg.sender, currentId);
    _setTokenURI(currentId, tokenURI);
  }

  //listNFT function
  function listNFT(uint256 tokenId, uint256 price) public {
    if(price < 1) {
      revert NFTMarket__NullPrice();
    }
    
    //approve our contract to transfer ownership of the token
    approve(address(this), tokenId);
    transferFrom(msg.sender, address(this), tokenId); //change the ownership of token to this contract
  }

  //buy nft

  //cancel listing
}