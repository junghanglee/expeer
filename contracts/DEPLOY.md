# ExpeerEscrowVaultV2 배포 가이드

> EXPEER는 비수탁 P2P 중개소다. 자금 이동의 진실의 원천(source of truth)은 이 컨트랙트 상태이며,
> 분쟁 발생 시 **EXPEER는 자료만 제공**하고 직접 중재/판정에 개입하지 않는다.
> `arbiter` 권한은 "판매자가 입금을 확인했다고 말했음에도 코인을 release 하지 않는" 예외적 사고를 위한
> **최후의 수단**으로만 사용한다 (이용약관에 명시).

---

## 0. 배포 전 체크리스트

| 항목                         | 설명                                                 |
| ---------------------------- | ---------------------------------------------------- |
| **배포자 EOA**               | 1회용 지갑 권장. 프라이빗키는 배포 직후 사용 중지.   |
| **`ARBITER` 멀티시그**       | Safe(Gnosis) 2-of-3 또는 3-of-5. 단일 EOA 절대 금지. |
| **`FEE_RECIPIENT` 멀티시그** | 수수료 수령용. arbiter와 분리된 별도 Safe 권장.      |
| **`FEE_BPS`**                | 50 = 0.5%, 100 = 1% (최대 500 = 5%).                 |
| **RPC 키**                   | Alchemy/Infura. (`ALCHEMY_API_KEY` 시크릿 등록 완료) |
| **BaseScan API 키**          | `--verify` 옵션용. https://basescan.org/myapikey     |

---

## 1. 환경 준비 (로컬)

```bash
# Foundry 설치
curl -L https://foundry.paradigm.xyz | bash
foundryup

# 의존성 (forge-std)
cd contracts
forge install foundry-rs/forge-std --no-commit
```

## 2. 환경변수

```bash
export PRIVATE_KEY=0x...                # 배포자 EOA
export ARBITER=0xSafeArbiter...         # 멀티시그
export FEE_RECIPIENT=0xSafeFee...       # 멀티시그
export FEE_BPS=50                       # 0.5%
export ALCHEMY_API_KEY=...
export BASESCAN_API_KEY=...
```

## 3. 단계별 배포

### A. Base Sepolia (테스트넷, 필수 선행)

```bash
forge script contracts/script/Deploy.s.sol \
  --rpc-url https://base-sepolia.g.alchemy.com/v2/$ALCHEMY_API_KEY \
  --broadcast --verify \
  --etherscan-api-key $BASESCAN_API_KEY
```

배포 로그에서 `ExpeerEscrowVaultV2 deployed at: 0x...` 주소를 복사한다.

### B. EXPEER 운영자 페이지에 주소 등록

1. `/expeeradmin/settings` 접속
2. **에스크로 컨트랙트 주소** 패널에서 `Base Sepolia (테스트넷)` 칸에 주소 입력
3. **주소 저장** 클릭

저장 직후 사용자 지갑 hook과 인덱서가 자동으로 이 주소를 사용한다.

### C. 테스트 거래 검증

- 테스트넷 USDT(또는 ERC20 모킹) → `lock` → `release` → 인덱서가 `escrow_status='completed'` 로 자동 반영되는지 확인.
- DB의 `orders.escrow_lock_tx_hash` / `escrow_release_tx_hash` 가 채워지는지 확인.
- BaseScan에서 이벤트 로그 확인.

### D. 메인넷 배포 (감사 후)

> ⚠️ 메인넷 배포 전 외부 감사(CertiK / Hacken / Sherlock) **필수**.

```bash
forge script contracts/script/Deploy.s.sol \
  --rpc-url https://base-mainnet.g.alchemy.com/v2/$ALCHEMY_API_KEY \
  --broadcast --verify \
  --etherscan-api-key $BASESCAN_API_KEY
```

운영자 설정 페이지에서 `Base Mainnet` 칸에 주소 등록.

---

## 4. 배포 직후 운영 작업

```solidity
// 추가 arbiter 등록 (멀티시그 다중화)
vault.setArbiter(0xExtraSafe, true)

// 배포자 EOA → 멀티시그로 owner 이전 (2-step)
vault.transferOwnership(0xOwnerSafe)
// (Owner Safe 측에서)
vault.acceptOwnership()
```

이후 배포자 EOA는 폐기.

---

## 5. 사용자가 준비해줘야 할 것 (요약)

1. **배포자 EOA 프라이빗키** — 1회용. 배포 후 즉시 폐기.
2. **Safe 멀티시그 2개** — `ARBITER` / `FEE_RECIPIENT` 용 (Base 체인). https://app.safe.global
3. **BaseScan API 키** — 컨트랙트 verify 용.
4. **테스트넷 ETH** — Base Sepolia faucet (https://www.alchemy.com/faucets/base-sepolia)
5. **메인넷 ETH** — 배포 가스비 약 0.005~0.01 ETH.

준비되면 위 환경변수만 알려주면(프라이빗키 제외, BaseScan 키만 시크릿으로) 사용자가 직접 명령 실행 후 주소만 운영자 페이지에 등록하면 된다.

---

## 6. 약관 명문화 권장 문구

> EXPEER는 P2P 중개 플랫폼이며, 거래 분쟁의 1차 확인 권한은 판매자에게 있습니다.
> EXPEER는 (i) 가입자 신원과 입금 통장 명의의 일치 여부 검증과 (ii) 거래 자료의 보존·발급
> 외에는 분쟁에 개입하지 않습니다. 판매자가 입금을 확인했음에도 부당하게 코인 지급을
> 거부한 경우에 한해, 보존된 자료에 근거하여 EXPEER가 운영하는 멀티시그(arbiter)가
> 스마트컨트랙트 상의 자금을 정산할 수 있습니다.
