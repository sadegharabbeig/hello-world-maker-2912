import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABELS, useMyRole, type Role } from "@/lib/auth";
import { createAppUser, deleteAppUser, listUsers, updateAppUser } from "@/lib/users.functions";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { title: "مدیریت کاربران | حساب اعضا" },
      { name: "description", content: "تعریف کاربران، رمز عبور و سطح دسترسی" },
      { property: "og:title", content: "مدیریت کاربران" },
      { property: "og:description", content: "تعریف کاربران و سطح دسترسی" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UsersPage,
});

const ROLES: Role[] = ["admin", "editor", "viewer"];
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "خطا");

function RoleSelect({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  return (
    <select className="h-10 rounded-md border bg-background px-2 text-sm" value={value} onChange={(e) => onChange(e.target.value as Role)}>
      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
    </select>
  );
}

function UsersPage() {
  const { data: me } = useMyRole();
  const qc = useQueryClient();
  const fetchUsers = useServerFn(listUsers);
  const create = useServerFn(createAppUser);
  const update = useServerFn(updateAppUser);
  const remove = useServerFn(deleteAppUser);
  const isAdmin = me?.role === "admin";
  const { data: users } = useQuery({ queryKey: ["app-users"], queryFn: () => fetchUsers(), enabled: isAdmin });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("viewer");
  const [busy, setBusy] = useState(false);
  const reload = () => qc.invalidateQueries({ queryKey: ["app-users"] });

  if (me && !isAdmin) return <p className="p-8 text-center">فقط مدیر به این صفحه دسترسی دارد.</p>;

  const add = async () => {
    setBusy(true);
    try { await create({ data: { username, password, role } }); toast.success("کاربر ساخته شد"); setUsername(""); setPassword(""); reload(); }
    catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };

  return (
    <div className="mx-auto min-h-screen max-w-md bg-background pb-10">
      <header className="flex items-center justify-between rounded-b-3xl bg-primary px-5 pb-6 pt-8 text-primary-foreground">
        <h1 className="text-xl font-extrabold">مدیریت کاربران</h1>
        <Link to="/" className="rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-bold">بازگشت</Link>
      </header>
      <div className="space-y-4 p-4">
        <div className="space-y-2 rounded-2xl border bg-card p-4">
          <h2 className="font-bold">کاربر جدید</h2>
          <div><Label htmlFor="nu">نام کاربری</Label><Input id="nu" value={username} onChange={(e) => setUsername(e.target.value)} /></div>
          <div><Label htmlFor="np">رمز عبور (حداقل ۶ حرف)</Label><Input id="np" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <div className="flex items-center gap-2"><Label>دسترسی:</Label><RoleSelect value={role} onChange={setRole} /></div>
          <p className="text-xs text-muted-foreground">مدیر: همه کارها + تعریف کاربر · ویرایشگر: ثبت و تغییر · فقط بازدید: فقط دیدن</p>
          <Button className="w-full" disabled={busy} onClick={add}>ساخت کاربر</Button>
        </div>
        <ul className="space-y-2">
          {users?.map((u) => <UserRow key={u.user_id} u={u as any} self={u.username === me?.username} update={update} remove={remove} reload={reload} />)}
        </ul>
      </div>
    </div>
  );
}

function UserRow({ u, self, update, remove, reload }: { u: { user_id: string; username: string; role: Role }; self: boolean; update: any; remove: any; reload: () => void }) {
  const [pw, setPw] = useState("");
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast.success(ok); reload(); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <li className="space-y-2 rounded-2xl border bg-card p-3">
      <div className="flex items-center justify-between">
        <b>{u.username}{self ? " (شما)" : ""}</b>
        <RoleSelect value={u.role} onChange={(r) => run(() => update({ data: { userId: u.user_id, role: r } }), "دسترسی تغییر کرد")} />
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
