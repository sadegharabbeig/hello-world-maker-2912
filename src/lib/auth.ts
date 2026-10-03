import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "editor" | "viewer";
export const ROLE_LABELS: Record<Role, string> = { admin: "مدیر", editor: "ویرایشگر", viewer: "فقط بازدید" };

export function normalizeUsername(u: string) {
  return u.trim().toLowerCase();
}
// Usernames may be Persian; encode as hex so the login email is always valid.
export function usernameToEmail(u: string) {
  const bytes = new TextEncoder().encode(normalizeUsername(u));
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `u${hex}@hesab-aza.app`;
}

export function useMyRole() {
  return useQuery({
    queryKey: ["my-role"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("user_roles").select("role, username").eq("user_id", u.user.id).maybeSingle();
      return data as { role: Role; username: string } | null;
    },
    staleTime: 60_000,
  });
}
