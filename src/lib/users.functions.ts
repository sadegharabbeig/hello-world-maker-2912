import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeUsername, usernameToEmail } from "./auth";

const roleSchema = z.enum(["admin", "editor", "viewer"]);
const userSchema = z.string().trim().min(2, "نام کاربری کوتاه است").max(40);
const passSchema = z.string().min(6, "رمز حداقل ۶ حرف").max(72);

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("فقط مدیر اجازه این کار را دارد");
}

export const needsSetup = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { count } = await db.from("user_roles").select("id", { count: "exact", head: true });
  return { needsSetup: (count ?? 0) === 0 };
});

export const setupFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ username: userSchema, password: passSchema }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { count } = await db.from("user_roles").select("id", { count: "exact", head: true });
    if ((count ?? 0) > 0) throw new Error("مدیر قبلاً تعریف شده است");
    const { data: u, error } = await db.auth.admin.createUser({
      email: usernameToEmail(data.username), password: data.password, email_confirm: true,
    });
    if (error || !u.user) throw new Error(error?.message ?? "ساخت حساب انجام نشد");
    await db.from("user_roles").insert({ user_id: u.user.id, role: "admin", username: normalizeUsername(data.username) });
    return { ok: true };
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase.from("user_roles").select("user_id, username, role, created_at").order("created_at");
    if (error) throw new Error(error.message);
    return data;
  });

export const createAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ username: userSchema, password: passSchema, role: roleSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { data: u, error } = await db.auth.admin.createUser({
      email: usernameToEmail(data.username), password: data.password, email_confirm: true,
    });
    if (error || !u.user) throw new Error(error?.message?.includes("already") ? "این نام کاربری قبلاً ثبت شده" : "ساخت کاربر انجام نشد");
    const { error: e2 } = await db.from("user_roles").insert({ user_id: u.user.id, role: data.role, username: normalizeUsername(data.username) });
    if (e2) { await db.auth.admin.deleteUser(u.user.id); throw new Error("این نام کاربری قبلاً ثبت شده"); }
    return { ok: true };
  });

export const updateAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), role: roleSchema.optional(), password: passSchema.optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    if (data.role) {
      if (data.userId === context.userId && data.role !== "admin") throw new Error("نمی‌توانید نقش مدیریت خودتان را بردارید");
      await db.from("user_roles").update({ role: data.role }).eq("user_id", data.userId);
    }
    if (data.password) {
      const { error } = await db.auth.admin.updateUserById(data.userId, { password: data.password });
      if (error) throw new Error("تغییر رمز انجام نشد");
    }
    return { ok: true };
  });

export const deleteAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("نمی‌توانید خودتان را حذف کنید");
    const db = await admin();
    await db.from("user_roles").delete().eq("user_id", data.userId);
    await db.auth.admin.deleteUser(data.userId);
    return { ok: true };
  });
