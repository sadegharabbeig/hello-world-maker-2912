import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ReceiptRead = { amount_toman: number | null; date_jalali: string | null; tracking_code: string | null };

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["amount_toman", "date_jalali", "tracking_code"],
  properties: {
    amount_toman: { type: ["integer", "null"], description: "Amount in Toman (if receipt shows Rial, divide by 10)" },
    date_jalali: { type: ["string", "null"], description: "Solar Hijri date as YYYY/MM/DD with Latin digits" },
    tracking_code: { type: ["string", "null"], description: "Tracking / reference number (شماره پیگیری / مرجع), Latin digits" },
  },
};

export const readReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { image: string }) => {
    if (typeof d?.image !== "string" || !d.image.startsWith("data:image/") || d.image.length > 8_000_000)
      throw new Error("invalid image");
    return d;
  })
  .handler(async ({ data, context }): Promise<ReceiptRead> => {
    const { data: ok } = await context.supabase.rpc("can_edit", { _user_id: context.userId });
    if (!ok) throw new Error("forbidden");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env['LOVABLE_API_KEY']}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        reasoning: { effort: "low" },
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: "This is an Iranian bank transfer receipt. Extract the amount (in Toman; convert Rial to Toman by dividing by 10), the date as Jalali YYYY/MM/DD, and the tracking/reference code. Use null for anything not visible." },
              { type: "input_image", image_url: data.image },
            ],
          },
        ],
        text: { format: { type: "json_schema", name: "receipt", strict: true, schema } },
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("ocr", res.status, t);
      if (res.status === 429) throw new Error("rate");
      if (res.status === 402) throw new Error("credits");
      throw new Error("ocr failed");
    }
    const j = await res.json();
    const txt: string =
      j.output_text ??
      j.output?.flatMap((o: { content?: { type: string; text?: string }[] }) => o.content ?? []).find((c: { type: string; text?: string }) => c.type === "output_text")?.text ??
      "";
    if (!txt) throw new Error("empty");
    return JSON.parse(txt) as ReceiptRead;
  });
