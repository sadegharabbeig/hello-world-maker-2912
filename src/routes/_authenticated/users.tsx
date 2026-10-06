import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABELS, useMyRole } from "@/lib/auth";
import {
  createAppUser, createBranch, deleteAppUser, deleteBranch, listBranches, listUsers, renameBranch, updateAppUser,
} from "@/lib/users.functions";
import { formatMoney } from "@/lib/accounting";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { title: "مدیریت شعبه‌ها | حساب اعضا" },
      { name: "description", content: "تعریف شعبه‌ها، رمز عبور هر شعبه و سطح دسترسی" },
      { property: "og:title", content: "مدیریت شعبه‌ها" },
      { property: "og:description", content: "تعریف شعبه‌ها و رمزهای هر شعبه" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OwnerPage,
});

type BranchRole = "editor" | "viewer";
type U = { user_id: string; username: string; role: "admin" | BranchRole; branch_id: string | null };
type B = { id: string; name: string; members: number };
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "خطا");

function OwnerPage() {
  const { data: me } = useMyRole();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const isOwner = me?.role === "admin";
  const fetchUsers = useServerFn(listUsers);
  const fetchBranches = useServerFn(listBranches);
  const addBranch = useServerFn(createBranch);
  const { data: users } = useQuery({ queryKey: ["app-users"], queryFn: () => fetchUsers() as Promise<U[]>, enabled: isOwner });
  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: () => fetchBranches() as Promise<B[]>, enabled: isOwner });
  const [newBranch, setNewBranch] = useState("");
  const reload = () => { qc.invalidateQueries({ queryKey: ["app-users"] }); qc.invalidateQueries({ queryKey: ["branches"] }); };
  const signOut = async () => {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (me && !isOwner) return <p className="p-8 text-center">فقط مدیر کل به این صفحه دسترسی دارد.</p>;

  return (
    <div className="mx-auto min-h-screen max-w-md bg-background pb-10">
      <header className="flex items-center justify-between rounded-b-3xl bg-primary px-5 pb-6 pt-8 text-primary-foreground">
        <div>
          <h1 className="text-xl font-extrabold">مدیریت شعبه‌ها</h1>
          <p className="mt-1 text-xs opacity-80">{formatMoney(branches?.length ?? 0)} شعبه</p>
        </div>
        <button className="rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-bold" onClick={signOut}>خروج</button>
      </header>
      <div className="space-y-4 p-4">
        <div className="space-y-2 rounded-2xl border bg-card p-4">
          <h2 className="font-bold">شعبه جدید</h2>
          <div className="flex gap-2">
            <Input placeholder="نام شعبه، مثلاً شعبه تهران" value={newBranch} onChange={(e) => setNewBranch(e.target.value)} />
            <Button onClick={async () => {
              try { await addBranch({ data: { name: newBranch } }); setNewBranch(""); toast.success("شعبه ساخته شد"); reload(); }
              catch (e) { toast.error(errMsg(e)); }
            }}>ساخت</Button>
          </div>
        </div>

        {branches?.map((b) => (
          <BranchCard key={b.id} b={b} users={users?.filter((u) => u.branch_id === b.id) ?? []} reload={reload} />
        ))}

        <OwnersCard owners={users?.filter((u) => u.role === "admin") ?? []} myName={me?.username} reload={reload} />
      </div>
    </div>
  );
}

