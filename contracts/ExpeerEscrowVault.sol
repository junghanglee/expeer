// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ExpeerEscrowVault
 * @notice 최소 P2P 에스크로 컨트랙트
 *  - 판매자가 토큰을 락업(lock)
 *  - 구매자 KRW 입금 후, 판매자 또는 arbiter가 release
 *  - 미입금 시 판매자가 timeout 후 환불
 *  - 분쟁 시 arbiter가 일방 결정
 *
 *  법적 검토 X · 비감사 · 메인넷 사용 시 감사 권장
 */

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract ExpeerEscrowVault {
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
    address public arbiter;
    uint16  public feeBps;        // 수수료 (e.g. 50 = 0.5%)
    address public feeRecipient;

    mapping(bytes32 => EscrowOrder) public orders;

    event Locked(bytes32 indexed orderId, address indexed seller, address indexed buyer, address token, uint256 amount, uint64 expiresAt);
    event Released(bytes32 indexed orderId, address indexed buyer, uint256 amountToBuyer, uint256 fee);
    event Refunded(bytes32 indexed orderId, address indexed seller, uint256 amount);
    event Disputed(bytes32 indexed orderId, address indexed by);
    event Resolved(bytes32 indexed orderId, address indexed winner, uint256 amount);

    modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }
    modifier onlyArbiter() { require(msg.sender == arbiter, "not arbiter"); _; }

    constructor(address _arbiter, address _feeRecipient, uint16 _feeBps) {
        require(_arbiter != address(0) && _feeRecipient != address(0), "zero addr");
        require(_feeBps <= 500, "fee too high"); // max 5%
        owner = msg.sender;
        arbiter = _arbiter;
        feeRecipient = _feeRecipient;
        feeBps = _feeBps;
    }

    // === Admin ===
    function setArbiter(address a) external onlyOwner { require(a != address(0), "zero"); arbiter = a; }
    function setFee(address r, uint16 bps) external onlyOwner {
        require(r != address(0), "zero"); require(bps <= 500, "fee too high");
        feeRecipient = r; feeBps = bps;
    }
    function transferOwnership(address n) external onlyOwner { require(n != address(0), "zero"); owner = n; }

    // === Core flow ===

    /// @notice 판매자가 호출. 사전에 token.approve(this, amount) 필요.
    function lock(
        bytes32 orderId,
        address buyer,
        address token,
        uint256 amount,
        uint64  expiresAt
    ) external {
        require(orders[orderId].status == Status.None, "exists");
        require(buyer != address(0) && token != address(0), "zero addr");
        require(amount > 0, "zero amount");
        require(expiresAt > block.timestamp, "bad expiry");

        // pull tokens
        uint256 beforeBal = IERC20(token).balanceOf(address(this));
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "transferFrom failed");
        uint256 received = IERC20(token).balanceOf(address(this)) - beforeBal;
        require(received == amount, "fee-on-transfer not supported");

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

    /// @notice 판매자가 KRW 입금 확인 후 호출 (또는 arbiter)
    function release(bytes32 orderId) external {
        EscrowOrder storage o = orders[orderId];
        require(o.status == Status.Locked, "not locked");
        require(msg.sender == o.seller || msg.sender == arbiter, "not authorized");
        _release(orderId, o);
    }

    function _release(bytes32 orderId, EscrowOrder storage o) internal {
        uint256 fee = (o.amount * feeBps) / 10000;
        uint256 toBuyer = o.amount - fee;
        o.status = Status.Released;

        if (fee > 0) {
            require(IERC20(o.token).transfer(feeRecipient, fee), "fee xfer failed");
        }
        require(IERC20(o.token).transfer(o.buyer, toBuyer), "buyer xfer failed");

        emit Released(orderId, o.buyer, toBuyer, fee);
    }

    /// @notice 만료 후 판매자 환불, 또는 arbiter 환불
    function refund(bytes32 orderId) external {
        EscrowOrder storage o = orders[orderId];
        require(o.status == Status.Locked || o.status == Status.Disputed, "bad status");
        bool sellerAfterExpiry = (msg.sender == o.seller && block.timestamp >= o.expiresAt && o.status == Status.Locked);
        bool isArbiter = (msg.sender == arbiter);
        require(sellerAfterExpiry || isArbiter, "not allowed");

        o.status = Status.Refunded;
        require(IERC20(o.token).transfer(o.seller, o.amount), "refund failed");
        emit Refunded(orderId, o.seller, o.amount);
    }

    /// @notice 양 당사자 분쟁 신청
    function dispute(bytes32 orderId) external {
        EscrowOrder storage o = orders[orderId];
        require(o.status == Status.Locked, "not locked");
        require(msg.sender == o.buyer || msg.sender == o.seller, "not party");
        o.status = Status.Disputed;
        emit Disputed(orderId, msg.sender);
    }

    /// @notice arbiter가 분쟁 해결 (구매자 또는 판매자에게 지급)
    function resolve(bytes32 orderId, bool toBuyer) external onlyArbiter {
        EscrowOrder storage o = orders[orderId];
        require(o.status == Status.Disputed, "not disputed");
        if (toBuyer) {
            _release(orderId, o);
        } else {
            o.status = Status.Refunded;
            require(IERC20(o.token).transfer(o.seller, o.amount), "refund failed");
            emit Refunded(orderId, o.seller, o.amount);
        }
    }

    // === Views ===
    function getOrder(bytes32 orderId) external view returns (EscrowOrder memory) {
        return orders[orderId];
    }
}
