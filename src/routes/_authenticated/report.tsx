import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatMoney, memberTitle } from "@/lib/accounting";
import { formatJalali, formatJalaliNumeric } from "@/lib/jalali";
import { JalaliDateInput } from "@/components/JalaliDateInput";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/report")({
  head: () => ({
    meta: [
      { title: "گزارش واریزی‌ها | حساب اعضا" },
      { name: "description", content: "گزارش واریزی‌های اعضا با فیلتر تاریخ، لژیون و پیش از موعد" },
      { property: "og:title", content: "گزارش واریزی‌ها" },
      { property: "og:description", content: "گزارش واریزی‌های اعضا با فیلتر تاریخ، لژیون و پیش از موعد" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Report,
});

type Row = {
  id: string;
  amount: number;
  note: string | null;
  paid_at: string;
  tracking_code: string | null;
  receipt_url: string | null;
  member: { name: string; code: number; legion_number: string | null; pledged: number } | null;
};

async function downloadRowsExcel(rows: Row[]) {
  const XLSX = await import("xlsx");
  const data = rows.map((r) => ({
    "تاریخ": formatJalaliNumeric(r.paid_at),
    "کد عضو": r.member?.code ?? "",
    "نام": r.member?.name ?? "",
    "لژیون": r.member?.legion_number ?? "",
    "مبلغ": r.amount,
    "کد پیگیری": r.tracking_code ?? "",
    "فیش": r.receipt_url ? "دارد" : "ندارد",
    "توضیح": r.note ?? "",
  }));
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "گزارش");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "gozaresh-variziha.xlsx";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const EARLY = "پیش از موعد";

const TITLE_OPTIONS = ["سردار", "دنور", "پهلوان"] as const;

function Report() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [legion, setLegion] = useState("");
  const [earlyOnly, setEarlyOnly] = useState(false);
  const [title, setTitle] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_payments")
        .select("id, amount, note, paid_at, tracking_code, receipt_url, member:members(name, code, legion_number, pledged)")
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Row[];
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.filter((r) => {
      if (from && r.paid_at < from) return false;
      if (to && r.paid_at > to) return false;
      if (legion.trim() && (r.member?.legion_number ?? "") !== legion.trim()) return false;
      if (earlyOnly && !(r.note ?? "").includes(EARLY)) return false;
      if (title && memberTitle(r.member?.pledged ?? 0) !== title) return false;
      return true;
    });
  }, [data, from, to, legion, earlyOnly, title]);

  const total = filtered.reduce((a, r) => a + r.amount, 0);

  return (
    <div className="mx-auto min-h-screen max-w-md bg-background pb-10">
      <header className="rounded-b-3xl bg-primary px-5 pb-6 pt-8 text-primary-foreground">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold">گزارش واریزی‌ها</h1>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={filtered.length === 0}
              onClick={() =>
                downloadRowsExcel(filtered)
                  .then(() => toast.success("فایل اکسل دانلود شد"))
                  .catch(() => toast.error("خطا در ساخت فایل اکسل"))
              }
              className="rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-bold disabled:opacity-50"
            >
              بکاپ اکسل
            </button>
            <Link to="/" className="rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-bold">
              بازگشت
            </Link>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-primary-foreground/10 p-2">
            <div className="text-xs opacity-80">تعداد واریزی</div>
            <div className="mt-1 text-sm font-bold">{formatMoney(filtered.length)}</div>
          </div>
          <div className="rounded-xl bg-primary-foreground/10 p-2">
            <div className="text-xs opacity-80">جمع مبلغ</div>
            <div className="mt-1 text-sm font-bold">{formatMoney(total)}</div>
          </div>
        </div>
      </header>

      <div className="space-y-3 px-4 pt-4">
        <div className="grid grid-cols-1 gap-2">
          <div>
            <Label htmlFor="from">از تاریخ</Label>
            <JalaliDateInput id="from" allowEmpty value={from} onChange={setFrom} />
          </div>
          <div>
            <Label htmlFor="to">تا تاریخ</Label>
            <JalaliDateInput id="to" allowEmpty value={to} onChange={setTo} />
          </div>
        </div>
        <div>
          <Label htmlFor="leg">شماره لژیون</Label>
          <Input id="leg" dir="ltr" value={legion} onChange={(e) => setLegion(e.target.value)} placeholder="مثلاً ۱۲۳۴" />
        </div>
        <Button
          variant={earlyOnly ? "default" : "outline"}
          className="w-full"
          onClick={() => setEarlyOnly((v) => !v)}
        >
          {earlyOnly ? "✓ فقط واریزی‌های پیش از موعد" : "فقط واریزی‌های پیش از موعد"}
        </Button>
        {(from || to || legion || earlyOnly) && (
          <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => { setFrom(""); setTo(""); setLegion(""); setEarlyOnly(false); }}>
            پاک کردن فیلترها
          </Button>
        )}

        {isLoading && <p className="mt-6 text-center text-muted-foreground">در حال بارگذاری…</p>}
        {!isLoading && filtered.length === 0 && (
          <p className="mt-10 text-center text-muted-foreground">واریزی با این فیلترها پیدا نشد.</p>
        )}
        <ul className="space-y-2">
          {filtered.map((r) => (
            <li key={r.id} className="rounded-xl border bg-card px-3 py-2 text-sm shadow-sm">
              <div className="flex items-center justify-between">
                <b>{formatMoney(r.amount)} تومان</b>
                <span className="text-xs text-muted-foreground">{formatJalali(r.paid_at)}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>{r.member?.name} (کد {formatMoney(r.member?.code ?? 0)})</span>
                {r.member?.legion_number && <span>لژیون: {r.member.legion_number}</span>}
                {r.note && <span className="text-primary">{r.note}</span>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