function BranchCard({ b, users, reload }: { b: B; users: U[]; reload: () => void }) {
  const create = useServerFn(createAppUser);
  const rename = useServerFn(renameBranch);
  const remove = useServerFn(deleteBranch);
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<BranchRole>("viewer");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    setBusy(true);
    try { await create({ data: { username, password, role, branchId: b.id } }); toast.success("رمز ساخته شد"); setUsername(""); setPassword(""); reload(); }
    catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <button className="flex w-full items-center justify-between text-right" onClick={() => setOpen(!open)}>
        <div>
          <div className="font-extrabold text-primary">{b.name}</div>
          <div className="text-xs text-muted-foreground">{formatMoney(b.members)} عضو · {formatMoney(users.length)} کاربر</div>
        </div>
        <span className="text-sm text-muted-foreground">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="mt-4 space-y-3 border-t pt-3">
          <ul className="space-y-2">
            {users.map((u) => <UserRow key={u.user_id} u={u} reload={reload} />)}
            {users.length === 0 && <p className="text-sm text-muted-foreground">هنوز کاربری برای این شعبه تعریف نشده.</p>}
          </ul>
          <div className="space-y-2 rounded-xl bg-secondary/50 p-3">
            <h3 className="text-sm font-bold">کاربر جدید برای {b.name}</h3>
            <div><Label htmlFor={`u-${b.id}`}>نام کاربری</Label><Input id={`u-${b.id}`} value={username} onChange={(e) => setUsername(e.target.value)} /></div>
            <div><Label htmlFor={`p-${b.id}`}>رمز عبور (حداقل ۶ حرف)</Label><Input id={`p-${b.id}`} dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <div className="flex items-center gap-2">
              <Label>دسترسی:</Label>
              <select className="h-10 rounded-md border bg-background px-2 text-sm" value={role} onChange={(e) => setRole(e.target.value as BranchRole)}>
                <option value="editor">{ROLE_LABELS.editor}</option>
                <option value="viewer">{ROLE_LABELS.viewer}</option>
              </select>
            </div>
            <Button className="w-full" disabled={busy} onClick={add}>ساخت کاربر</Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={async () => {
              const n = prompt("نام جدید شعبه", b.name);
              if (!n) return;
              try { await rename({ data: { id: b.id, name: n } }); toast.success("نام تغییر کرد"); reload(); } catch (e) { toast.error(errMsg(e)); }
            }}>تغییر نام</Button>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={async () => {
              if (!confirm(`شعبه «${b.name}» و همه کاربرانش حذف شود؟`)) return;
              try { await remove({ data: { id: b.id } }); toast.success("شعبه حذف شد"); reload(); } catch (e) { toast.error(errMsg(e)); }
            }}>حذف شعبه</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function UserRow({ u, reload, self }: { u: U; reload: () => void; self?: boolean }) {
  const update = useServerFn(updateAppUser);
  const remove = useServerFn(deleteAppUser);
  const [pw, setPw] = useState("");
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast.success(ok); reload(); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <li className="space-y-2 rounded-xl border bg-background p-3">
      <div className="flex items-center justify-between">
        <span className="font-bold">{u.username}{self && " (شما)"}</span>
        {u.role === "admin" ? <span className="text-xs text-muted-foreground">مدیر کل</span> : (
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={u.role}
            onChange={(e) => run(() => update({ data: { userId: u.user_id, role: e.target.value as BranchRole } }), "دسترسی تغییر کرد")}>
            <option value="editor">{ROLE_LABELS.editor}</option>
            <option value="viewer">{ROLE_LABELS.viewer}</option>
          </select>
        )}
      </div>
      <div className="flex gap-2">
        <Input placeholder="رمز جدید" dir="ltr" value={pw} onChange={(e) => setPw(e.target.value)} />
        <Button variant="outline" onClick={() => run(() => update({ data: { userId: u.user_id, password: pw } }).then(() => setPw("")), "رمز تغییر کرد")}>تغییر رمز</Button>
      </div>
      {!self && (
        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => confirm(`کاربر «${u.username}» حذف شود؟`) && run(() => remove({ data: { userId: u.user_id } }), "کاربر حذف شد")}>حذف کاربر</Button>
      )}
    </li>
  );
}

function OwnersCard({ owners, myName, reload }: { owners: U[]; myName?: string; reload: () => void }) {
  const create = useServerFn(createAppUser);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <h2 className="font-bold">مدیران کل</h2>
      <p className="text-xs text-muted-foreground">مدیر کل فقط شعبه‌ها و رمزها را مدیریت می‌کند. برای دیدن اطلاعات یک شعبه، با رمز همان شعبه وارد شوید.</p>
      <ul className="space-y-2">{owners.map((u) => <UserRow key={u.user_id} u={u} reload={reload} self={u.username === myName} />)}</ul>
      <div className="space-y-2">
        <Input placeholder="نام کاربری مدیر کل جدید" value={username} onChange={(e) => setUsername(e.target.value)} />
        <Input placeholder="رمز" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button variant="outline" className="w-full" onClick={async () => {
          try { await create({ data: { username, password, role: "admin", branchId: null } }); setUsername(""); setPassword(""); toast.success("مدیر کل اضافه شد"); reload(); }
          catch (e) { toast.error(errMsg(e)); }
        }}>افزودن مدیر کل</Button>
      </div>
    </div>
  );
}
