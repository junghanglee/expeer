# EXPEER UX Flow v3

_Last updated: 2026-05-20 21:08 KST_

## 0. Approved Direction

- Keep the existing bottom-menu direction. Do not merge or hide `P2P환전` and `교환`.
- `P2P환전` means fiat currency <-> crypto/stablecoin trading.
- `교환` means crypto <-> crypto trading.
- Both flows should use the same mental model: **내가 줄 것 / 내가 받을 것**.
- Do not ask the user to choose Buy/Sell directly. Derive intent from the selected give/receive assets.
- Users can either join an existing matching offer or register their own offer advertisement with their desired conditions.
- If a user with an active own conflicting offer joins someone else's offer, ask whether to keep, pause, or cancel the existing offer before starting the trade.
- Offer lists must prioritize offers that are objectively favorable to the acting user:
  - Buyer: sell offers below market price are favored.
  - Seller: buy offers above market price are favored.
  - Swap user: offers with better-than-reference exchange rate are favored.
- Favorable offers should be visually emphasized with `BEST`, `시세보다 유리`, and percentage badges.

## 1. Shared UX Pattern

Every trade page starts from:

```text
[내가 줄 것]  ⇄  [내가 받을 것]
[주는 수량/금액]  [예상 수령]
[자동 판단 배지]
[기준 시세/교환비]
[조건에 맞는 오퍼 리스트]
[이 조건으로 오퍼광고 등록]
```

### Shared Actions

1. Select give asset.
2. Select receive asset.
3. Enter amount.
4. See matching offers sorted by user advantage.
5. Either:
   - Join an existing offer, or
   - Register the current condition as a new offer advertisement.

## 2. P2P환전 Flow

### Purpose

Fiat <-> crypto/stablecoin exchange, currently centered on KRW and stablecoins.

### Allowed Pair Types

| Give          | Receive       | Derived Intent     |
| ------------- | ------------- | ------------------ |
| KRW           | USDT/USDC/DAI | Buy selected coin  |
| USDT/USDC/DAI | KRW           | Sell selected coin |

### Disallowed Pair Types

| Give       | Receive    | Handling            |
| ---------- | ---------- | ------------------- |
| KRW        | KRW        | Invalid             |
| crypto     | crypto     | Send user to `교환` |
| same asset | same asset | Invalid             |

### P2P환전 Main Page

Route: `/app/market` (`src/routes/app.market.tsx`)

Required sections:

1. Compact header.
2. Give/receive selector.
3. Swap-direction button.
4. Auto intent badge:
   - `USDT 구매`
   - `USDT 판매`
5. Amount input:
   - If give is KRW, input KRW and estimate coin.
   - If give is coin, input coin and estimate KRW.
6. Mini market price:
   - `1 USDT ≈ 1,380 KRW`
   - change percentage.
7. Filters:
   - Bank/payment method.
   - Order mode: all/partial.
   - Sort.
8. Offer list.
9. CTA: `이 조건으로 오퍼광고 등록`.

### Matching Rules

If user selects `KRW -> USDT`:

- User wants to buy USDT.
- Show sell offers for USDT.
- CTA: `USDT 구매`.

If user selects `USDT -> KRW`:

- User wants to sell USDT.
- Show buy offers for USDT.
- CTA: `USDT 판매`.

### P2P Offer Registration

Route: `/app/selling/new` (`src/routes/app.selling.new.tsx`)

Input should support search params:

```text
/app/selling/new?give=KRW&receive=USDT&amount=1000000
/app/selling/new?give=USDT&receive=KRW&amount=500
```

Required fields:

- Give asset.
- Receive asset.
- Unit price.
- Coin amount.
- KRW amount auto-calculation.
- Full order only vs partial order allowed.
- Min/max order if partial.
- Bank transfer account.
- Wallet requirement.
- Terms.
- Summary.

Derived offer side:

- `KRW -> coin` = buy offer.
- `coin -> KRW` = sell offer.

### P2P Order Start

Route: `/app/order/new/$adId` (`src/routes/app.order.new.$adId.tsx`)

Responsibilities:

- Show selected offer summary.
- Confirm give/receive amounts.
- Enforce full-only vs partial constraints.
- Confirm bank/wallet readiness.
- Detect active own conflicting offers.
- Ask keep/pause/cancel before order creation.

## 3. 교환 Flow

### Purpose

Crypto <-> crypto exchange. No fiat and no bank transfer.

### Allowed Pair Types

| Give         | Receive          |
| ------------ | ---------------- |
| USDT         | USDC/DAI/etc.    |
| USDC         | USDT/DAI/etc.    |
| DAI          | USDT/USDC/etc.   |
| BTC/ETH/etc. | supported crypto |

### Disallowed Pair Types

| Give       | Receive    | Handling               |
| ---------- | ---------- | ---------------------- |
| KRW        | crypto     | Send user to `P2P환전` |
| crypto     | KRW        | Send user to `P2P환전` |
| same asset | same asset | Invalid                |

### Swap Main Page

Route: `/app/swap` (`src/routes/app.swap.tsx`)

Required sections:

