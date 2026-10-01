import { isoToJalali, jalaliMonthLength, jalaliToIso, JALALI_MONTHS } from "@/lib/jalali";
import { todayISO } from "@/lib/accounting";

const fa = new Intl.NumberFormat("fa-IR", { useGrouping: false });
const cls = "h-10 rounded-md border border-input bg-background px-1 text-sm";

/** Shamsi date picker; value/onChange use ISO (gregorian) yyyy-mm-dd, "" = empty */
export function JalaliDateInput({
  value,
  onChange,
  allowEmpty = false,
  id,
}: {
  value: string;
  onChange: (iso: string) => void;
  allowEmpty?: boolean;
  id?: string;
}) {
  const [ty] = isoToJalali(todayISO());
  const [jy, jm, jd] = value ? isoToJalali(value) : [0, 0, 0];
  const years = Array.from({ length: 12 }, (_, i) => ty + 1 - i);
  const set = (y: number, m: number, d: number) => {
    if (!y || !m || !d) {
      if (allowEmpty && !y && !m && !d) onChange("");
      else onChange(jalaliToIso(y || ty, m || 1, Math.min(d || 1, jalaliMonthLength(y || ty, m || 1))));
      return;
    }
    onChange(jalaliToIso(y, m, Math.min(d, jalaliMonthLength(y, m))));
  };
  const days = jy && jm ? jalaliMonthLength(jy, jm) : 31;
  return (
    <div id={id} className="flex gap-1" dir="rtl">
      <select aria-label="روز" className={cls} value={jd} onChange={(e) => set(jy, jm, +e.target.value)}>
        {allowEmpty && <option value={0}>روز</option>}
        {Array.from({ length: days }, (_, i) => (
          <option key={i} value={i + 1}>{fa.format(i + 1)}</option>
        ))}
      </select>
      <select aria-label="ماه" className={`${cls} flex-1`} value={jm} onChange={(e) => set(jy, +e.target.value, jd)}>
        {allowEmpty && <option value={0}>ماه</option>}
        {JALALI_MONTHS.map((n, i) => (
          <option key={n} value={i + 1}>{n}</option>
        ))}
      </select>
      <select aria-label="سال" className={cls} value={jy} onChange={(e) => set(+e.target.value, jm, jd)}>
        {allowEmpty && <option value={0}>سال</option>}
        {years.map((y) => (
          <option key={y} value={y}>{fa.format(y)}</option>
        ))}
      </select>
    </div>
  );
}
