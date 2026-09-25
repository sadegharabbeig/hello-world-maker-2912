export type TxType = "income" | "expense";

export const CATEGORIES: Record<TxType, { label: string; icon: string }[]> = {
  expense: [
    { label: "خوراک", icon: "🍽️" },
    { label: "حمل‌ونقل", icon: "🚕" },
    { label: "خرید", icon: "🛍️" },
    { label: "قبض و شارژ", icon: "🧾" },
    { label: "اجاره", icon: "🏠" },
    { label: "سلامت", icon: "💊" },
    { label: "سرگرمی", icon: "🎬" },
    { label: "متفرقه", icon: "📦" },
  ],
  income: [
    { label: "حقوق", icon: "💼" },
    { label: "فروش", icon: "🤝" },
    { label: "هدیه", icon: "🎁" },
    { label: "سرمایه‌گذاری", icon: "📈" },
    { label: "متفرقه", icon: "✨" },
  ],
};

export const CATEGORY_ICONS: Record<string, string> = Object.fromEntries(
  [...CATEGORIES.expense, ...CATEGORIES.income].map((c) => [c.label, c.icon]),
);

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  category: string;
  note: string | null;
  occurred_at: string; // yyyy-mm-dd
  created_at: string;
}

const faNum = new Intl.NumberFormat("fa-IR");

export function formatMoney(amount: number): string {
  return faNum.format(amount);
}

/** Honorary titles based on pledge amount (Toman) */
export const TITLES: { title: string; min: number }[] = [
  { title: "پهلوان", min: 600_000_000 },
  { title: "دنور", min: 60_000_000 },
  { title: "سردار", min: 6_000_000 },
  { title: "عضو", min: 0 },
];

export function memberTitle(pledged: number): string {
  return (TITLES.find((t) => pledged >= t.min) ?? TITLES[TITLES.length - 1]).title;
}

const jalaliMonth = new Intl.DateTimeFormat("fa-IR", { month: "long", year: "numeric" });
const jalaliDay = new Intl.DateTimeFormat("fa-IR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

export function formatMonthLabel(ym: string): string {
  const [y = 0, m = 1] = ym.split("-").map(Number);
  return jalaliMonth.format(new Date(Date.UTC(y, m - 1, 15)));
}

export function formatDayLabel(dateStr: string): string {
  const [y = 0, m = 1, d = 1] = dateStr.split("-").map(Number);
  return jalaliDay.format(new Date(Date.UTC(y, m - 1, d)));
}

/** "2026-09" style key for a yyyy-mm-dd string */
export function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(ym: string, delta: number): string {
  const [y = 0, m = 1] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

/** First day (ISO) of the month `monthsBack` before the current month */
export function monthsAgoStart(monthsBack: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function onlyDigits(s: string): string {
  // Convert Persian/Arabic digits too
  const normalized = s.replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)))
    .replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)));
  return normalized.replace(/\D/g, "");
}
