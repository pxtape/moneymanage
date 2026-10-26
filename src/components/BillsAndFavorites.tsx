import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { CalendarClock, Check, Plus, Star, X } from "lucide-react";
import { Button } from "./ui/button";
import { baht, parseAmount } from "../finance";
import { bangkokToday } from "../categories";
import {
  currentMonth,
  decimalSatang,
  satangDecimal,
  type LedgerSnapshot,
  type LedgerTransaction,
} from "../ledger";
import { supabase } from "../supabase";
import {
  dueDate,
  type BillRule,
  type BillItem,
  type ExpenseTemplate,
} from "../bills";
type Write = (action: string, data: Record<string, unknown>) => Promise<void>;
export type SetupAction =
  | { type: "bill"; item?: BillRule }
  | { type: "template"; item?: ExpenseTemplate }
  | { type: "pay"; item: BillItem };
export function FavoriteExpenses({
  snapshot,
  onUse,
  onSetup,
  manage = false,
}: {
  snapshot: LedgerSnapshot;
  onUse: (t: ExpenseTemplate) => void;
  onSetup: (a: SetupAction) => void;
  manage?: boolean;
}) {
  const templates = snapshot.expense_templates || [];
  return (
    <section
      className={`panel expense-favorites ${manage ? "" : "compact-favorites"}`}
      aria-label="รายการโปรด"
    >
      <div className="section-heading">
        <div>
          <h2>
            <Star size={17} /> รายการโปรด
          </h2>
          <p>จำยอดกับหมวดไว้ · กดเพื่อตรวจแล้วค่อยบันทึก</p>
        </div>
        <button
          className="text-link"
          onClick={() => onSetup({ type: "template" })}
        >
          <Plus size={15} />
          เพิ่ม
        </button>
      </div>
      <div className="favorite-expense-list">
        {templates.map((t) => {
          const c = snapshot.categories.find((c) => c.id === t.category_id);
          return (
            <div key={t.id}>
              <button disabled={!c} onClick={() => onUse(t)}>
                <span>
                  {c?.icon || "⚠️"} {t.name}
                </span>
                <strong>{baht(decimalSatang(t.amount))}</strong>
                {!c && <small>หมวดเลิกใช้แล้ว กรุณาแก้ไข</small>}
              </button>
              {manage && (
                <button
                  className="text-link"
                  aria-label={`แก้รายการโปรด ${t.name}`}
                  onClick={() => onSetup({ type: "template", item: t })}
                >
                  แก้ไข
                </button>
              )}
            </div>
          );
        })}
      </div>
      {!templates.length && (
        <p className="muted">เช่น กาแฟ 50 บาท หรือข้าวกลางวัน 60 บาท</p>
      )}
    </section>
  );
}
export function BillsPanel({
  snapshot,
  onSetup,
  onDetails,
  compact = false,
  onAll,
}: {
  snapshot: LedgerSnapshot;
  onSetup: (a: SetupAction) => void;
  onDetails: (t: LedgerTransaction) => void;
  compact?: boolean;
  onAll?: () => void;
}) {
  const bills = snapshot.bills;
  const list = compact
    ? (bills?.pending_current || []).slice(0, 3)
    : bills?.items || [];
  const today = bangkokToday();
  return (
    <section className={`panel bills-panel ${compact ? "compact-bills" : ""}`}>
      <div className="section-heading">
        <div>
          <h2>
            <CalendarClock size={18} /> บิลประจำ{compact ? "ที่รอจ่าย" : ""}
          </h2>
          <p>
            {compact
              ? "เดือนปัจจุบันและรอบค้าง · ยังไม่หักเงินจริง"
              : "ยอดตั้งไว้เป็นประมาณการ · หักเงินจริงเมื่อยืนยันจ่ายเท่านั้น"}
          </p>
        </div>
        <button
          className="text-link"
          onClick={() =>
            compact && onAll ? onAll() : onSetup({ type: "bill" })
          }
        >
          {compact ? "จัดการบิล →" : "+ ตั้งบิล"}
        </button>
      </div>
      {list.length ? (
        <div className="bill-list">
          {list.map((b) => (
            <div className="bill-row" key={b.rule_id + b.period_start}>
              <span
                className={`bill-status ${b.paid ? "paid" : b.due_on < today ? "overdue" : ""}`}
              >
                {b.paid ? <Check size={17} /> : <CalendarClock size={17} />}
              </span>
              <div>
                <strong>{b.name}</strong>
                <small>
                  {b.paid ? "จ่ายแล้ว" : b.due_on < today ? "เลยกำหนด · " : ""}
                  {!b.paid && "กำหนด "}
                  {new Date(b.due_on + "T12:00:00Z").toLocaleDateString(
                    "th-TH",
                    {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      timeZone: "Asia/Bangkok",
                    },
                  )}
                </small>
              </div>
              <div className="bill-row-amount">
                <strong>
                  {baht(decimalSatang(b.transaction?.amount || b.amount))}
                </strong>
                <button
                  className="text-link"
                  onClick={() =>
                    b.paid && b.transaction
                      ? onDetails(b.transaction)
                      : onSetup({ type: "pay", item: b })
                  }
                >
                  {b.paid ? "ดูรายการ" : "ยืนยันจ่าย"}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">
          {compact
            ? "ไม่มีบิลรอจ่ายที่ตั้งไว้"
            : "เดือนนี้ไม่มีบิลรอจ่ายหรือบิลที่ยืนยันแล้ว"}
        </p>
      )}
      {!compact && (
        <details className="bill-definitions">
          <summary>จัดการบิลที่ตั้งไว้ ({bills?.rules.length || 0})</summary>
          {bills?.rules.map((r) => (
            <div className="contribution-row" key={r.id}>
              <span>
                {r.name} · ทุกวันที่ {r.due_day} ·{" "}
                {baht(decimalSatang(r.amount))}
              </span>
              <button
                className="text-link"
                aria-label={`แก้บิล ${r.name}`}
                onClick={() => onSetup({ type: "bill", item: r })}
              >
                แก้ไข / หยุด
              </button>
            </div>
          ))}
          <p className="muted">
            วันที่ 29–31 จะใช้วันสุดท้ายในเดือนที่มีวันไม่ถึง
            ไม่มีการจ่ายอัตโนมัติ
          </p>
        </details>
      )}
    </section>
  );
}
export function BillsSetupDialog({
  action,
  snapshot,
  light,
  onClose,
  onWrite,
}: {
  action: SetupAction;
  snapshot: LedgerSnapshot;
  light: boolean;
  onClose: () => void;
  onWrite: Write;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [mode, setMode] = useState("new");
  const [candidates, setCandidates] = useState<
    {
      id: string;
      merchant: string;
      amount: string;
      occurred_on: string;
      updated_at: string;
    }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [candidateError, setCandidateError] = useState("");
  const [retry, setRetry] = useState(0);
  const lock = useRef(false);
  const pay = action.type === "pay" ? action.item : null;
  const definition = action.type === "bill" ? action.item : null;
  const saved = action.type !== "pay" ? action.item : null;
  useEffect(() => {
    if (!pay || mode !== "link") return;
    let live = true;
    setLoading(true);
    setCandidateError("");
    void supabase
      .rpc("moneyspace_bill_candidates", {
        p_rule_id: pay.rule_id,
        p_month: pay.period_start,
      })
      .then(({ data, error }) => {
        if (!live) return;
        if (error) {
          setCandidateError(
            "โหลดรายการเดิมไม่สำเร็จ ลองใหม่ได้โดยไม่สร้างรายจ่ายซ้ำ",
          );
          setCandidates([]);
        } else setCandidates(data || []);
        setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [pay, mode, retry]);
  async function commit(operation: string, data: Record<string, unknown>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await onWrite(operation, data);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ยังไม่ได้ยืนยันการบันทึก");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (removing && saved) {
      void commit(action.type === "bill" ? "stop_bill" : "delete_template", {
        id: saved.id,
        version: saved.updated_at,
      });
      return;
    }
    if (pay) {
      if (mode === "link") {
        const transaction_id = String(f.get("transaction_id") || "");
        if (!transaction_id) {
          setError("เลือกรายจ่ายที่จดไว้แล้ว");
          return;
        }
        void commit("pay_bill", {
          id: pay.rule_id,
          month: pay.period_start,
          version: pay.version,
          transaction_id,
          transaction_version: candidates.find((t) => t.id === transaction_id)
            ?.updated_at,
        });
        return;
      }
      const amount = parseAmount(String(f.get("amount")));
      if (!amount) {
        setError("ใส่ยอดที่จ่ายจริง มากกว่า 0 และทศนิยมไม่เกิน 2 ตำแหน่ง");
        return;
      }
      void commit("pay_bill", {
        id: pay.rule_id,
        month: pay.period_start,
        version: pay.version,
        amount: satangDecimal(amount),
        date: String(f.get("date")),
      });
      return;
    }
    const amount = parseAmount(String(f.get("amount")));
    if (!amount) {
      setError("ใส่ยอดมากกว่า 0 และทศนิยมไม่เกิน 2 ตำแหน่ง");
      return;
    }
    const data: Record<string, unknown> = {
      name: String(f.get("name")).trim(),
      amount: satangDecimal(amount),
      category_id: String(f.get("category_id")),
      ...(saved ? { id: saved.id, version: saved.updated_at } : {}),
    };
    if (action.type === "bill") {
      data.first_month = String(f.get("first_month")) + "-01";
      data.due_day = Number(f.get("due_day"));
      data.envelope_id = String(f.get("envelope_id")) || null;
    }
    void commit(`${saved ? "update" : "create"}_${action.type}`, data);
  }
  return (
    <Dialog.Root
      open
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className={`dialog-content bill-dialog ${light ? "light" : ""}`}
        >
          <Dialog.Title>
            {removing
              ? action.type === "bill"
                ? "หยุดบิลนี้?"
                : "ลบรายการโปรดนี้?"
              : pay
                ? "ยืนยันจ่ายบิล"
                : action.type === "bill"
                  ? saved
                    ? "แก้บิลประจำ"
                    : "ตั้งบิลประจำ"
                  : saved
                    ? "แก้รายการโปรด"
                    : "เพิ่มรายการโปรด"}
          </Dialog.Title>
          <Dialog.Description>
            {removing
              ? "ประวัติรายจ่ายที่บันทึกแล้วจะยังอยู่"
              : pay
                ? `${pay.name} · กำหนด ${pay.due_on} · ประมาณ ${baht(decimalSatang(pay.amount))}`
                : action.type === "bill"
                  ? "ตั้งไว้เตือนตัวเอง ไม่ตัดเงินหรือสร้างรายจ่ายอัตโนมัติ"
                  : "เก็บยอดกับหมวดเป็นทางลัด ยังไม่สร้างรายจ่าย"}
          </Dialog.Description>
          <Dialog.Close
            className="dialog-close"
            disabled={busy}
            aria-label="ปิด"
          >
            <X size={20} />
          </Dialog.Close>
          <form onSubmit={submit}>
            <fieldset disabled={busy} className="bill-form">
              {removing ? (
                <p>
                  {action.type === "bill"
                    ? "รอบที่ยังไม่จ่ายและบิลในอนาคตจะหยุดแสดง ยอดเงินจริงไม่เปลี่ยน"
                    : "ลบเฉพาะทางลัด รายจ่ายเก่าไม่เปลี่ยน"}
                </p>
              ) : pay ? (
                <>
                  <div className="bill-payment-mode">
                    <button
                      type="button"
                      aria-pressed={mode === "new"}
                      onClick={() => setMode("new")}
                    >
                      ยังไม่ได้จด
                    </button>
                    <button
                      type="button"
                      aria-pressed={mode === "link"}
                      onClick={() => setMode("link")}
                    >
                      จดรายจ่ายนี้แล้ว
                    </button>
                  </div>
                  {mode === "new" ? (
                    <>
                      <p className="muted">
                        จะสร้างรายจ่าย 1 รายการ หากบันทึกไปแล้วให้เลือก
                        “จดรายจ่ายนี้แล้ว”
                      </p>
                      <label>
                        ยอดจ่ายจริง (บาท)
                        <input
                          name="amount"
                          inputMode="decimal"
                          required
                          defaultValue={pay.amount}
                        />
                      </label>
                      <label>
                        วันที่จ่าย
                        <input
                          name="date"
                          type="date"
                          required
                          min={pay.period_start}
                          max={bangkokToday()}
                          defaultValue={bangkokToday()}
                        />
                      </label>
                    </>
                  ) : (
                    <>
                      <p className="muted">
                        ผูกกับรายจ่ายเดิมหมวดเดียวกัน ไม่หักเงินเพิ่ม ·
                        แสดงล่าสุด 50 รายการที่ยังไม่ผูกบิล ตั้งแต่ต้นรอบนี้
                      </p>
                      {loading ? (
                        <p role="status">กำลังโหลดรายการเดิม…</p>
                      ) : candidateError ? (
                        <div role="alert">
                          {candidateError}
                          <button
                            type="button"
                            onClick={() => setRetry((v) => v + 1)}
                          >
                            ลองใหม่
                          </button>
                        </div>
                      ) : (
                        <label>
                          รายการที่จดไว้
                          <select
                            aria-label="รายการที่จดไว้"
                            name="transaction_id"
                            required
                            defaultValue=""
                          >
                            <option value="">เลือกรายการ</option>
                            {candidates.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.occurred_on} · {t.merchant} ·{" "}
                                {baht(decimalSatang(t.amount))}
                              </option>
                            ))}
                          </select>
                          {!candidates.length && (
                            <small>
                              ไม่พบรายการที่ผูกได้
                              ลองตรวจหมวดและวันที่ของรายจ่ายเดิม
                            </small>
                          )}
                        </label>
                      )}
                    </>
                  )}
                </>
              ) : (
                <>
                  <label>
                    ชื่อ{action.type === "bill" ? "บิล" : "รายการโปรด"}
                    <input
                      name="name"
                      required
                      maxLength={60}
                      defaultValue={saved?.name || ""}
                      placeholder={
                        action.type === "bill"
                          ? "เช่น ค่าโทรศัพท์"
                          : "เช่น กาแฟแก้วประจำ"
                      }
                    />
                  </label>
                  <label>
                    {action.type === "bill" ? "ยอดประมาณการ" : "ยอดที่ใช้บ่อย"}{" "}
                    (บาท)
                    <input
                      name="amount"
                      inputMode="decimal"
                      required
                      defaultValue={saved?.amount || ""}
                    />
                  </label>
                  <label>
                    หมวด
                    <select
                      aria-label="หมวด"
                      name="category_id"
                      required
                      defaultValue={saved?.category_id || ""}
                    >
                      <option value="">เลือกหมวด</option>
                      {snapshot.categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.icon} {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {action.type === "bill" && (
                    <>
                      <label>
                        กระเป๋างบ
                        <select
                          aria-label="กระเป๋างบ"
                          name="envelope_id"
                          defaultValue={definition?.envelope_id || ""}
                        >
                          <option value="">ไม่ผูกกระเป๋า</option>
                          {snapshot.envelopes.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="form-row">
                        <label>
                          เริ่มรอบเดือน
                          <input
                            type="month"
                            name="first_month"
                            required
                            defaultValue={(
                              definition?.first_month || currentMonth()
                            ).slice(0, 7)}
                          />
                        </label>
                        <label>
                          ครบกำหนดวันที่
                          <select
                            aria-label="ครบกำหนดวันที่"
                            name="due_day"
                            defaultValue={definition?.due_day || 1}
                          >
                            {Array.from({ length: 31 }, (_, i) => (
                              <option key={i + 1} value={i + 1}>
                                {i + 1}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <p className="muted">
                        ถ้าเดือนไม่ถึงวันที่ตั้งไว้ ใช้วันสุดท้ายของเดือน เช่น{" "}
                        {dueDate(currentMonth(), 31)}
                        {saved
                          ? " · การแก้เปลี่ยนเฉพาะรอบที่ยังไม่จ่าย ประวัติรอบที่จ่ายแล้วไม่เปลี่ยน"
                          : ""}
                      </p>
                    </>
                  )}
                </>
              )}
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                disabled={
                  busy ||
                  (!!pay && mode === "link" && (loading || !!candidateError))
                }
              >
                {busy
                  ? "กำลังรอ Supabase ยืนยัน…"
                  : removing
                    ? "ยืนยัน"
                    : pay
                      ? mode === "link"
                        ? "ยืนยันผูกกับรายการเดิม"
                        : "ยืนยันจ่ายและบันทึกรายจ่าย"
                      : "บันทึก"}
              </Button>
              {saved && (
                <button
                  type="button"
                  className="text-link danger-link"
                  onClick={() => setRemoving(!removing)}
                >
                  {removing
                    ? "กลับไปแก้ไข"
                    : action.type === "bill"
                      ? "หยุดบิลนี้"
                      : "ลบรายการโปรด"}
                </button>
              )}
            </fieldset>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
