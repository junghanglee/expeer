import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

const SITE_TITLE = "EXPEER: Secure P2P Stablecoin Escrow";
const SITE_DESC =
  "Trade USDT and USDC safely on EXPEER with non-custodial P2P escrow, No-KYC privacy, and anti-scam protection.";
const LOGO_ICON = "/expeer-logo.png";
const SOCIAL_IMAGE =
  "https://storage.googleapis.com/gpt-engineer-file-uploads/fqLfYHM8DRWiLyi8KiC1ifrMcQ72/social-images/social-1777361843649-EXPEER_(1).webp";
const FONT_STYLESHEET =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="max-w-md text-center anim-fade-up">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-primary text-2xl font-bold">
          404
        </div>
        <h2 className="text-xl font-bold text-foreground">페이지를 찾을 수 없어요</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          주소가 변경되었거나 더 이상 존재하지 않는 페이지입니다.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: SITE_TITLE },
      { name: "description", content: SITE_DESC },
      { property: "og:title", content: SITE_TITLE },
      { property: "og:description", content: SITE_DESC },
      { property: "og:type", content: "website" },
      { property: "og:image", content: SOCIAL_IMAGE },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:image", content: SOCIAL_IMAGE },
      { name: "twitter:title", content: SITE_TITLE },
      { name: "twitter:description", content: SITE_DESC },
      { title: "EXPEER: Secure No-KYC P2P Stablecoin Escrow Exchange" },
      { property: "og:title", content: "EXPEER: Secure No-KYC P2P Stablecoin Escrow Exchange" },
      { name: "twitter:title", content: "EXPEER: Secure No-KYC P2P Stablecoin Escrow Exchange" },
      {
        name: "description",
        content:
          "Trade USDT/USDC securely on EXPEER. Our non-custodial P2P escrow ensures no-KYC privacy and anti-scam protection for safe stablecoin exchange P2P Crypto",
      },
      {
        property: "og:description",
        content:
          "Trade USDT/USDC securely on EXPEER. Our non-custodial P2P escrow ensures no-KYC privacy and anti-scam protection for safe stablecoin exchange P2P Crypto",
      },
      {
        name: "twitter:description",
        content:
          "Trade USDT/USDC securely on EXPEER. Our non-custodial P2P escrow ensures no-KYC privacy and anti-scam protection for safe stablecoin exchange P2P Crypto",
      },
      {
        property: "og:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/fqLfYHM8DRWiLyi8KiC1ifrMcQ72/social-images/social-1777362227081-EXPEER_(1).webp",
      },
      {
        name: "twitter:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/fqLfYHM8DRWiLyi8KiC1ifrMcQ72/social-images/social-1777362227081-EXPEER_(1).webp",
      },
    ],
    links: [
      { rel: "icon", type: "image/png", href: LOGO_ICON },
      { rel: "apple-touch-icon", href: LOGO_ICON },
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: FONT_STYLESHEET },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
