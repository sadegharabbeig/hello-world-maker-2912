import { supabase } from "@/integrations/supabase/client";
import { memberTitle } from "@/lib/accounting";
import { formatJalaliNumeric } from "@/lib/jalali";

const PATH = "backup.xlsx";
const BUCKET = "backups";

async function buildWorkbook(): Promise<Blob> {
  const XLSX = await import("xlsx");
  const [m, p] = await Promise.all([
    supabase.from("members").select("*").order("code"),
    supabase.from("member_payments").select("*").order("paid_at"),
  ]);
  if (m.error) throw m.error;
  if (p.error) throw p.error;
  const members = m.data;
  const payments = p.data;
  const byId = new Map(members.map((x) => [x.id, x]));
  const memberRows = members.map((x) => {
    const paid = payments.filter((y) => y.member_id === x.id).reduce((a, y) => a + y.amount, 0);
    return {
      "کد": x.code, "نام": x.name, "تلفن": x.phone ?? "", "لژیون": x.legion_number ?? "",
      "عنوان": memberTitle(x.pledged), "تعهد": x.pledged, "واریزی": paid, "مانده": x.pledged - paid,
    };
  });
  const payRows = payments.map((y) => {
    const mm = byId.get(y.member_id);
    return {
      "تاریخ": formatJalaliNumeric(y.paid_at), "کد عضو": mm?.code ?? "", "نام": mm?.name ?? "",
      "لژیون": mm?.legion_number ?? "", "مبلغ": y.amount, "کد پیگیری": y.tracking_code ?? "",
      "فیش": y.receipt_url ? "دارد" : "ندارد", "توضیح": y.note ?? "",
    };
  });
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(memberRows), "اعضا");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(payRows), "واریزی‌ها");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** Rebuild the single backup file (overwrites previous). Debounced. */
export function scheduleBackup() {
  clearTimeout(timer);
  timer = setTimeout(() => void saveBackup().catch(() => {}), 1500);
}

export async function saveBackup() {
  const blob = await buildWorkbook();
  const { error } = await supabase.storage.from(BUCKET).upload(PATH, blob, { upsert: true, contentType: blob.type });
  if (error) throw error;
}

/** Download the latest backup to the device (always same file name). */
export async function downloadBackup() {
  const blob = await buildWorkbook();
  void supabase.storage.from(BUCKET).upload(PATH, blob, { upsert: true, contentType: blob.type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "backup-hesab-aza.xlsx";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
