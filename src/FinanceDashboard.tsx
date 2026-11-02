import { NavigationArtwork } from "./components/NavigationArtwork";
import { BudgetTile } from "./components/BudgetTile";
import { GardenDoodle } from "./components/GardenDoodle";
import { DuckPlus, DuckStamp, DuckLoading } from "./components/DuckCompanions";
import { CategoryArtwork } from "./components/CategoryArtwork";
import { DuckMascot } from "./components/DuckMascot";
import { EntryMenu } from "./components/EntryMenu";
import { NotificationCenter } from "./components/NotificationCenter";
import { useTheme } from "./theme";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import {
  Star,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  LogOut,
  Plus,
  RefreshCw,
  ShieldCheck,
  Target,
  Wallet,
} from "lucide-react";
import { supabase } from "./supabase";
import { Button } from "./components/ui/button";
import { QuickExpense, type ExpenseDraft } from "./components/QuickExpense";
import {
  FinancialDialog,
  type FinanceAction,
} from "./components/FinancialDialog";
import { PlannedBudgetChart } from "./components/BudgetVisuals";
import { SavingsGarden, SavingsCelebration } from "./components/SavingsGarden";
import { CategoryDialog } from "./components/CategoryDialog";
import { AppearanceSettings } from "./components/AppearanceSettings";
import { readAppearance, type AppearancePrefs } from "./appearance";
import { HomeDashboard } from "./components/HomeDashboard";
import { MonthlyPlan } from "./components/MonthlyPlan";
import { ChangePassword } from "./components/ChangePassword";
import {
  bangkokToday,
  validateCategoryName,
  type Category,
} from "./categories";
import { baht } from "./finance";
import {
  currentMonth,
  decimalSatang,
  satangDecimal,
  totals,
  requestSignature,
  financialError,
  type LedgerTransaction,
  type LedgerSnapshot,
} from "./ledger";
const Insights = lazy(() => import("./components/Insights"));
const Comparison = lazy(() => import("./components/Comparison"));
const nav = [
  { id: "home", label: "ภาพรวม" },
  { id: "wallets", label: "งบรายเดือน" },
  { id: "insights", label: "ข้อมูลเชิงลึก" },
  { id: "compare", label: "เปรียบเทียบ" },
] as const;
export default function FinanceDashboard({
  user,
  name,
  onDemo,
  onSignOut,
}: {
  user: User;
  name: string;
  onDemo: () => void;
  onSignOut: () => Promise<void>;
}) {
  const [page, setPage] = useState("home");
  const [month, setMonth] = useState(currentMonth);
  const [snapshot, setSnapshot] = useState<LedgerSnapshot | null>(null);
  const { light } = useTheme();
  const [open, setOpen] = useState(false);
  const [entryMenu, setEntryMenu] = useState(false);
  const [action, setAction] = useState<FinanceAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [stale, setStale] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [appearance, setAppearance] = useState(() => readAppearance(user.id));
  const [appearanceError, setAppearanceError] = useState("");
  function changeAppearance(next: AppearancePrefs) {
    setAppearance(next);
    try {
      localStorage.setItem(
        "moneyspace-appearance:" + user.id,
        JSON.stringify(next),
      );
      setAppearanceError("");
    } catch {
      setAppearanceError(
        "บันทึกการตั้งค่าบนเครื่องนี้ไม่ได้ ใช้งานชั่วคราวได้ในหน้านี้",
      );
    }
  }
  async function pinCategory(c: Category) {
    await write("pin_category", {
      category_id: c.id,
      version: c.updated_at,
      favorite: !c.favorite,
    });
  }
  const [celebration, setCelebration] = useState<string | null>(null);
  useEffect(() => {
    if (!celebration) return;
    const timer = window.setTimeout(() => setCelebration(null), 5000);
    return () => window.clearTimeout(timer);
  }, [celebration]);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const pending = useRef(new Map<string, string>());
  const generation = useRef(0);
  const monthRef = useRef(month);
  monthRef.current = month;
  const mounted = useRef(true);
  const load = useCallback(async () => {
    const version = ++generation.current;
    const requestedMonth = monthRef.current;
    let { data, error } = await supabase.rpc("moneyspace_snapshot_v2", {
      p_month: requestedMonth,
    });
    if (!error && data?.current_period_exists === false) {
      const signature = "initialize:" + currentMonth();
      const key = pending.current.get(signature) || crypto.randomUUID();
      pending.current.set(signature, key);
      const initialized = await supabase.rpc("moneyspace_write", {
        p_action: "open_month",
        p_data: { month: currentMonth() },
        p_key: key,
      });
      if (initialized.error || !initialized.data?.confirmed)
        throw new Error("ยังไม่ได้ยืนยันงบเดือนปัจจุบัน");
      const next = await supabase.rpc("moneyspace_snapshot_v2", {
        p_month: requestedMonth,
      });
      data = next.data;
      error = next.error;
    }
    if (error || !data) throw new Error("โหลดข้อมูลจาก Supabase ไม่สำเร็จ");
    if (
      mounted.current &&
      version === generation.current &&
      requestedMonth === monthRef.current
    ) {
      setSnapshot(data as LedgerSnapshot);
      setStale(false);
    }
    return data as LedgerSnapshot;
  }, []);
  useEffect(() => {
    mounted.current = true;
    setSnapshot(null);
    setError("");
    void load().catch(() => {
      if (mounted.current)
        setError("โหลดข้อมูลไม่สำเร็จ ตรวจการเชื่อมต่อแล้วกดโหลดใหม่");
    });
    return () => {
      mounted.current = false;
    };
  }, [month, load]);
  async function write(operation: string, payload: Record<string, unknown>) {
    const signature = requestSignature(operation, payload);
    const key = pending.current.get(signature) || crypto.randomUUID();
    pending.current.set(signature, key);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { data, error } = await supabase.rpc(payload.kind === "income" && (operation === "add_transaction" || operation === "edit_transaction") ? "moneyspace_write_income" : "moneyspace_write", {
        p_action: operation,
        p_data: payload,
        p_key: key,
      });
      if (error) throw new Error(financialError(error));
      if (!data?.confirmed)
        throw new Error("ยังไม่ได้รับการยืนยันจาก Supabase");
      pending.current.delete(signature);
      setNotice("Supabase ยืนยันการบันทึกแล้ว");
      try {
        const fresh = await load();
        if (operation === "earmark_goal") {
          const goal = fresh.goals.find((g) => g.id === payload.goal_id);
          const previous = snapshot?.goals.find(
            (g) => g.id === payload.goal_id,
          );
          setCelebration(
            goal && decimalSatang(goal.saved) >= decimalSatang(goal.target)
              ? "ถึงเป้าหมายแล้ว เก่งมาก!"
              : goal &&
                  previous &&
                  decimalSatang(previous.saved) <
                    decimalSatang(goal.target) / 2 &&
                  decimalSatang(goal.saved) >= decimalSatang(goal.target) / 2
                ? "ผ่านครึ่งทางแล้ว!"
                : "กันเงินให้อนาคตแล้ว!",
          );
        }
      } catch {
        setStale(true);
        setNotice("บันทึกแล้ว แต่โหลดสรุปใหม่ไม่สำเร็จ กรุณากดโหลดใหม่");
      }
    } finally {
      setBusy(false);
    }
  }
  async function saveExpense(draft: ExpenseDraft) {
    await write("add_transaction", {
      kind: "expense",
      amount: satangDecimal(draft.amountSatang),
      account_id: draft.account,
      category_id: draft.category.id,
      envelope_id: draft.envelope,
      date: draft.date,
      merchant: draft.merchant,
      notes: draft.notes,
      tag: draft.tag,
    });
  }
  async function addCategory(c: Category) {
    const issue = validateCategoryName(c.name, snapshot?.categories || []);
    if (issue) throw new Error(issue);
    const { data, error } = await supabase
      .from("categories")
      .insert({
        id: c.id,
        owner_id: user.id,
        name: c.name,
        icon: c.icon,
        default_tag: c.tag,
      })
      .select(
        "id,name,icon,default_tag,updated_at,is_food_drink,spending_group",
      )
      .single();
    if (error)
      throw new Error(
        "ยังไม่ได้ยืนยันการเพิ่มหมวด ตรวจการเชื่อมต่อหรือชื่อหมวดซ้ำ",
      );
    setSnapshot((prev) =>
      prev
        ? {
            ...prev,
            categories: [
              ...prev.categories,
              {
                id: data.id,
                name: data.name,
                icon: data.icon,
                tag: data.default_tag,
                envelope: null,
                updated_at: data.updated_at,
                foodDrink: data.is_food_drink,
                spendingGroup: data.spending_group,
              },
            ],
          }
        : prev,
    );
    setNotice("บันทึกหมวดใน Supabase แล้ว ใช้ซ้ำได้หลังเข้าสู่ระบบ");
  }
  async function categorySubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      await addCategory({
        id: crypto.randomUUID(),
        name: categoryName.trim(),
        icon: "✳️",
        tag: "need",
        envelope: null,
      });
      setCategoryName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ยังไม่ได้ยืนยันการบันทึก");
    }
  }
  async function signOut() {
    setBusy(true);
    try {
      await onSignOut();
    } catch {
      setError("ออกจากระบบไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }
  function shiftMonth(direction: number) {
    const d = new Date(month + "T12:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + direction);
    const next = d.toISOString().slice(0, 7) + "-01";
    if (next >= "2000-01-01" && next <= currentMonth()) setMonth(next);
  }
  const summary = snapshot ? totals(snapshot) : null;
  const today = bangkokToday();
  const monthLabel = new Intl.DateTimeFormat("th-TH", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(month + "T12:00:00Z"));
  function openAction(next: FinanceAction) {
    setError("");
    setAction(next);
  }

  return (
    <div className={`app ${light ? "light" : ""} ${page === "home" ? "home-focused" : ""}`}>
      <aside className="sidebar">
        <a className="brand" href="#" onClick={() => setPage("home")}>
          <span className="brand-mark">
            <DuckMascot pose="wave" />
          </span>
          MONEY<span>SPACE</span>
        </a>
        <div className="space-picker">
          <span className="avatar small">{name.slice(0, 1)}</span>
          <div>
            <strong>พื้นที่ของ {name}</strong>
            <small>ส่วนตัว · บาท</small>
          </div>
          <ShieldCheck size={16} />
        </div>
        <p className="nav-label">พื้นที่ของฉัน</p>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${page === n.id ? "active" : ""}`}
              onClick={() => setPage(n.id)}
            >
              <span className="notebook-nav-icon"><NavigationArtwork name={n.id}/></span>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-coach">
          <DuckMascot pose="tea" className="sidebar-duck" />
          <h3>จดน้อยลง เข้าใจเงินมากขึ้น</h3>
          <p>
            ตั้งงบเพื่อเห็นภาพการใช้จ่าย
            <br />
            ขึ้นเดือนใหม่ เริ่มงบใหม่ให้เอง
          </p>
        </div>
        <div className="sidebar-bottom">
          <button
            className={`nav-item ${page === "settings" ? "active" : ""}`}
            onClick={() => setPage("settings")}
          >
            <NavigationArtwork name="settings" size={26}/>
            ตั้งค่าและหมวด
          </button>
          <button className="nav-item" onClick={onDemo}>
            <CircleHelp size={19} />
            ดูข้อมูลตัวอย่าง
          </button>
          <div className="profile">
            <span className="avatar">{name.slice(0, 1)}</span>
            <div>
              <strong>{name}</strong>
              <small>บัญชีส่วนตัว</small>
            </div>
            <button
              aria-label="ออกจากระบบ"
              onClick={() => void signOut()}
              disabled={busy}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header>
          <div className="breadcrumb">
            พื้นที่ส่วนตัว <ChevronRight size={13} />
            <strong>
              {page === "settings"
                ? "ตั้งค่า"
                : nav.find((n) => n.id === page)?.label}
            </strong>
          </div>
          <div className="header-actions">
            <NotificationCenter
              owner={user.id}
              snapshot={snapshot}
              prefs={appearance}
              light={light}
              onAction={(a) => {
                if (a === "entry") setEntryMenu(true);
                else setPage(a === "budget" ? "wallets" : "compare");
              }}
              onSettings={() => setPage("settings")}
            />
            <button
              className="signin-entry"
              onClick={() => setPage("settings")}
            >
              {name}
            </button>
            <span className="demo-pill">
              <i />
              พื้นที่ส่วนตัว
            </span>
            <button
              aria-label="โหลดใหม่"
              onClick={() =>
                void load().catch(() =>
                  setError("โหลดข้อมูลไม่ได้ กรุณาลองใหม่"),
                )
              }
              disabled={busy}
            >
              <RefreshCw size={17} />
            </button>
          </div>
        </header>
        <main className="real-main"><GardenDoodle kind="flower" className="workspace-flower"/>
          {page !== "home" && (<div className="page-heading">
            <DuckMascot pose={page === "wallets" ? "organize" : page === "settings" ? "wave" : "chart"} className="page-heading-duck"/>
            <div>
              <h1>
                {page === "home"
                  ? `สวัสดี, ${name}`
                  : page === "wallets"
                    ? "งบและเงินเก็บ"
                    : page === "settings"
                      ? "ปรับพื้นที่ให้เป็นคุณ"
                      : page === "compare"
                        ? "Pat × Tape"
                        : "มองเห็นเงินอย่างเข้าใจ"}
              </h1>
              <p>
                {page === "home"
                  ? "เลือกวัน แล้วดูภาพเงินแบบรายวัน รายสัปดาห์ รายรอบเดือน และรายปี"
                  : page === "wallets"
                    ? ""
                    : page === "settings"
                      ? "จัดหมวดให้จดง่ายในแบบของคุณ"
                      : page === "compare"
                        ? "เห็นจังหวะการใช้เงินของเราสองคน"
                        : "ทบทวนพฤติกรรม แล้วเลือกปรับทีละเรื่อง"}
              </p>
            </div>
            <div className="heading-actions">
              {page !== "home" && (
                <div className="date-picker">
                  <button
                    aria-label="เดือนก่อน"
                    disabled={busy}
                    onClick={() => shiftMonth(-1)}
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <span>{monthLabel}</span>
                  <button
                    aria-label="เดือนถัดไป"
                    disabled={busy || month >= currentMonth()}
                    onClick={() => shiftMonth(1)}
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              )}
              <Button
                disabled={busy || !snapshot?.accounts.length}
                onClick={() => setOpen(true)}
              >
                <Plus size={17} />
                เพิ่มรายจ่าย
              </Button>
            </div>
          </div>
          )}
          {notice && (
            <div
              role="status"
              className={`ledger-notice ${stale ? "stale" : ""}`}
            >
              {!stale ? <DuckStamp/> : <DuckMascot pose="journal"/>}
              <span>{notice}</span>
              <button aria-label="ปิดข้อความ" onClick={() => setNotice("")}>
                ×
              </button>
            </div>
          )}
          {error && (
            <div role="alert" className="ledger-error">
              {error}
              <button
                onClick={() =>
                  void load().catch(() =>
                    setError("โหลดข้อมูลไม่ได้ กรุณาลองใหม่"),
                  )
                }
              >
                โหลดใหม่
              </button>
            </div>
          )}
          {!snapshot ? (
            <div className="panel ledger-loading">
              <DuckLoading failed={!!error} text={error ? "ยังเปิดสมุดไม่ได้ ลองโหลดใหม่กัน" : "กำลังเปิดสมุดจาก Supabase…"} onRetry={error?()=>void load().catch(()=>setError("โหลดข้อมูลไม่ได้ กรุณาลองใหม่")):undefined}/>
            </div>
          ) : (
            <>
              {(page === "home" || page === "wallets") && (
                <>
                  {page === "wallets" && (
                    <MonthlyPlan
                      key={month}
                      snapshot={snapshot}
                      light={light}
                      busy={busy}
                      onWrite={write}
                      onBudget={() => openAction({ type: "envelope" })}
                    />
                  )}
                  {page !== "home" && (
                    <div className="budget-money-strip">
                      <span>
                        รายรับที่จด
                        <strong data-testid="actual-income">
                          {baht(decimalSatang(snapshot.income))}
                        </strong>
                      </span>
                      <span>
                        จ่ายจริงสุทธิ
                        <strong data-testid="actual-expenses">
                          {baht(decimalSatang(snapshot.expenses))}
                        </strong>
                      </span>
                      <span>
                        เงินรวมปัจจุบัน
                        <strong data-testid="actual-cash">
                          {baht(summary!.cash)}
                        </strong>
                      </span>
                    </div>
                  )}
                  <div className={page === "home" ? "home-no-actions" : "ledger-action-bar"}>
                    {page === "home" ? null : (
                      <>

                        <Button
                          variant="outline"
                          onClick={() => openAction({ type: "envelope" })}
                        >
                          <Wallet size={16} />
                          เพิ่มงบ
                        </Button>
                        {page === "wallets" && (
                          <Button
                            variant="outline"
                            onClick={() => openAction({ type: "goal" })}
                          >
                            <Target size={16} />
                            เพิ่มเป้าหมาย
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
              {page === "home" && (
                <HomeDashboard
                  revision={snapshot}
                  hidden={appearance.hideSummary}
                  onToggle={() =>
                    changeAppearance({
                      ...appearance,
                      hideSummary: !appearance.hideSummary,
                    })
                  }
                  onTransaction={async (id) => {
                    const { data, error } = await supabase
                      .from("transactions")
                      .select("id,account_id,destination_account_id,kind,amount::text,income_category_code,income_category_name_snapshot,category_id,category_name_snapshot,category_icon_snapshot,food_drink_snapshot,spending_group_snapshot,envelope_id,envelope_name_snapshot,merchant,notes,tag,occurred_on,refund_of_id,updated_at,created_at")
                      .eq("id", id)
                      .eq("owner_id", user.id)
                      .is("household_id", null)
                      .is("deleted_at", null)
                      .single();
                    if (error || !data) throw new Error("Transaction unavailable");
                    openAction({ type: "details", item: {...data,category_name_snapshot:data.kind === "income" ? (data.income_category_name_snapshot ?? data.category_name_snapshot) : data.category_name_snapshot} as LedgerTransaction });
                  }}
                />
              )}
              {page === "wallets" && (
                <>
                  <SavingsGarden
                    goals={snapshot.goals}
                    onAdd={() => openAction({ type: "goal" })}
                    onEdit={(goal) => openAction({ type: "editGoal", goal })}
                    onSave={(goal) => openAction({ type: "earmark", goal })}
                  />
                  <section className="panel">
                    <div className="section-heading">
                      <div>
                        <h2>งบประจำเดือน</h2>

                      </div>
                      <Wallet size={20} />
                    </div>
                    {!snapshot.envelopes.length ? (
                      <div className="ledger-empty">
                        <h3>เริ่มจากงบที่คุณใช้บ่อย</h3>
                        <p>
                          เช่น อาหารและเครื่องดื่ม เดินทาง ค่าน้ำค่าไฟ
                          หรือค่ามือถือ
                        </p>
                        <Button
                          onClick={() => openAction({ type: "envelope" })}
                        >
                          <Plus size={16} />
                          ตั้งงบแรก
                        </Button>
                      </div>
                    ) : (
                      <div className="real-envelope-grid">{snapshot.envelopes.map(e=><BudgetTile key={e.id} name={e.name} icon={e.icon} color={e.color} target={e.allocated} spent={e.spent} remaining={e.remaining} onEdit={()=>openAction({type:"allocate",envelope:e})}/>)}</div>
                    )}
                  </section>
                  <PlannedBudgetChart
                    envelopes={snapshot.envelopes}
                    income={snapshot.income}
                  />
                  {snapshot.contributions.length>0&&<section className="panel real-goals">
                    <div className="section-heading">
                      <div>
                        <h2>เงินที่กันไว้</h2>
                        
                      </div>
                    </div>
                    {snapshot.contributions.map((c) => (
                      <div className="contribution-row" key={c.id}>
                        <span>
                          {c.goal_name_snapshot ||
                            snapshot.goals.find((g) => g.id === c.goal_id)
                              ?.name}{" "}
                          · {baht(decimalSatang(c.amount))}
                        </span>
                        <button
                          className="text-link"
                          disabled={busy}
                          onClick={() =>
                            void write("release_goal", { id: c.id }).catch(
                              (e) => setError(e.message),
                            )
                          }
                        >
                          คืนเงินออม
                        </button>
                      </div>
                    ))}
                  </section>}
                </>
              )}
              {page === "settings" && (
                <>
                  <AppearanceSettings
                    value={appearance}
                    onChange={changeAppearance}
                    error={appearanceError}
                  />
                  <section className="panel">
                    <div className="section-heading">
                      <div>
                        <h2>หมวดที่ใช้ซ้ำ</h2>
                        <p>
                          แก้ชื่อ emoji หรือลบหมวดได้
                          โดยไม่เปลี่ยนรายการและกราฟเก่า
                        </p>
                      </div>
                      <ShieldCheck size={17} />
                    </div>
                    <div className="category-mappings">
                      {snapshot.categories.map((c) => (
                        <div key={c.id}>
                          <span>
                            <CategoryArtwork icon={c.icon} name={c.name}/>{c.name}
                            <small className="category-default-tag">
                              {c.tag === "want"
                                ? "ความสุข · Want"
                                : "จำเป็น · Need"}
                            </small>
                          </span>
                          <button
                            className={`settings-pin ${c.favorite ? "pinned" : ""}`}
                            aria-label={`${c.favorite ? "เลิกปักหมวด" : "ปักหมวด"} ${c.name}`}
                            aria-pressed={!!c.favorite}
                            disabled={busy}
                            onClick={() =>
                              void pinCategory(c).catch((e) =>
                                setError(e.message),
                              )
                            }
                          >
                            <Star
                              size={16}
                              fill={c.favorite ? "currentColor" : "none"}
                            />
                          </button>
                          <button
                            className="text-link"
                            aria-label={`แก้ไขหมวด ${c.name}`}
                            onClick={() => setEditingCategory(c)}
                            disabled={busy}
                          >
                            แก้ไข
                          </button>
                          <select
                            aria-label={`ซองสำหรับ ${c.name}`}
                            value={c.envelope || ""}
                            disabled={busy}
                            onChange={(e) =>
                              void write("link_category", {
                                category_id: c.id,
                                envelope_id: e.target.value || null,
                              }).catch((e) => setError(e.message))
                            }
                          >
                            <option value="">ไม่ผูกซอง</option>
                            {snapshot.envelopes.map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                    <form
                      className="add-live-category"
                      onSubmit={categorySubmit}
                    >
                      <label>
                        เพิ่มหมวดไว้ใช้ซ้ำ
                        <input
                          value={categoryName}
                          onChange={(e) => setCategoryName(e.target.value)}
                          required
                          maxLength={40}
                          placeholder="เช่น สัตว์เลี้ยง"
                        />
                      </label>
                      <Button type="submit" variant="outline">
                        <Plus size={15} />
                        เพิ่มหมวด
                      </Button>
                    </form>
                  </section>
                  <ChangePassword email={user.email || ""} />
                  <section className="panel live-settings">
                    <Button
                      variant="outline"
                      onClick={() => openAction({ type: "history" })}
                    >
                      ประวัติรายการ
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => void signOut()}
                      disabled={busy}
                    >
                      <LogOut size={15} />
                      ออกจากระบบ
                    </Button>
                  </section>
                </>
              )}
              {page === "compare" && (
                <Suspense
                  fallback={
                    <section className="panel">
                      กำลังเปิดกราฟเปรียบเทียบ…
                    </section>
                  }
                >
                  <Comparison month={month} revision={snapshot} />
                </Suspense>
              )}
              {page === "insights" && (
                <Suspense
                  fallback={
                    <section className="panel">กำลังเปิดข้อมูลเชิงลึก…</section>
                  }
                >
                  <Insights
                    snapshot={snapshot}
                    onBudgets={() => setPage("wallets")}
                    onAddExpense={() => setOpen(true)}
                    onGoal={(purpose) => {
                      const goal =
                        purpose === "emergency"
                          ? snapshot.goals.find((g) =>
                              /ฉุกเฉิน|emergency/i.test(g.name),
                            )
                          : snapshot.goals[0];
                      openAction(
                        goal
                          ? { type: "earmark", goal }
                          : {
                              type: "goal",
                              presetName:
                                purpose === "emergency"
                                  ? "เงินฉุกเฉิน"
                                  : "เงินเก็บ",
                            },
                      );
                    }}
                  />
                </Suspense>
              )}
            </>
          )}
          {celebration && (
            <SavingsCelebration
              title={celebration}
              onClose={() => setCelebration(null)}
            />
          )}
          <footer>
            <span><DuckMascot pose="tail" className="footer-duck"/> MONEYSPACE</span>
            <span>
              <ShieldCheck size={13} />
              พื้นที่การเงินส่วนตัว
            </span>
          </footer>
        </main>
      </div>
      <nav className="bottom-nav">
        <div className="bottom-nav-group">
        {nav.slice(0, 2).map((n) => (
          <button
            key={n.id}
            className={page === n.id ? "active" : ""}
            onClick={() => setPage(n.id)}
          >
            <span className="notebook-nav-icon"><NavigationArtwork name={n.id}/></span>
            <span>{n.label}</span>
          </button>
        ))}
        </div>
        <button
          className="mobile-add"
          aria-label="เพิ่มรายการ" aria-haspopup="dialog" aria-expanded={entryMenu}
          disabled={busy || !snapshot?.accounts.length}
          onClick={() => setEntryMenu(true)}
        >
          <span>
            <DuckPlus/>
          </span>
          <small>จด</small>
        </button>
        <div className="bottom-nav-group">
        {nav.slice(2).map((n) => (
          <button
            key={n.id}
            className={page === n.id ? "active" : ""}
            onClick={() => setPage(n.id)}
          >
            <span className="notebook-nav-icon"><NavigationArtwork name={n.id}/></span>
            <span>{n.label}</span>
          </button>
        ))}
        <button
          className={page === "settings" ? "active" : ""}
          onClick={() => setPage("settings")}
        >
          <NavigationArtwork name="settings"/>
          <span>ตั้งค่า</span>
        </button>
        </div>
      </nav>
      {snapshot && (
        <>
          <EntryMenu open={entryMenu} onOpenChange={setEntryMenu} goals={snapshot.goals} onExpense={() => setOpen(true)} onIncome={() => openAction({type:"income"})} onSavings={goal => openAction(goal ? {type:"earmark",goal} : {type:"goal"})} />
          <button className="desktop-entry-add" aria-label="เพิ่มรายการ" onClick={() => setEntryMenu(true)} disabled={busy || !snapshot.accounts.length}><DuckPlus/></button>
          {editingCategory && (
            <CategoryDialog
              key={editingCategory.id}
              category={editingCategory}
              categories={snapshot.categories}
              light={light}
              busy={busy}
              onClose={() => setEditingCategory(null)}
              onWrite={write}
            />
          )}
          <QuickExpense
            onPinCategory={pinCategory}
            open={open}
            onOpenChange={setOpen}
            light={light}
            categories={snapshot.categories}
            onAddCategory={addCategory}
            onSave={saveExpense}
            accounts={snapshot.accounts}
            envelopes={snapshot.envelopes}
            demo={false}
            defaultDate={month === currentMonth() ? today : month}
          />
          {action && (
            <FinancialDialog
              key={
                action.type +
                "-" +
                (action.item?.id ||
                  action.envelope?.id ||
                  action.goal?.id ||
                  "")
              }
              action={action}
              snapshot={snapshot}
              light={light}
              onClose={() => setAction(null)}
              onChange={setAction}
              onWrite={write}
              busy={busy}
            />
          )}
        </>
      )}
    </div>
  );
}
