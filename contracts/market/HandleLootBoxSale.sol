// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.6.7;

import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// TODO: implement IMarketHandler and handle all randomized sales rather than tweaking and redeploying each time
contract HandleLootBoxSale is Ownable {

    uint256 constant public MAX_SUPPLY = 17;
    
    IERC1155  public nft;
    uint256   public price = 0.5 ether;
    uint256   public id;
    uint256   public offset;
    uint256   public start;
    uint256   public idToSend;
    uint256   public maxId;
    uint256   public amountSold = 0;
    bool      public ended = false;
    
    address[] public buyers;
    mapping(address => bool) public buyerMapping; // key is address, value is boolean where true means they already bought
    
    address payable public haus;
    address payable public seller;
    
    event Buy(address buyer, uint256 amount);
    
    constructor() public {
        start = 1620154800;
        id = 72;
        maxId  = id + MAX_SUPPLY - 1;
        
        nft = IERC1155(0x13bAb10a88fc5F6c77b87878d71c9F1707D2688A);
        seller = payable(address(0x15884D7a5567725E0306A90262ee120aD8452d58));
        haus = payable(address(0x38747BAF050d3C22315a761585868DbA16abFD89));
    }
    
    function buy(uint256 amount) public payable {
        require(amountSold + buyers.length < MAX_SUPPLY, "sold out");
        require(!buyerMapping[msg.sender], "already purchased");
        require(msg.sender == tx.origin, "no contracts");
        require(block.timestamp >= start, "early");
        require(amount <= MAX_SUPPLY, "ordered too many");
        require(amount <= 1, "ordered too many");
        require(msg.value == price.mul(amount), "wrong amount");
        
        uint256 balance = address(this).balance;
        uint256 hausFee = balance.div(20).mul(3);
        haus.transfer(hausFee);
        seller.transfer(address(this).balance);
        
        buyerMapping[msg.sender] = true;
        buyers.push(msg.sender);
        emit Buy(msg.sender, amount);
    }
    
    function supply() public view returns(uint256) {
        return MAX_SUPPLY.sub(amountSold);
    }
    
    function supply(uint256 _id) public view returns(uint256) {
        return nft.balanceOf(address(this), _id);
    }
    
    function end() public onlyOwner {
        if (!ended) {
            ended = true;
            offset = generateRandom();
            idToSend = id.add(offset);
        }
        
        uint256 balance = address(this).balance;
        uint256 hausFee = balance.div(20).mul(3);
        haus.transfer(hausFee);
        seller.transfer(address(this).balance);
    }
    
    function distribute() public onlyOwner {
        if (!ended) {
            return;
        }
        
        for (uint i = 0; i < buyers.length; i++) {
            address toSendTo = buyers[i];

            nft.safeTransferFrom(address(this), toSendTo, idToSend, 1, new bytes(0x0));
            
            buyerMapping[toSendTo] = false;
            
            idToSend = idToSend.add(1);
            if (idToSend > maxId) {
                idToSend = id;
            }
        }
        
        amountSold = amountSold.add(buyers.length);
        delete buyers;
    }
    
    function generateRandom() private view returns (uint256) {
        return uint256(keccak256(abi.encode(block.timestamp, block.difficulty)))%(MAX_SUPPLY);
    }
    
    function pull(uint256 _id) public onlyOwner {
        nft.safeTransferFrom(address(this), seller, _id, 1, new bytes(0x0));
    }
    
    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata) external pure returns(bytes4) {
        return bytes4(keccak256("onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"));
    }
    
    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure returns(bytes4) {
        return bytes4(keccak256("onERC1155Received(address,address,uint256,uint256,bytes)"));
    }
}