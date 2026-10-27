import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Bell, Check, X } from "lucide-react";
import { supabase } from "../supabase";
import { bangkokToday } from "../categories";
import type { AppearancePrefs } from "../appearance";
import type { LedgerSnapshot } from "../ledger";
import { remindersFor, type Reminder } from "../reminders";
export function NotificationCenter({
  owner,
  snapshot,
  prefs,
  light,
  onAction,
  onSettings,
}: {
  owner: string;
  snapshot: LedgerSnapshot | null;
  prefs: AppearancePrefs;
  light: boolean;
  onAction: (action: Reminder["action"]) => void;
  onSettings: () => void;
}) {
  const [open, setOpen] = useState(false),
    [now, setNow] = useState(() => new Date()),
    [context, setContext] = useState<{
      today: string;
      has_expense: boolean;
    } | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [dismissed, setDismissed] = useState<string[]>([]);
  const today = bangkokToday();
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem(
          `moneyspace-reminder-dismissed:${owner}:${today}`,
        ) || "[]",
      );
      setDismissed(
        Array.isArray(saved) ? saved.filter((v) => typeof v === "string") : [],
      );
    } catch {
      setDismissed([]);
    }
  }, [owner, today]);
  useEffect(() => {
    let live = true;
    setContext(null);
    setError("");
    if (!snapshot || !prefs.dailyReminder) return;
    void supabase.rpc("moneyspace_reminder_context").then(
      ({ data, error }) => {
        if (!live) return;
        if (error || !data)
          setError("ตรวจรายการวันนี้ไม่ได้ จึงยังไม่แสดงคำเตือนให้จดซ้ำ");
        else setContext(data);
      },
      () => {
        if (live) setError("ตรวจรายการวันนี้ไม่ได้");
      },
    );
    return () => {
      live = false;
    };
  }, [snapshot, prefs.dailyReminder, today, retry, open]);
  const reminders = snapshot
    ? remindersFor(prefs, snapshot, today, time, context).filter(
        (r) => !dismissed.includes(r.id),
      )
    : [];
  function dismiss(id: string) {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      localStorage.setItem(
        `moneyspace-reminder-dismissed:${owner}:${today}`,
        JSON.stringify(next),
      );
    } catch {
      setError("ปิดข้อความชั่วคราวแล้ว แต่บันทึกบนเครื่องนี้ไม่ได้");
    }
  }
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          className="real-notification-bell"
          aria-label={`การแจ้งเตือน${reminders.length ? " " + reminders.length + " รายการ" : ""}`}
        >
          <Bell size={19} />
          {reminders.length > 0 && <span>{reminders.length}</span>}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className={`dialog-content reminder-dialog ${light ? "light" : ""}`}
        >
          <Dialog.Title>พักดูเรื่องเงินสักนิด</Dialog.Title>
          <Dialog.Description>
            เตือนในแอปเมื่อเปิดใช้งาน · ไม่มี push หรือการแจ้งเตือนเมื่อปิดแอป
          </Dialog.Description>
          <Dialog.Close className="dialog-close" aria-label="ปิด">
            <X size={20} />
          </Dialog.Close>
          {error && (
            <div className="reminder-error" role="alert">
              {error}
              <button
                className="text-link"
                onClick={() => setRetry((v) => v + 1)}
              >
                ลองตรวจใหม่
              </button>
            </div>
          )}
          {reminders.length ? (
            <div className="reminder-list">
              {reminders.map((r) => (
                <article key={r.id}>
                  <Bell size={18} />
                  <div>
                    <h3>{r.title}</h3>
                    <p>{r.detail}</p>
                    <button
                      className="text-link"
                      onClick={() => {
                        setOpen(false);
                        onAction(r.action);
                      }}
                    >
                      {r.action === "entry"
                        ? "จดรายจ่าย →"
                        : r.action === "budget"
                          ? "ดูกระเป๋า →"
                          : "ดูกราฟเปรียบเทียบ →"}
                    </button>
                  </div>
                  <button
                    aria-label={`ปิดข้อความ ${r.title}`}
                    onClick={() => dismiss(r.id)}
                  >
                    <X size={16} />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="reminder-empty">
              <Check size={30} />
              <h3>ตอนนี้ไม่มีเรื่องที่ต้องเตือน</h3>
              <p>ตั้งเวลาชวนจดและวันทบทวนในแบบของคุณได้</p>
            </div>
          )}
          <button
            className="text-link"
            onClick={() => {
              setOpen(false);
              onSettings();
            }}
          >
            ตั้งค่าการเตือน →
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
