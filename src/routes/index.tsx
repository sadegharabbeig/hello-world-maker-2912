import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatMoney, memberTitle, todayISO } from "@/lib/accounting";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "حساب اعضا | ثبت تعهد و واریزی" },
      { name: "description", content: "ثبت اعضا با کد، مبلغ تعهد، واریزی‌ها و مانده هر عضو" },
      { property: "og:title", content: "حساب اعضا" },
      { property: "og:description", content: "ثبت اعضا با کد، تعهد، واریزی و مانده" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type Member = { id: string; code: number; name: string; phone: string | null; pledged: number; legion_number: string | null };
type Payment = { id: string; member_id: string; amount: number; note: string | null; paid_at: string };

const toNum = (s: string) =>
  Number(s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[^\d]/g, "")) || 0;

function useData() {
  return useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const [m, p] = await Promise.all([
        supabase.from("members").select("*").order("code"),
        supabase.from("member_payments").select("*").order("paid_at", { ascending: false }),
      ]);
      if (m.error) throw m.error;
      if (p.error) throw p.error;
      return { members: m.data as Member[], payments: p.data as Payment[] };
    },
  });
}

function MoneyInput({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <Input
      id={id}
      inputMode="numeric"
      dir="ltr"
      className="text-left"
      value={value ? formatMoney(toNum(value)) : ""}
      onChange={(e) => onChange(String(toNum(e.target.value)))}
      placeholder="۰"
    />
  );
}

