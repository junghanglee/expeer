import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ocrInputSchema = z.object({
  imageBase64: z.string().min(50),
  mimeType: z.string().default("image/jpeg"),
});

export type KycOcrResult = {
  ok: boolean;
  fullName?: string;
  idNumber?: string;
  idType?: string;
  birthDate?: string;
  raw?: string;
  error?: string;
};

/**
 * 신분증 이미지에서 이름·번호·종류·생년월일을 OCR로 추출.
 * Lovable AI Gateway(google/gemini-2.5-flash) 사용.
 */
export const ocrIdCard = createServerFn({ method: "POST" })
  .inputValidator((input) => ocrInputSchema.parse(input))
  .handler(async ({ data }): Promise<KycOcrResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: false, error: "AI 게이트웨이가 구성되지 않았습니다." };

    const dataUrl = `data:${data.mimeType};base64,${data.imageBase64}`;
    const prompt = `너는 한국 신분증(주민등록증/운전면허증/여권) OCR 전문가다.
이미지에서 다음을 정확히 JSON으로만 추출하라. 모르면 빈 문자열.
{
  "fullName": "이름(한글)",
  "idNumber": "주민/면허/여권 번호 (하이픈 포함 원문)",
  "idType": "주민등록증" | "운전면허증" | "여권",
  "birthDate": "YYYY-MM-DD"
}
설명·코드블록 없이 JSON만 반환.`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        return { ok: false, error: `OCR 요청 실패 (${res.status}): ${txt.slice(0, 200)}` };
      }
      const json = await res.json();
      const content: string = json?.choices?.[0]?.message?.content ?? "";
      const cleaned = content
        .replace(/```json\s*/gi, "")
        .replace(/```/g, "")
        .trim();
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (!m) return { ok: false, raw: content, error: "응답에서 JSON을 찾을 수 없습니다." };
      const parsed = JSON.parse(m[0]);
      return {
        ok: true,
        fullName: String(parsed.fullName ?? "").trim(),
        idNumber: String(parsed.idNumber ?? "").trim(),
        idType: String(parsed.idType ?? "").trim(),
        birthDate: String(parsed.birthDate ?? "").trim(),
        raw: content,
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "OCR 처리 오류" };
    }
  });

const faceMatchSchema = z.object({
  idImageBase64: z.string().min(50),
  selfieBase64: z.string().min(50),
  mimeType: z.string().default("image/jpeg"),
});

export type FaceMatchResult = {
  ok: boolean;
  matched?: boolean;
  confidence?: number;
  reason?: string;
  error?: string;
};

/**
 * 신분증 사진과 셀카가 동일 인물인지 비교.
 */
export const verifyFaceMatch = createServerFn({ method: "POST" })
  .inputValidator((input) => faceMatchSchema.parse(input))
  .handler(async ({ data }): Promise<FaceMatchResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: false, error: "AI 게이트웨이가 구성되지 않았습니다." };

    const idUrl = `data:${data.mimeType};base64,${data.idImageBase64}`;
    const selfieUrl = `data:${data.mimeType};base64,${data.selfieBase64}`;
    const prompt = `두 이미지를 비교해 동일 인물인지 판단하라.
첫 번째는 신분증 사진, 두 번째는 셀카다.
JSON만 반환: {"matched": true|false, "confidence": 0~1, "reason": "간단 설명"}`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: idUrl } },
                { type: "image_url", image_url: { url: selfieUrl } },
              ],
            },
          ],
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        return { ok: false, error: `얼굴 비교 실패 (${res.status}): ${txt.slice(0, 200)}` };
      }
      const json = await res.json();
      const content: string = json?.choices?.[0]?.message?.content ?? "";
      const m = content.replace(/```json|```/g, "").match(/\{[\s\S]*\}/);
      if (!m) return { ok: false, error: "응답 파싱 실패" };
      const parsed = JSON.parse(m[0]);
      return {
        ok: true,
        matched: !!parsed.matched,
        confidence: Number(parsed.confidence ?? 0),
        reason: String(parsed.reason ?? ""),
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "비교 오류" };
    }
  });