1. Give coin selector.
2. Receive coin selector.
3. Swap-direction button.
4. Give amount.
5. Estimated receive amount.
6. Reference exchange rate.
7. Network selectors.
8. Matching swap offer list.
9. CTA: `이 조건으로 교환 오퍼광고 등록`.

### Swap Offer Registration

New route: `/app/swap/new` (`src/routes/app.swap.new.tsx`)

Search params:

```text
/app/swap/new?give=USDT&receive=USDC&amount=100
```

Required fields:

- Give coin.
- Receive coin.
- Give network.
- Receive network.
- Give total amount.
- Receive total amount.
- Computed exchange rate.
- Full swap only vs partial swap allowed.
- Min/max swap amount if partial.
- Wallet selection.
- Terms.
- Summary.

### Swap Order Start

New route: `/app/swap/order/new/$offerId` (`src/routes/app.swap.order.new.$offerId.tsx`)

Responsibilities:

- Show selected swap offer.
- Confirm give/receive amounts.
- Enforce full/partial constraints.
- Confirm wallet/network readiness.
- Detect active own conflicting swap offers.
- Ask keep/pause/cancel before order creation.

## 4. Existing Offer Conflict Flow

Triggered when user joins another offer while having an active own offer that can conflict by asset, direction, and available amount.

### Modal Copy

```text
이미 등록된 오퍼광고가 있습니다

현재 등록된 [asset] [구매/판매/교환] 오퍼가 있습니다.
이 거래에 참여하면 보유 수량 또는 거래 가능 금액이 중복될 수 있습니다.

어떻게 처리할까요?

[기존 오퍼 유지하고 거래]
[기존 오퍼 일시중지 후 거래]  ← recommended
[기존 오퍼 취소 후 거래]
[돌아가기]
```

### Options

1. Keep existing offer:
   - Allow only if balance/limits are sufficient.
   - Warn about duplicate fill risk.
2. Pause existing offer:
   - Recommended default.
   - Set active offer to paused before creating order.
   - After order completion, ask whether to reactivate.
3. Cancel existing offer:
   - End existing offer permanently.
   - Then create order.
4. Go back:
   - Do not create order.

## 5. Offer Ranking Policy

### P2P Buy Case

User gives KRW and receives coin.

User wants the cheapest sell offer.

Priority:

1. Sell offers below market.
2. Lower unit price.
3. Enough available amount.
4. High counterparty trust.
5. Partial order allowed.
6. Fast processing.
7. Lower risk.

Badge examples:

- `BEST`
- `시세보다 1.2% 저렴`
- `유리한 구매가`

### P2P Sell Case

User gives coin and receives KRW.

User wants the highest buy offer.

Priority:

1. Buy offers above market.
2. Higher unit price.
3. Enough available amount.
4. High counterparty trust.
5. Partial order allowed.
6. Fast processing.
7. Lower risk.

Badge examples:

- `BEST`
- `시세보다 1.2% 높음`
- `유리한 판매가`

### Swap Case

User gives coin A and receives coin B.

User wants more receive coin per give coin.

Priority:

1. Better-than-reference rate.
2. More receive amount.
3. Enough liquidity.
4. Partial swap allowed.
5. Network compatibility.
6. High counterparty trust.
7. Lower risk.

Badge examples:

- `BEST SWAP`
- `기준보다 0.8% 유리`
- `더 많이 받음`

### Ranking Score Concept

```text
score = priceAdvantage
      + marketAdvantageBonus
      + trustScore
      + liquidityScore
      + partialAllowedBonus
      + speedBonus
      - activeOrderPenalty
      - riskPenalty
```

## 6. Order/Activity Pages

Routes:

- `/app/orders`
- `/app/order/$orderId`
- `/app/order/$orderId/chat`
- `/app/order/$orderId/proof`
- `/app/order/$orderId/dispute`
- `/app/order/$orderId/review`

### Order Types

1. `P2P환전`
   - fiat <-> crypto.
   - Bank transfer evidence.
   - One crypto escrow side.
2. `교환`
   - crypto <-> crypto.
   - Transaction hash evidence.
   - Two-sided or conditional escrow.

### Order List Filters

- 전체
- P2P환전
- 교환
- 진행중
- 완료
- 분쟁

### P2P Order Steps

Buyer `KRW -> coin`:

1. Order created.
2. Seller locks crypto in escrow.
3. Buyer sends bank transfer.
4. Buyer marks payment complete.
5. Seller confirms payment.
6. Crypto released.
7. Completed.

Seller `coin -> KRW`:

1. Order created.
2. Seller locks crypto in escrow.
3. Buyer bank transfer pending.
4. Seller confirms payment.
5. Crypto released.
6. Completed.

### Swap Order Steps

1. Order created.
2. Party A locks crypto.
3. Party B locks crypto.
4. Both locks confirmed.
5. Swap executed.
6. Both receipt confirmed.
7. Completed.

## 7. Implementation Sequence

1. Create/fix this UX document.
2. Rebuild P2P main page.
3. Rebuild P2P offer registration.
4. Add P2P order-start conflict handling.
5. Rebuild swap main page.
6. Add swap offer registration page.
7. Add swap order-start page.
8. Clean up order/activity pages for P2P vs swap types.
9. Run typecheck/build after each major block.
10. Report completed work with URLs and fixed test account.
