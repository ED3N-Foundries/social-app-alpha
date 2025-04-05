// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract ED3NTicket is ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;
    
    mapping(uint256 => uint256) public ticketToEvent;
    
    constructor() ERC721("ED3N Event Ticket", "ED3NT") {}
    
    function mintTicket(address recipient, uint256 eventId, string memory tokenURI) 
        public onlyOwner 
        returns (uint256) 
    {
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();
        
        _mint(recipient, newTokenId);
        _setTokenURI(newTokenId, tokenURI);
        ticketToEvent[newTokenId] = eventId;
        
        return newTokenId;
    }
    
    function getEventForTicket(uint256 tokenId) public view returns (uint256) {
        return ticketToEvent[tokenId];
    }
}