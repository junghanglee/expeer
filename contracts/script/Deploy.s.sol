// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../ExpeerEscrowVaultV2.sol";

/**
 * Foundry deploy script.
 *
 * 환경변수:
 *   PRIVATE_KEY   배포자 프라이빗키
 *   ARBITER       arbiter 주소
 *   FEE_RECIPIENT 수수료 수령 주소
 *   FEE_BPS       수수료 (50 = 0.5%)
 *
 * 실행 (Base Sepolia 예시):
 *   forge script contracts/script/Deploy.s.sol \
 *     --rpc-url https://sepolia.base.org \
 *     --broadcast --verify
 */
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address arbiter = vm.envAddress("ARBITER");
        address feeRecipient = vm.envAddress("FEE_RECIPIENT");
        uint16 feeBps = uint16(vm.envUint("FEE_BPS"));

        vm.startBroadcast(pk);
        ExpeerEscrowVaultV2 vault = new ExpeerEscrowVaultV2(arbiter, feeRecipient, feeBps);
        vm.stopBroadcast();

        console2.log("ExpeerEscrowVaultV2 deployed at:", address(vault));
    }
}
