# 온체인 에스크로 스마트컨트랙트 통합 — 실행 계획

## 핵심 원칙 (재확인)

- **비수탁(non-custodial)**: 우리는 코인을 보관하지 않는다. 컨트랙트가 자산을 holding.
- **스마트컨트랙트 단독 책임**: 입금이 확인되면 코인의 전송을 보장. 그 외 모든 흐름(주문/채팅/입금확인)은 온체인 외부에서 처리.
- **확인 권한**: 1차 확인은 판매자(채팅에서 수동 release). 최후 수단으로만 arbiter multi-sig.
- **분쟁 비개입**: 우리는 데이터 패키지(.zip)만 제공. arbiter는 판매자가 입금 확인 후 코인 거부 시에만 작동.

---

## 1단계: 컨트랙트 최종 검증 & 빌드 (코드 작업)

이미 작성된 `contracts/ExpeerEscrowVaultV2.sol`를 점검하고, foundry 빌드/테스트가 모두 통과하는지 확인.

체크 항목:

- USDT(non-standard ERC20, return-bool 누락) 호환을 위한 `SafeERC20.safeTransfer` 적용 여부
- 함수: `lock(orderId, token, seller, buyer, amount)`, `release(orderId)`, `refund(orderId)`, `arbiterResolve(orderId, toBuyer)`
- 이벤트: `Locked`, `Released`, `Refunded`, `ArbiterResolved` (인덱서가 구독)
- 권한: `release` = seller만, `refund` = seller + 만료조건, `arbiterResolve` = arbiter 주소만
- 수수료: `feeRecipient`, `feeBps` (기본 50 = 0.5%)
- Ownable2Step: 소유권 이전은 수락 필요(실수 방지)

## 2단계: 필요한 사용자 정보 수집 (보안 입력)

컨트랙트 배포에 필요한 4가지 시크릿을 한 번에 안전 입력 받는다. (다음 메시지에서 `add_secret` 호출)

| 시크릿 이름             | 용도                                                                                 | 어디서 얻나                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `DEPLOYER_PRIVATE_KEY`  | 컨트랙트 배포자 EOA 프라이빗키 (가스만 지불, 배포 후 소유권은 multi-sig로 이전 권장) | MetaMask → 계정 상세 → 프라이빗키 내보내기. **새 지갑 권장** (메인 지갑 사용 금지) |
| `ARBITER_ADDRESS`       | 최후 수단 중재자 주소 (multi-sig Safe 권장)                                          | https://app.safe.global 에서 Base 네트워크 Safe 생성                               |
| `FEE_RECIPIENT_ADDRESS` | 수수료 수령 주소 (Safe 권장)                                                         | 위와 동일하게 Safe 생성 (운영 자금용 별도)                                         |
| `BASESCAN_API_KEY`      | 컨트랙트 verify용                                                                    | https://basescan.org/myapikey (무료)                                               |

추가 준비물 (시크릿 아님):

- **Base Sepolia 테스트 ETH**: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet (배포자 주소로 0.05 ETH)
- **Base Mainnet ETH**: 배포자 주소에 약 0.01 ETH (메인넷 배포 시)

## 3단계: 테스트넷(Base Sepolia) 배포

시크릿 입력 후, 다음을 자동 실행:

1. `forge build && forge test` (단위 테스트)
2. `forge script Deploy.s.sol --rpc-url base_sepolia --broadcast --verify`
3. 배포된 주소를 `app_settings.escrow_contracts.base-sepolia`에 자동 저장
4. 어드민 패널에 표시되는지 확인

## 4단계: E2E 흐름 검증 (테스트넷)

실제 흐름을 한 번 돌려본다:

1. 판매자가 USDT(테스트넷 토큰) 발행 → vault.lock() 호출
2. DB `orders.escrow_status = 'locked'` 자동 동기화 (이미 만들어둔 chain-indexer가 처리)
3. 채팅에서 구매자 "입금 완료" → 판매자 "입금 확인 + 릴리즈" → vault.release()
4. 인덱서가 `Released` 이벤트 감지 → DB 상태 = `released`/`completed`
5. (실패 시나리오) 만료 후 vault.refund() 동작 확인
6. (분쟁 시나리오) arbiter 주소에서 vault.arbiterResolve() 호출 확인

## 5단계: 메인넷(Base Mainnet) 배포

테스트넷 검증 통과 시에만 진행:

1. 동일 스크립트, `--rpc-url base_mainnet`
2. 배포 직후 `vault.transferOwnership(safeAddress)` → Safe에서 `acceptOwnership()`
3. 어드민 패널에 메인넷 주소 등록
4. (선택) Polygon 추가 배포

## 6단계: 프론트엔드 마무리

- `useEscrowVault` 훅이 chain별 컨트랙트 주소를 `app_settings`에서 자동 로드 (이미 완료)
- 판매자 "에스크로 락업" 버튼이 USDT approve → lock 2단계로 동작 (확인 필요)
- 가스비/네트워크 안내 UI

---

## 기술 세부사항

- **체인**: Base Mainnet (USDT-Bridged), Base Sepolia (테스트), Polygon (선택)
- **토큰**: USDT (ERC20). Base 메인넷의 공식 USDT 컨트랙트 주소를 `app_settings.supported_tokens`에 등록
- **인덱서**: `src/utils/chain-indexer.functions.ts` (Alchemy logs API, pg_cron 1분 주기)
- **가스**: 사용자(판매자) 부담. 우리는 가스를 대납하지 않음 (비수탁 원칙)

---

## 다음 액션

이 계획에 동의하시면 **2단계 시크릿 입력 폼을 띄울게요**. (`DEPLOYER_PRIVATE_KEY`, `ARBITER_ADDRESS`, `FEE_RECIPIENT_ADDRESS`, `BASESCAN_API_KEY` 4개)

승인하시면 → 시크릿 폼 → 입력 후 자동으로 1·3단계(빌드/테스트넷 배포) 진행.
