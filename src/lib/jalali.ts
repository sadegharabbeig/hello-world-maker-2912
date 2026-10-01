// Jalali (Shamsi) <-> Gregorian conversion
const div = (a: number, b: number) => Math.floor(a / b);

export function toJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days = 355666 + 365 * gy + div(gy2 + 3, 4) - div(gy2 + 99, 100) + div(gy2 + 399, 400) + gd + (g_d_m[gm - 1] ?? 0);
  let jy = -1595 + 33 * div(days, 12053);
  days %= 12053;
  jy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    jy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + div(days, 31) : 7 + div(days - 186, 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return [jy, jm, jd];
}

export function toGregorian(jy: number, jm: number, jd: number): [number, number, number] {
  jy += 1595;
  let days = -355668 + 365 * jy + div(jy, 33) * 8 + div((jy % 33) + 3, 4) + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  let gy = 400 * div(days, 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * div(--days, 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    gy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const leap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
  const sal = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  for (gm = 0; gm < 13 && gd > (sal[gm] ?? 0); gm++) gd -= sal[gm] ?? 0;
  return [gy, gm, gd];
}

export const JALALI_MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];

const pad = (n: number) => String(n).padStart(2, "0");
const fa = new Intl.NumberFormat("fa-IR", { useGrouping: false });

export function isoToJalali(iso: string): [number, number, number] {
  const [y = 0, m = 1, d = 1] = iso.split("-").map(Number);
  return toJalali(y, m, d);
}

export function jalaliToIso(jy: number, jm: number, jd: number): string {
  const [y, m, d] = toGregorian(jy, jm, jd);
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** e.g. "۱۰ مهر ۱۴۰۵" */
export function formatJalali(iso: string): string {
  if (!iso) return "";
  const [jy, jm, jd] = isoToJalali(iso.slice(0, 10));
  return `${fa.format(jd)} ${JALALI_MONTHS[jm - 1]} ${fa.format(jy)}`;
}

/** e.g. "1405/07/10" (for Excel) */
export function formatJalaliNumeric(iso: string): string {
  if (!iso) return "";
  const [jy, jm, jd] = isoToJalali(iso.slice(0, 10));
  return `${jy}/${pad(jm)}/${pad(jd)}`;
}

export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  // Esfand: leap if converting day 30 round-trips
  const iso = jalaliToIso(jy, 12, 30);
  const [, m2] = isoToJalali(iso);
  return m2 === 12 ? 30 : 29;
}
