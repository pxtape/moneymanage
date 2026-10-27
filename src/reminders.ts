import type { AppearancePrefs } from "./appearance";
import { decimalSatang, type LedgerSnapshot } from "./ledger";
export interface Reminder {
  id: string;
  title: string;
  detail: string;
  action: "entry" | "budget" | "compare";
}
export function remindersFor(
  prefs: AppearancePrefs,
  snapshot: LedgerSnapshot,
  today: string,
  time: string,
  context: { today: string; has_expense: boolean } | null,
): Reminder[] {
  const reminders: Reminder[] = [];
  if (
    prefs.dailyReminder &&
    time >= prefs.reminderTime &&
    context?.today === today &&
    !context.has_expense
  )
    reminders.push({
      id: "daily:" + today,
      title: "แวะจดวันของคุณสักนิด",
      detail:
        "วันนี้ยังไม่มีรายจ่ายที่จด ถ้าวันนี้ใช้เงิน แค่ใส่ยอดกับหมวดก็พอ",
      action: "entry",
    });
  if (prefs.budgetAlerts && snapshot.month.slice(0, 7) === today.slice(0, 7))
    for (const e of snapshot.envelopes) {
      if (
        decimalSatang(e.allocated) > 0 &&
        decimalSatang(e.remaining) <= decimalSatang(e.allocated) * 0.2
      )
        reminders.push({
          id: "budget:" + today + ":" + e.id,
          title: `แวะดูกระเป๋า ${e.name}`,
          detail: "กระเป๋านี้ใกล้หมดหรือใช้เกินงบแล้ว ลองทบทวนก่อนใช้ต่อ",
          action: "budget",
        });
    }
  if (
    prefs.weeklyReview &&
    new Date(today + "T12:00:00Z").getUTCDay() === prefs.reviewDay
  )
    reminders.push({
      id: "weekly:" + today,
      title: "ถึงวันทบทวนของเราสองคน",
      detail: "ลองดูกราฟสัปดาห์นี้ แล้วเลือกสิ่งเล็ก ๆ ที่อยากปรับด้วยกัน",
      action: "compare",
    });
  return reminders;
}
