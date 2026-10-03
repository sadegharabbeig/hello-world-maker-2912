import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usernameToEmail } from "@/lib/auth";
import { needsSetup, setupFirstAdmin } from "@/lib/users.functions";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "ورود | حساب اعضا" },
      { name: "description", content: "ورود با نام کاربری و رمز عبور به حساب اعضا" },
      { property: "og:title", content: "ورود به حساب اعضا" },
      { property: "og:description", content: "ورود با نام کاربری و رمز عبور" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const checkSetup = useServerFn(needsSetup);
  const doSetup = useServerFn(setupFirstAdmin);
  const [setup, setSetup] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) navigate({ to: "/", replace: true }); });
    checkSetup().then((r) => setSetup(r.needsSetup)).catch(() => setSetup(false));
  }, []);

  const login = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
    if (error) throw new Error("نام کاربری یا رمز عبور اشتباه است");
    qc.clear();
    navigate({ to: "/", replace: true });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) { toast.error("نام کاربری و رمز را وارد کنید"); return; }
    setBusy(true);
    try {
      if (setup) {
        if (password !== password2) throw new Error("تکرار رمز یکسان نیست");
        await doSetup({ data: { username, password } });
      }
      await login();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    }
    setBusy(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-3xl border bg-card p-6 shadow-sm">
        <div className="text-center">
          <img src="/icon-192.png" alt="" className="mx-auto h-16 w-16 rounded-2xl" />
          <h1 className="mt-3 text-2xl font-extrabold text-primary">حساب اعضا</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {setup ? "اولین ورود: نام کاربری و رمز مدیر کل را تعیین کنید" : "برای ورود نام کاربری و رمز را وارد کنید"}
          </p>
        </div>
        <div><Label htmlFor="u">نام کاربری</Label><Input id="u" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} /></div>
        <div><Label htmlFor="p">رمز عبور</Label><Input id="p" type="password" dir="ltr" autoComplete={setup ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        {setup && <div><Label htmlFor="p2">تکرار رمز عبور</Label><Input id="p2" type="password" dir="ltr" value={password2} onChange={(e) => setPassword2(e.target.value)} /></div>}
        <Button type="submit" className="w-full" disabled={busy || setup === null}>{setup ? "ساخت حساب مدیر و ورود" : "ورود"}</Button>
      </form>
    </div>
  );
}
