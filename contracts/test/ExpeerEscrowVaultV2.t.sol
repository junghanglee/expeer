// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../ExpeerEscrowVaultV2.sol";

contract MockERC20 {
    string public name = "MockUSDC";
    string public symbol = "mUSDC";
    uint8  public decimals = 6;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function approve(address sp, uint256 a) external returns (bool) { allowance[msg.sender][sp] = a; return true; }
    function transfer(address to, uint256 a) external returns (bool) {
        balanceOf[msg.sender] -= a; balanceOf[to] += a; return true;
    }
    function transferFrom(address f, address t, uint256 a) external returns (bool) {
        require(allowance[f][msg.sender] >= a, "ALLOW");
        allowance[f][msg.sender] -= a;
        balanceOf[f] -= a; balanceOf[t] += a; return true;
    }
}

contract ExpeerEscrowVaultV2Test is Test {
    ExpeerEscrowVaultV2 vault;
    MockERC20 token;
    address owner = address(0xA11CE);
    address arbiter = address(0xB0B);
    address feeRecipient = address(0xFEE);
    address seller = address(0x5E11E2);
    address buyer = address(0xBABE);

    bytes32 constant ORDER_ID = keccak256("order-1");

    function setUp() public {
        vm.prank(owner);
        vault = new ExpeerEscrowVaultV2(arbiter, feeRecipient, 50); // 0.5%
        token = new MockERC20();
        token.mint(seller, 1_000_000e6);
        vm.prank(seller);
        token.approve(address(vault), type(uint256).max);
    }

    function _lock(uint256 amount) internal {
        vm.prank(seller);
        vault.lock(ORDER_ID, buyer, address(token), amount, uint64(block.timestamp + 1 hours));
    }

    function test_LockAndRelease() public {
        _lock(1000e6);
        vm.prank(seller);
        vault.release(ORDER_ID);
        assertEq(token.balanceOf(buyer), 995e6);     // 1000 - 0.5%
        assertEq(token.balanceOf(feeRecipient), 5e6);
    }

    function test_RefundAfterExpiry() public {
        _lock(500e6);
        vm.warp(block.timestamp + 2 hours);
        vm.prank(seller);
        vault.refund(ORDER_ID);
        assertEq(token.balanceOf(seller), 1_000_000e6);
    }

    function test_DisputeAndResolveToBuyer() public {
        _lock(200e6);
        vm.prank(buyer);
        vault.dispute(ORDER_ID);
        vm.prank(arbiter);
        vault.resolve(ORDER_ID, true);
        assertEq(token.balanceOf(buyer), 199e6);
    }

    function test_OnlySellerOrArbiterCanRelease() public {
        _lock(100e6);
        vm.expectRevert(bytes("NOT_AUTHORIZED"));
        vm.prank(buyer);
        vault.release(ORDER_ID);
    }

    function test_PauseBlocksLock() public {
        vm.prank(owner);
        vault.pause();
        vm.expectRevert(bytes("PAUSED"));
        _lock(100e6);
    }

    function test_TwoStepOwnership() public {
        address newOwner = address(0xDEAD);
        vm.prank(owner); vault.transferOwnership(newOwner);
        assertEq(vault.owner(), owner);
        vm.prank(newOwner); vault.acceptOwnership();
        assertEq(vault.owner(), newOwner);
    }

    function test_MultipleArbiters() public {
        address arb2 = address(0xC0DE);
        vm.prank(owner); vault.setArbiter(arb2, true);
        _lock(100e6);
        vm.prank(buyer); vault.dispute(ORDER_ID);
        vm.prank(arb2); vault.resolve(ORDER_ID, false);
        assertEq(token.balanceOf(seller), 1_000_000e6);
    }

    function test_CannotDoubleLock() public {
        _lock(100e6);
        vm.expectRevert(bytes("ORDER_EXISTS"));
        _lock(100e6);
    }
}
