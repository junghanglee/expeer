# EXPEER Supabase 교체/이관 체크리스트

이 문서는 Lovable이 만든 기존 Supabase 프로젝트에서 사장님 소유 Supabase 프로젝트로 안전하게 교체하기 위한 절차입니다.

## 현재 연결 정보

- 현재 project id: `pwflllrlidnylwmzheza`
- 현재 URL: `https://pwflllrlidnylwmzheza.supabase.co`
- 로컬 설정 파일: `.env` / `supabase/config.toml`
- 마이그레이션 폴더: `supabase/migrations/`

## 절대 공유/커밋 금지

- Supabase 로그인 비밀번호
- DB Password
- `SUPABASE_SERVICE_ROLE_KEY`
- Access Token
- `.env` 파일 원문

`.gitignore`에는 `.env`, `.env.*`가 이미 포함되어 있어 커밋 대상에서 제외됩니다.

## 새 Supabase 프로젝트에서 받아야 할 값

Supabase Dashboard → Project Settings → API:

```env
SUPABASE_URL=https://새프로젝트.ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=새_anon_or_publishable_key
VITE_SUPABASE_PROJECT_ID=새프로젝트ref
VITE_SUPABASE_URL=https://새프로젝트.ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=새_anon_or_publishable_key
```

서버 관리자 기능/타입 생성/CLI 작업이 필요할 때만 별도로:

```env
SUPABASE_SERVICE_ROLE_KEY=절대_브라우저_노출_금지
```

## 새 프로젝트 생성 후 Supabase Dashboard 설정

### 1. Auth 설정

Authentication → Providers → Email

개발 중 추천:

- Email provider: ON
- Confirm email: OFF

Authentication → URL Configuration

개발 Redirect URL 예시:

```txt
http://localhost:8080/**
http://localhost:8081/**
http://localhost:8082/**
http://localhost:8083/**
http://localhost:5173/**
```

배포 후 실제 도메인도 추가해야 합니다.

### 2. DB 스키마 적용

현재 프로젝트에는 `supabase/migrations/` 아래 26개 SQL 마이그레이션이 있습니다.
새 프로젝트에 순서대로 적용해야 합니다.

권장 방법 A — Supabase CLI 사용:

```bash
npx supabase login
npx supabase link --project-ref 새프로젝트ref
npx supabase db push
```

주의: 로컬 PC에는 전역 `supabase` CLI가 없지만, `npx supabase --version`은 동작 확인됨.

대안 방법 B — Dashboard SQL Editor 사용:

- `supabase/migrations/` 파일을 이름순으로 열기
- SQL Editor에서 순서대로 실행
- 오류가 나면 중단 후 오류 메시지 확인

### 3. 필수 Storage bucket

마이그레이션에 포함되어 있음:

- `kyc-documents` private
- `payment-proofs` private

SQL 적용 후 Storage 메뉴에서 두 버킷이 생성되었는지 확인합니다.

### 4. 필수 테이블

현재 코드 기준 주요 테이블:

- `profiles`
- `user_roles`
- `ads`
- `orders`
- `messages`
- `bank_accounts`
- `wallets`
- `kyc_submissions`
- `payment_proofs`
- `transfers`
- `disputes`
- `reviews`
- `notifications`
- `evidence_packages`
- `app_settings`

### 5. 회원가입 자동 생성 흐름

마이그레이션에는 `auth.users` 생성 시 아래 자동 생성 트리거가 포함되어 있습니다.

- `profiles` row 자동 생성
- `user_roles`에 `user` role 자동 생성

회원가입 테스트 후 반드시 확인:

```sql
select * from public.profiles order by created_at desc limit 5;
select * from public.user_roles order by created_at desc limit 5;
```

## 로컬 앱 교체 순서

1. 새 Supabase 프로젝트 생성
2. 새 프로젝트에 마이그레이션 적용
3. Auth/Redirect 설정
4. `.env` 값 교체
5. `supabase/config.toml`의 `project_id` 교체
6. 연결 테스트 실행

```bash
node scripts/check-supabase.mjs
npm run check:types
npm run build
```

## 현재 작성된 연결 테스트

`scripts/check-supabase.mjs`는 `.env`에서 공개 URL/key만 읽어 아래 테이블 접근을 확인합니다.

- `profiles`
- `ads`
- `orders`
- `messages`
- `bank_accounts`
- `wallets`
- `app_settings`

## 교체 후 다음 개발 순서

1. 회원가입 실제 테스트
2. `profiles`, `user_roles` 자동 생성 확인
3. 로그인 후 `/app` 진입 확인
4. 계좌/지갑 등록을 DB 저장으로 검증
5. P2P환전/P2P교환 광고 등록을 `ads`에 저장
6. 거래 생성 시 `orders` + `messages` 채팅방 흐름 연결
