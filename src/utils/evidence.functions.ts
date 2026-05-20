import { createServerFn } from "@tanstack/react-start";
import { zipSync, strToU8 } from "fflate";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

function maskAccount(s: string | null | undefined) {
  if (!s) return "";
  if (s.length <= 4) return "****";
  return s.slice(0, 2) + "****" + s.slice(-2);
}

function maskAddress(s: string | null | undefined) {
  if (!s) return "";
  if (s.length <= 10) return "****";
  return s.slice(0, 6) + "..." + s.slice(-4);
}

type SupabaseLike = SupabaseClient<Database>;

type EvidenceContext = {
  supabase: SupabaseLike;
  userId: string;
};

type OrderRecord = Database["public"]["Tables"]["orders"]["Row"];
type MessageRecord = Database["public"]["Tables"]["messages"]["Row"];
type TransferRecord = Database["public"]["Tables"]["transfers"]["Row"];

export const buildEvidencePackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as EvidenceContext;
    const { orderId } = data;

    // 1) Order — RLS가 당사자만 허용
    const { data: order, error: oErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();
    if (oErr || !order) {
      throw new Error("주문을 찾을 수 없거나 접근 권한이 없습니다");
    }

    const isBuyer = order.buyer_id === userId;
    const isSeller = order.seller_id === userId;
    if (!isBuyer && !isSeller) {
      throw new Error("거래 당사자만 자료를 발급받을 수 있습니다");
    }

    // 2) 관련 데이터 병렬 조회
    const [messagesRes, proofsRes, transfersRes, disputesRes, buyerProf, sellerProf] =
      await Promise.all([
        supabase.from("messages").select("*").eq("order_id", orderId).order("created_at"),
        supabase.from("payment_proofs").select("*").eq("order_id", orderId),
        supabase.from("transfers").select("*").eq("order_id", orderId),
        supabase.from("disputes").select("*").eq("order_id", orderId),
        supabase.from("profiles").select("nickname,email").eq("id", order.buyer_id).maybeSingle(),
        supabase.from("profiles").select("nickname,email").eq("id", order.seller_id).maybeSingle(),
      ]);

    const messages = (messagesRes.data ?? []) as MessageRecord[];
    const proofs = proofsRes.data ?? [];
    const transfers = (transfersRes.data ?? []) as TransferRecord[];
    const disputes = disputesRes.data ?? [];

    // 3) 마스킹된 요약
    const summary = {
      issued_at: new Date().toISOString(),
      issued_to: userId,
      role: isBuyer ? "buyer" : "seller",
      order: {
        id: order.id,
        status: order.status,
        asset: order.asset,
        network: order.network,
        fiat: order.fiat,
        price: order.price,
        amount: order.amount,
        fiat_amount: order.fiat_amount,
        created_at: order.created_at,
        paid_at: order.paid_at,
        confirmed_at: order.confirmed_at,
        released_at: order.released_at,
        completed_at: order.completed_at,
        cancelled_at: order.cancelled_at,
        buyer: {
          nickname: buyerProf.data?.nickname ?? null,
          email_masked: maskAccount(buyerProf.data?.email),
        },
        seller: {
          nickname: sellerProf.data?.nickname ?? null,
          email_masked: maskAccount(sellerProf.data?.email),
        },
      },
      counts: {
        messages: messages.length,
        payment_proofs: proofs.length,
        transfers: transfers.length,
        disputes: disputes.length,
      },
    };

    // 4) 채팅 로그 텍스트 (사람이 읽기 쉬운 형식)
    const chatLines = messages.map((m) => {
      const role =
        m.sender_id === order.buyer_id
          ? "[BUYER]"
          : m.sender_id === order.seller_id
            ? "[SELLER]"
            : "[SYSTEM]";
      return `${m.created_at}  ${role}  (${m.type})  ${m.content ?? ""}${m.attachment_url ? `  <첨부: ${m.attachment_url}>` : ""}`;
    });

    const transfersMasked = transfers.map((t) => ({
      ...t,
      to_address: maskAddress(t.to_address),
    }));

    // 5) 온체인 이벤트 증거 (에스크로 컨트랙트 트랜잭션 해시 + 상태 타임라인)
    const chainEvents = {
      chain: order.chain ?? null,
      escrow_contract_address: order.escrow_contract_address ?? null,
      escrow_order_id: order.escrow_order_id ?? null,
      escrow_order_id_hash: order.escrow_order_id_hash ?? null,
      escrow_status: order.escrow_status ?? null,
      events: [
        order.escrow_lock_tx_hash && {
          type: "Locked",
          tx_hash: order.escrow_lock_tx_hash,
          at: order.confirmed_at ?? order.created_at,
        },
        order.escrow_release_tx_hash && {
          type: "Released",
          tx_hash: order.escrow_release_tx_hash,
          at: order.released_at ?? order.completed_at,
        },
      ].filter(Boolean),
      explorer_hint:
        order.chain === "polygon"
          ? "https://polygonscan.com/tx/"
          : order.chain === "base"
            ? "https://basescan.org/tx/"
            : order.chain === "base-sepolia"
              ? "https://sepolia.basescan.org/tx/"
              : null,
    };

    const POLICY_TEXT = [
      "EXPEER 분쟁 처리 정책",
      "",
      "1. EXPEER는 비수탁 P2P 중개 플랫폼이며, 거래 분쟁을 직접 중재·판정하지 않습니다.",
      "2. 거래 자금(가상자산)은 스마트컨트랙트(에스크로)가 관리하며, 입금 확인의 1차 권한은 판매자에게 있습니다.",
      "3. EXPEER가 보장하는 최소 안전장치:",
      "   - 가입자 신원과 입금 통장 명의의 일치 여부 검증 (KYC)",
      "   - 거래 자료(채팅, 송금 증빙, 온체인 이벤트)의 보존 및 발급",
      "4. 분쟁 발생 시 1차 해결 책임은 거래 당사자에게 있으며, 본 자료를 활용해",
      "   당사자 협의 또는 관련 당국 신고 절차로 진행하시기 바랍니다.",
      "5. 예외 — '판매자가 입금을 확인했음에도 부당하게 코인 지급을 거부한 경우'에 한해,",
      "   보존된 자료에 근거하여 EXPEER가 운영하는 멀티시그(arbiter)가 컨트랙트 자금을",
      "   정산할 수 있습니다. 이는 최후의 수단이며, 자동 보장이 아닙니다.",
    ].join("\n");

    // 6) ZIP 생성
    const files: Record<string, Uint8Array> = {
      "README.txt": strToU8(
        [
          "EXPEER 제출용 거래 자료",
          "",
          `발급 시각: ${summary.issued_at}`,
          `주문 ID: ${order.id}`,
          `발급 대상: ${userId} (${summary.role})`,
          "",
          "본 자료는 EXPEER 플랫폼에 기록된 거래 내역의 사본입니다.",
          "경찰 신고 또는 은행 제출이 필요한 경우 참고 자료로 활용할 수 있습니다.",
          "EXPEER는 현금과 코인을 보관하지 않는 비수탁 P2P 중개 서비스입니다.",
          "",
          "포함 파일:",
          "- POLICY.txt          : EXPEER 분쟁 처리 정책 전문",
          "- summary.json        : 주문/당사자 요약 (개인정보 마스킹)",
          "- chat.txt            : 채팅 로그 전체 (사람이 읽기 쉬운 형식)",
          "- messages.json       : 채팅 원본 데이터",
          "- payment_proofs.json : 송금 증빙 메타데이터 (이미지 URL 포함)",
          "- transfers.json      : 온체인 이체 내역 (주소 마스킹)",
          "- chain_events.json   : 에스크로 컨트랙트 이벤트 (트랜잭션 해시)",
          "- disputes.json       : 자료 보존 신청 이력",
        ].join("\n"),
      ),
      "POLICY.txt": strToU8(POLICY_TEXT),
      "summary.json": strToU8(JSON.stringify(summary, null, 2)),
      "chat.txt": strToU8(chatLines.join("\n")),
      "messages.json": strToU8(JSON.stringify(messages, null, 2)),
      "payment_proofs.json": strToU8(JSON.stringify(proofs, null, 2)),
      "transfers.json": strToU8(JSON.stringify(transfersMasked, null, 2)),
      "chain_events.json": strToU8(JSON.stringify(chainEvents, null, 2)),
      "disputes.json": strToU8(JSON.stringify(disputes, null, 2)),
    };

    const zipBytes = zipSync(files, { level: 6 });

    // 6) 발급 로그 기록 (RLS 통과)
    await supabase.from("evidence_packages").insert({
      order_id: orderId,
      dispute_id: disputes[0]?.id ?? null,
      requested_by: userId,
      file_size_bytes: zipBytes.byteLength,
      item_counts: summary.counts,
    });

    // 7) Base64로 클라이언트에 전달 (다운로드는 클라이언트에서 Blob 변환)
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < zipBytes.length; i += chunk) {
      binary += String.fromCharCode(...zipBytes.subarray(i, i + chunk));
    }
    const base64 = btoa(binary);

    return {
      filename: `expeer-transaction-records-${order.id.slice(0, 8)}-${Date.now()}.zip`,
      contentBase64: base64,
      sizeBytes: zipBytes.byteLength,
      counts: summary.counts,
    };
  });
