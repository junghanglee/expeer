// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ExpeerEscrowVaultV2
 * @notice P2P 에스크로 컨트랙트 강화판
 *  - 다중 arbiter (m-of-n 단순화: 어느 한 명이라도 권한 행사 가능)
 *  - Pausable: 비상 정지
 *  - ReentrancyGuard: 외부 콜 보호
 *  - Fee-on-transfer 토큰 거부
 *  - 명시적 owner 2-step 이전 (ownership transfer with accept)
 *
 *  주의: 비감사 코드. 메인넷 배포 전 외부 감사 필수.
 */

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

abstract contract ReentrancyGuard {
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status = _NOT_ENTERED;

    modifier nonReentrant() {
        require(_status != _ENTERED, "REENTRANT");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }
}

abstract contract Pausable {
    bool public paused;
    event Paused(address by);
    event Unpaused(address by);
    modifier whenNotPaused() { require(!paused, "PAUSED"); _; }
}

contract ExpeerEscrowVaultV2 is ReentrancyGuard, Pausable {
    enum Status { None, Locked, Released, Refunded, Disputed }

    struct EscrowOrder {
        address seller;
        address buyer;
        address token;
        uint256 amount;
        uint64  expiresAt;
        Status  status;
    }

    address public owner;
    address public pendingOwner;
    mapping(address => bool) public arbiters;
    uint16  public feeBps;            // 최대 500 (5%)
    address public feeRecipient;

    mapping(bytes32 => EscrowOrder) public orders;

    event Locked(bytes32 indexed orderId, address indexed seller, address indexed buyer, address token, uint256 amount, uint64 expiresAt);
    event Released(bytes32 indexed orderId, address indexed buyer, uint256 amountToBuyer, uint256 fee);
    event Refunded(bytes32 indexed orderId, address indexed seller, uint256 amount);
    event Disputed(bytes32 indexed orderId, address indexed by);
    event Resolved(bytes32 indexed orderId, address indexed winner, uint256 amount);
    event ArbiterUpdated(address indexed arbiter, bool enabled);
    event FeeUpdated(address indexed recipient, uint16 bps);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() { require(msg.sender == owner, "NOT_OWNER"); _; }
    modifier onlyArbiter() { require(arbiters[msg.sender], "NOT_ARBITER"); _; }

    constructor(address _arbiter, address _feeRecipient, uint16 _feeBps) {
        require(_arbiter != address(0) && _feeRecipient != address(0), "ZERO_ADDR");
        require(_feeBps <= 500, "FEE_TOO_HIGH");
        owner = msg.sender;
        arbiters[_arbiter] = true;
        feeRecipient = _feeRecipient;
        feeBps = _feeBps;
        emit ArbiterUpdated(_arbiter, true);
    }

    // === Admin ===
    function setArbiter(address a, bool enabled) external onlyOwner {
        require(a != address(0), "ZERO_ADDR");
        arbiters[a] = enabled;
        emit ArbiterUpdated(a, enabled);
    }

    function setFee(address r, uint16 bps) external onlyOwner {
        require(r != address(0), "ZERO_ADDR");
        require(bps <= 500, "FEE_TOO_HIGH");
        feeRecipient = r;
        feeBps = bps;
        emit FeeUpdated(r, bps);
    }

    function pause() external onlyOwner { paused = true; emit Paused(msg.sender); }
    function unpause() external onlyOwner { paused = false; emit Unpaused(msg.sender); }

    function transferOwnership(address n) external onlyOwner {
        require(n != address(0), "ZERO_ADDR");
        pendingOwner = n;
        emit OwnershipTransferStarted(owner, n);
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "NOT_PENDING");
        address prev = owner;
        owner = pendingOwner;
        pendingOwner = address(0);
        emit OwnershipTransferred(prev, owner);
    }

    // === Core flow ===

    function lock(
        bytes32 orderId,
        address buyer,
        address token,
        uint256 amount,
        uint64  expiresAt
    ) external nonReentrant whenNotPaused {
        require(orders[orderId].status == Status.None, "ORDER_EXISTS");
        require(buyer != address(0) && token != address(0), "ZERO_ADDR");
        require(amount > 0, "ZERO_AMOUNT");
        require(expiresAt > block.timestamp, "BAD_EXPIRY");

        uint256 beforeBal = IERC20(token).balanceOf(address(this));
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "TRANSFER_FAILED");
        uint256 received = IERC20(token).balanceOf(address(this)) - beforeBal;
        require(received == amount, "FEE_ON_TRANSFER_NOT_SUPPORTED");

        orders[orderId] = EscrowOrder({
            seller: msg.sender,
            buyer: buyer,
            token: token,
            amount: amount,
            expiresAt: expiresAt,
            status: Status.Locked
        });

        emit Locked(orderId, msg.sender, buyer, token, amount, expiresAt);
    }

    function release(bytes32 orderId) external nonReentrant whenNotPaused {
        EscrowOrder storage o = orders[orderId];
        require(o.status == Status.Locked, "NOT_LOCKED");
        require(msg.sender == o.seller || arbiters[msg.sender], "NOT_AUTHORIZED");
        _release(orderId, o);
    }

    function _release(bytes32 orderId, EscrowOrder storage o) internal {
        uint256 fee = (o.amount * feeBps) / 10000;
        uint256 toBuyer = o.amount - fee;
        o.status = Status.Released;

        if (fee > 0) {
            require(IERC20(o.token).transfer(feeRecipient, fee), "FEE_XFER_FAILED");
        }
        require(IERC20(o.token).transfer(o.buyer, toBuyer), "BUYER_XFER_FAILED");

        emit Released(orderId, o.buyer, toBuyer, fee);
    }

    function refund(bytes32 orderId) external nonReentrant {
        EscrowOrder storage o = orders[orderId];
        require(o.status == Status.Locked || o.status == Status.Disputed, "BAD_STATUS");
        bool sellerAfterExpiry = (msg.sender == o.seller && block.timestamp >= o.expiresAt && o.status == Status.Locked);
        bool isArbiter = arbiters[msg.sender];
        require(sellerAfterExpiry || isArbiter, "NOT_ALLOWED");

        o.status = Status.Refunded;
        require(IERC20(o.token).transfer(o.seller, o.amount), "REFUND_FAILED");
        emit Refunded(orderId, o.seller, o.amount);
    }

    function dispute(bytes32 orderId) external whenNotPaused {
        EscrowOrder storage o = orders[orderId];
        require(o.status == Status.Locked, "NOT_LOCKED");
        require(msg.sender == o.buyer || msg.sender == o.seller, "NOT_PARTY");
        o.status = Status.Disputed;
        emit Disputed(orderId, msg.sender);
    }

    function resolve(bytes32 orderId, bool toBuyer) external nonReentrant onlyArbiter {
        EscrowOrder storage o = orders[orderId];
        require(o.status == Status.Disputed, "NOT_DISPUTED");
        if (toBuyer) {
            _release(orderId, o);
            emit Resolved(orderId, o.buyer, o.amount);
        } else {
            o.status = Status.Refunded;
            require(IERC20(o.token).transfer(o.seller, o.amount), "REFUND_FAILED");
            emit Refunded(orderId, o.seller, o.amount);
            emit Resolved(orderId, o.seller, o.amount);
        }
    }

    function getOrder(bytes32 orderId) external view returns (EscrowOrder memory) {
        return orders[orderId];
    }
}