function Index() {
  const { data, isLoading } = useData();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.members.map((m) => {
      const paid = data.payments.filter((p) => p.member_id === m.id).reduce((a, p) => a + p.amount, 0);
      return { ...m, paid, remaining: m.pledged - paid };
    });
  }, [data]);

  const filtered = rows.filter(
    (r) => !search || r.name.includes(search) || String(r.code) === String(toNum(search)),
  );
  const totals = rows.reduce(
    (a, r) => ({ pledged: a.pledged + r.pledged, paid: a.paid + r.paid, remaining: a.remaining + Math.max(r.remaining, 0) }),
    { pledged: 0, paid: 0, remaining: 0 },
  );
  const current = rows.find((r) => r.id === selected);
  const refresh = () => qc.invalidateQueries({ queryKey: ["members"] });

  return (
    <div className="mx-auto min-h-screen max-w-md bg-background pb-28">
      <header className="rounded-b-3xl bg-primary px-5 pb-6 pt-8 text-primary-foreground">
        <h1 className="text-2xl font-extrabold">حساب اعضا</h1>
        <p className="mt-1 text-sm opacity-80">{formatMoney(rows.length)} عضو ثبت‌شده</p>
        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          {[
            ["کل تعهد", totals.pledged],
            ["واریزی", totals.paid],
            ["مانده", totals.remaining],
          ].map(([l, v]) => (
            <div key={l as string} className="rounded-xl bg-primary-foreground/10 p-2">
              <div className="text-xs opacity-80">{l}</div>
              <div className="mt-1 text-sm font-bold">{formatMoney(v as number)}</div>
            </div>
          ))}
        </div>
      </header>

      <div className="px-4 pt-4">
        <Input placeholder="جستجو با نام یا کد…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {isLoading && <p className="mt-6 text-center text-muted-foreground">در حال بارگذاری…</p>}
        {!isLoading && filtered.length === 0 && (
          <p className="mt-10 text-center text-muted-foreground">هنوز عضوی ثبت نشده. با دکمه پایین اضافه کنید.</p>
        )}
        <ul className="mt-4 space-y-3">
          {filtered.map((r) => (
            <li key={r.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setSelected(r.id)}
                onKeyDown={(e) => e.key === "Enter" && setSelected(r.id)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border bg-card p-3 text-right shadow-sm active:scale-[0.99]"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-lg font-extrabold text-primary">
                  {formatMoney(r.code)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-bold">{r.name}</span>
                    <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-secondary-foreground">{memberTitle(r.pledged)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {r.legion_number && <span>لژیون: {r.legion_number}</span>}
                    <span>تعهد: {formatMoney(r.pledged)}</span>
                    <span className="text-success">واریز: {formatMoney(r.paid)}</span>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span
                    className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground"
                    onClick={(e) => { e.stopPropagation(); setSelected(r.id); }}
                  >
                    + واریز
                  </span>
                  <div className="text-xs text-muted-foreground">مانده: <b className={r.remaining > 0 ? "text-warning" : "text-success"}>{formatMoney(r.remaining)}</b></div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md p-4">
        <Button className="h-14 w-full rounded-2xl text-base font-bold shadow-lg" onClick={() => setAddOpen(true)}>
          + افزودن عضو جدید
        </Button>
      </div>

      <AddMemberDialog open={addOpen} onOpenChange={setAddOpen} onDone={refresh} />
      {current && (
        <MemberDialog
          member={current}
          payments={data?.payments.filter((p) => p.member_id === current.id) ?? []}
          onClose={() => setSelected(null)}
          onDone={refresh}
        />
      )}
    </div>
  );
}

function AddMemberDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [legion, setLegion] = useState("");
  const [pledged, setPledged] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!name.trim()) { toast.error("نام عضو را وارد کنید"); return; }
    setBusy(true);
    const { data, error } = await supabase
      .from("members")
      .insert({ name: name.trim(), phone: phone.trim() || null, legion_number: legion.trim() || null, pledged: toNum(pledged) })
      .select("code")
      .single();
    setBusy(false);
    if (error) { toast.error("ثبت نشد، دوباره تلاش کنید"); return; }
    toast.success(`عضو با کد ${formatMoney(data.code)} ثبت شد`);
    setName(""); setPhone(""); setLegion(""); setPledged("");
    onOpenChange(false);
    onDone();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle>عضو جدید</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">کد عضو به‌صورت خودکار داده می‌شود.</p>
        <div className="space-y-3">
          <div><Label htmlFor="n">نام و نام خانوادگی</Label><Input id="n" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label htmlFor="ph">شماره تماس (اختیاری)</Label><Input id="ph" dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div><Label htmlFor="lg">شماره لژیون</Label><Input id="lg" dir="ltr" value={legion} onChange={(e) => setLegion(e.target.value)} placeholder="مثلاً ۱۲۳۴" /></div>
          <div>
            <Label htmlFor="pl">مبلغ تعهد (تومان)</Label>
            <MoneyInput id="pl" value={pledged} onChange={setPledged} />
            {toNum(pledged) > 0 && <p className="mt-1 text-xs text-muted-foreground">عنوان: <b className="text-primary">{memberTitle(toNum(pledged))}</b></p>}
          </div>
          <Button className="w-full" disabled={busy} onClick={save}>ثبت عضو</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MemberDialog({
  member, payments, onClose, onDone,
}: {
  member: Member & { paid: number; remaining: number };
  payments: Payment[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [pledged, setPledged] = useState(String(member.pledged));
  const [legion, setLegion] = useState(member.legion_number ?? "");
  const [busy, setBusy] = useState(false);
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [busyDate, setBusyDate] = useState(false);

  const addPayment = async () => {
    const a = toNum(amount);
    if (!a) { toast.error("مبلغ واریزی را وارد کنید"); return; }
    setBusy(true);
    const { error } = await supabase.from("member_payments").insert({ member_id: member.id, amount: a, note: note.trim() || null, paid_at: todayISO() });
    setBusy(false);
    if (error) { toast.error("ثبت نشد"); return; }
    toast.success("واریزی ثبت شد");
    setAmount(""); setNote("");
    onDone();
  };
  const savePledge = async () => {
    const { error } = await supabase.from("members").update({ pledged: toNum(pledged) }).eq("id", member.id);
    if (error) { toast.error("ذخیره نشد"); return; }
    toast.success("مبلغ تعهد به‌روز شد");
    onDone();
  };
  const saveLegion = async () => {
    const { error } = await supabase.from("members").update({ legion_number: legion.trim() || null }).eq("id", member.id);
    if (error) { toast.error("ذخیره نشد"); return; }
    toast.success("شماره لژیون به‌روز شد");
    onDone();
  };
  const delPayment = async (id: string) => {
    if (!confirm("این واریزی حذف شود؟")) return;
    await supabase.from("member_payments").delete().eq("id", id);
    onDone();
  };
  const startEditDate = (p: Payment) => {
    setEditingDateId(p.id);
    setEditDate(p.paid_at);
  };
  const saveDate = async () => {
    if (!editingDateId || !editDate) return;
    setBusyDate(true);
    const { error } = await supabase.from("member_payments").update({ paid_at: editDate }).eq("id", editingDateId);
    setBusyDate(false);
    if (error) { toast.error("ذخیره نشد"); return; }
    toast.success("تاریخ واریزی به‌روز شد");
    setEditingDateId(null);
    onDone();
  };
  const delMember = async () => {
    if (!confirm(`عضو «${member.name}» و همه واریزی‌هایش حذف شود؟`)) return;
    await supabase.from("members").delete().eq("id", member.id);
    onClose(); onDone();
  };
  const dateFmt = new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{member.name} — کد {formatMoney(member.code)}</DialogTitle>
        </DialogHeader>
        <p className="-mt-1 text-center text-xs text-muted-foreground">عنوان: <b className="text-primary">{memberTitle(member.pledged)}</b>{member.legion_number ? <> · لژیون: <b className="text-primary">{member.legion_number}</b></> : null}</p>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-xl bg-secondary p-2"><div className="text-xs text-muted-foreground">تعهد</div><b>{formatMoney(member.pledged)}</b></div>
          <div className="rounded-xl bg-secondary p-2"><div className="text-xs text-muted-foreground">واریزی</div><b className="text-success">{formatMoney(member.paid)}</b></div>
          <div className="rounded-xl bg-secondary p-2"><div className="text-xs text-muted-foreground">مانده</div><b className="text-warning">{formatMoney(member.remaining)}</b></div>
        </div>

        <div className="space-y-2 rounded-xl border p-3">
          <Label htmlFor="pa">ثبت واریزی جدید (تومان)</Label>
          <MoneyInput id="pa" value={amount} onChange={setAmount} />
          <Input placeholder="توضیح (اختیاری)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button className="w-full" disabled={busy} onClick={addPayment}>ثبت واریزی</Button>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor="elg">شماره لژیون</Label>
            <Input id="elg" dir="ltr" value={legion} onChange={(e) => setLegion(e.target.value)} placeholder="مثلاً ۱۲۳۴" />
          </div>
          <Button variant="outline" onClick={saveLegion}>ذخیره</Button>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor="ep">ویرایش مبلغ تعهد</Label>
            <MoneyInput id="ep" value={pledged} onChange={setPledged} />
            <p className="mt-1 text-xs text-muted-foreground">عنوان با این تعهد: <b className="text-primary">{memberTitle(toNum(pledged))}</b></p>
          </div>
          <Button variant="outline" onClick={savePledge}>ذخیره</Button>
        </div>

        <div>
          <h3 className="mb-2 font-bold">سابقه واریزی‌ها</h3>
          {payments.length === 0 && <p className="text-sm text-muted-foreground">هنوز واریزی ثبت نشده.</p>}
          <ul className="space-y-2">
            {payments.map((p) => (
              <li key={p.id} className="rounded-lg bg-secondary px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <b>{formatMoney(p.amount)}</b> تومان
                    <div className="text-xs text-muted-foreground">{dateFmt.format(new Date(p.paid_at))}{p.note ? ` · ${p.note}` : ""}</div>
                  </div>
                  <div className="flex gap-3">
                    <button className="text-xs text-primary" onClick={() => startEditDate(p)}>ویرایش تاریخ</button>
                    <button className="text-xs text-destructive" onClick={() => delPayment(p.id)}>حذف</button>
                  </div>
                </div>
                {editingDateId === p.id && (
                  <div className="mt-2 flex items-center gap-2 border-t pt-2">
                    <Input
                      type="date"
                      dir="ltr"
                      className="flex-1 text-left"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                    />
                    <Button size="sm" disabled={busyDate || !editDate} onClick={saveDate}>ذخیره</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingDateId(null)}>انصراف</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
        <Button variant="ghost" className="text-destructive" onClick={delMember}>حذف عضو</Button>
      </DialogContent>
    </Dialog>
  );
}
