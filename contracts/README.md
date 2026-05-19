# Expeer Smart Contracts

## 컨트랙트 개요

| 컨트랙트                  | 용도                                                           | 상태          |
| ------------------------- | -------------------------------------------------------------- | ------------- |
| `ExpeerEscrowVault.sol`   | V1 — 최소 기능 (단일 arbiter)                                  | 호환용 보존   |
| `ExpeerEscrowVaultV2.sol` | V2 — 다중 arbiter, Pausable, ReentrancyGuard, 2-step ownership | **운영 권장** |

## V2 신규 기능

- ✅ **다중 arbiter**: `setArbiter(addr, true/false)`로 여러 명 등록 — 어느 한 명이라도 권한 행사 가능
- ✅ **Pausable**: 비상 시 `pause()`로 신규 lock/release/dispute 차단 (refund는 계속 가능)
- ✅ **ReentrancyGuard**: 모든 외부 토큰 콜에 nonReentrant 적용
- ✅ **2-step ownership**: `transferOwnership` → 새 owner가 `acceptOwnership` 호출해야 적용 (실수 방지)
- ✅ **명시적 이벤트**: `ArbiterUpdated`, `FeeUpdated`, `Resolved` 등 인덱싱 강화

## Flow (V1/V2 동일)

```
1. seller.approve(vault, amount)
2. seller.lock(orderId, buyer, token, amount, expiresAt)   → 코인 락업
3a. seller.release(orderId)                                 → 구매자 지급 (fee 차감)
3b. seller.refund(orderId)        [만료 후]                  → 판매자 환불
3c. dispute(orderId) → arbiter.resolve(orderId, toBuyer)    → 분쟁 해결
```

## 배포 — Foundry (권장)

### 1. Foundry 설치 (로컬)

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### 2. 의존성 설치

```bash
cd contracts
forge install foundry-rs/forge-std --no-commit
```

### 3. 테스트

```bash
forge test -vv
```

### 4. 배포 (Base Sepolia 테스트넷)

```bash
export PRIVATE_KEY=0x...
export ARBITER=0x...           # 운영자(분쟁 해결) 지갑
export FEE_RECIPIENT=0x...     # 수수료 수령 지갑
export FEE_BPS=50              # 0.5%
export BASESCAN_API_KEY=...    # verify용

forge script script/Deploy.s.sol \
  --rpc-url base_sepolia \
  --broadcast --verify
```

### 5. 메인넷 배포 전 체크리스트

- [ ] 테스트넷에서 최소 100건 이상 정상 거래/분쟁/환불 시뮬레이션
- [ ] **외부 감사** (CertiK, Hacken, OpenZeppelin 등) — 비감사 컨트랙트로 메인넷 운영 금지
- [ ] arbiter 멀티시그 (Safe) 사용 — EOA 단독 운영 금지
- [ ] feeRecipient도 멀티시그
- [ ] Pause 권한 운영 SOP 문서화
- [ ] Bug bounty 프로그램 (Immunefi 등) 검토

## 배포 — Remix IDE (간단한 테스트용)

1. https://remix.ethereum.org → `ExpeerEscrowVaultV2.sol` 업로드
2. Compiler 0.8.24, optimizer ON
3. Injected Provider (MetaMask) → Base Sepolia 선택
4. Deploy: `_arbiter`, `_feeRecipient`, `_feeBps=50`
5. 배포된 주소를 앱 설정(`app_settings.escrow_contracts`)에 등록

## 등록 위치

배포된 컨트랙트 주소는 백엔드 `app_settings` 테이블의 `escrow_contracts` 키에 저장:

```json
{
  "base-sepolia": "0x...",
  "base": "0x...",
  "polygon": "0x..."
}
```
