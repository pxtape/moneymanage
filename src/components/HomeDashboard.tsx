import { GardenDoodle } from './GardenDoodle';
import gardenHeader from '../assets/duck-garden-header.webp';
import { BudgetTile } from "./BudgetTile";
import { DuckLoading } from "./DuckCompanions";
import { DuckCalendar } from "./DuckCalendar";
import { CategoryArtwork } from "./CategoryArtwork";
import { DuckMascot } from "./DuckMascot";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  ChartPie,
  ListFilter,
  Settings2,
} from "lucide-react";
import { supabase } from "../supabase";
import { baht, parseAmount, shortBaht } from "../finance";
import { bangkokToday } from "../categories";
import {
  gaugePercent,
  homeMoney,
  type HomeDashboardData,
  type HomeRange,
} from "../home-dashboard";
import { Button } from "./ui/button";

const colors = [
  "#7c9570",
  "#7b98ba",
  "#e0ad4e",
  "#cd8299",
  "#a28abc",
  "#68a5a1",
  "#cd9064",
];
const ranges: { id: HomeRange; label: string }[] = [
  { id: "day", label: "รายวัน" },
  { id: "week", label: "รายสัปดาห์" },
  { id: "month", label: "รายเดือน" },
  { id: "year", label: "รายปี" },
];
const dayTabs = [
  { id: "meter", label: "เป้ารายวัน" },
  { id: "pie", label: "หมวดที่จ่าย" },
  { id: "types", label: "รับ–จ่าย" },
] as const;
const money = (v: unknown) => baht(Number(v) || 0);
const shortDate = (date: string) =>
  new Date(date + "T12:00:00Z").toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Bangkok",
  });
const fullDate = (date: string) =>
  new Date(date + "T12:00:00Z").toLocaleDateString("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
const monthName = (date: string) =>
  new Date(date + "T12:00:00Z").toLocaleDateString("th-TH", {
    month: "short",
    timeZone: "Asia/Bangkok",
  });

export function HomeDashboard({
  revision,
  hidden,
  onToggle,
  onTransaction,
}: {
  revision: unknown;
  hidden: boolean;
  onToggle: () => void;
  onTransaction: (id: string) => Promise<void>;
}) {
  const today = bangkokToday();
  const [calendar,setCalendar]=useState(false);
  const [date, setDate] = useState(today);
  const [range, setRange] = useState<HomeRange>("day");
  const [dayTab, setDayTab] = useState<(typeof dayTabs)[number]["id"]>("meter");
  const [data, setData] = useState<HomeDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dailyTarget, setDailyTarget] = useState("0.00");
  const [targetDraft, setTargetDraft] = useState("0.00");
  const [targetError, setTargetError] = useState("");
  const [savingTarget, setSavingTarget] = useState(false);
  async function saveDailyTarget(e: React.FormEvent) {
    e.preventDefault();
    const cents = /^0+(\.0{1,2})?$/.test(targetDraft) ? 0 : parseAmount(targetDraft);
    if (cents === null || cents > 99999999999) {
      setTargetError("ใช้จำนวนเงินตั้งแต่ 0 และทศนิยมไม่เกิน 2 ตำแหน่ง");
      return;
    }
    setSavingTarget(true);
    setTargetError("");
    try {
      const value = (cents / 100).toFixed(2);
      const { data: saved, error } = await supabase.rpc("moneyspace_daily_target", { p_amount: value });
      if (error || typeof saved !== "string" || homeMoney(saved) !== cents) throw new Error();
      setDailyTarget(saved);
      setTargetDraft(saved);
    } catch {
      setTargetError("ยังไม่ได้ยืนยันเป้ารายวัน กรุณาลองใหม่");
    } finally {
      setSavingTarget(false);
    }
  }
  const [opening, setOpening] = useState<string | null>(null);
  async function openTransaction(id: string) {
    if (opening) return;
    setOpening(id);
    setError("");
    try {
      await onTransaction(id);
    } catch {
      setError("เปิดรายการไม่ได้ รายการอาจถูกลบแล้ว กรุณาลองใหม่");
    } finally {
      setOpening(null);
    }
  }
  const currentDate = useRef(date);
  currentDate.current = date;
  const request = useRef(0);
  const load = useCallback(async () => {
    if (currentDate.current !== date) return;
    const generation = ++request.current;
    setLoading(true);
    setError("");
    const { data: result, error } = await supabase.rpc("moneyspace_home_v2", {
      p_date: date,
    });
    if (generation !== request.current || currentDate.current !== date) return;
    if (error || !result) {
      setData(previous => previous?.selected_date === date ? previous : null);
      setError("โหลดภาพรวมตามวันที่เลือกไม่ได้ กรุณาลองใหม่");
      setLoading(false);
      return;
    }
    setData(result as HomeDashboardData);
    setLoading(false);
  }, [date]);
  const invalidateLoad = useCallback(() => { request.current++; }, []);
  useEffect(() => {
    void load();
    return invalidateLoad;
  }, [load, revision, invalidateLoad]);
  useEffect(() => {
    let active = true;
    void supabase.rpc("moneyspace_daily_target").then(({ data: value, error }) => {
      if (!active) return;
      if (error || typeof value !== "string") {
        setTargetError("โหลดเป้ารายวันไม่ได้ กรุณาโหลดหน้าใหม่");
      } else {
        setDailyTarget(value);
        setTargetDraft(value);
      }
    });
    return () => { active = false; };
  }, []);
  function shiftDay(amount: number) {
    const d = new Date(date + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + amount);
    const next = d.toISOString().slice(0, 10);
    if (next >= "2000-01-01" && next <= today) setDate(next);
  }
  async function saveCycle(day: number) {
    setSaving(true);
    setError("");
    const { data: saved, error } = await supabase.rpc(
      "moneyspace_set_cycle_day",
      { p_day: day },
    );
    if (error || saved !== day) {
      setError("ยังไม่ได้ยืนยันวันเริ่มรอบจาก Supabase");
      setSaving(false);
      return;
    }
    await load();
    setSaving(false);
  }
  if (loading && !data)
    return (
      <section className="panel home-dashboard-loading">
        <DuckLoading text="กำลังเปิดสมุดตามวันที่เลือก…"/>
      </section>
    );
  if (!data)
    return (
      <section className="panel home-dashboard-loading" role="alert">
        <DuckLoading failed text={error} onRetry={()=>void load()}/>
      </section>
    );
  const amount = (value: string) => (hidden ? "••••" : baht(homeMoney(value)));
  const percent = homeMoney(dailyTarget) > 0 ? gaugePercent(data.daily.expenses, dailyTarget) : 0;
  const budgetTotal = homeMoney(data.cycle.budget_total);
  const budgetSpent = homeMoney(data.cycle.budget_spent);
  const week = data.weekly.days.map((d, i) => ({
    name: ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."][i],
    current: homeMoney(d.current),
    previous: homeMoney(d.previous),
  }));
  const year = data.yearly.map((d) => ({
    name: monthName(d.month),
    income: homeMoney(d.income),
    expenses: homeMoney(d.expenses),
    savings: homeMoney(d.savings),
  }));
  return (
    <div className="home-period-dashboard" data-testid="home-period-dashboard">
      {calendar&&<DuckCalendar date={date} today={today} revision={revision} onSelect={setDate} onClose={()=>setCalendar(false)}/>}
      <header className="home-garden-header">
        <div className="home-wordmark"><h1>MONEYSPACE</h1><p>Little duck, little steps <span>♥</span></p></div>
        <img className="home-painted-header" src={gardenHeader} alt="น้องเป็ดหูกระต่ายเกาะขอบสมุดกับสวนดอกไม้"/>
      </header>
      <div className="home-overview-sheet">
      <section className="home-date-toolbar panel">
        <div>
          <div className="home-date-controls">
            <button aria-label="วันก่อน" onClick={() => shiftDay(-1)}>
              <ChevronLeft size={18} />
            </button>
            <label>
              <CalendarDays size={17} />
              <input
                aria-label="วันที่ของภาพรวม"
                tabIndex={-1}
                type="date"
                min="2000-01-01"
                max={today}
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
              />
              <button className="duck-date-open" type="button" aria-label="เปิดปฏิทิน" onClick={e=>{e.preventDefault();setCalendar(true)}}><strong>{fullDate(date)}</strong></button>
            </label>
            <button
              aria-label="วันถัดไป"
              disabled={date >= today}
              onClick={() => shiftDay(1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <details className="cycle-setting">
          <summary><Settings2 size={14} /> รอบเดือน</summary>
          <label>
            เริ่มรอบเดือนวันที่{" "}
            <select
              aria-label="วันเริ่มรอบเดือน"
              value={data.cycle_day}
              disabled={saving}
              onChange={(e) => void saveCycle(Number(e.target.value))}
            >
              {Array.from({ length: 28 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>
        </details>
      </section>
      {error && (
        <div className="ledger-error" role="alert">
          {error}
        </div>
      )}
      <section className="home-balance-card">
        <div className="balance-card-heading">
          <span>รอบ {shortDate(data.cycle_from)}–{shortDate(data.cycle_through)}</span>
          <button
            aria-label={hidden ? "แสดงยอดสรุป" : "ซ่อนยอดสรุป"}
            onClick={onToggle}
          >
            {hidden ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        <div className="balance-primary">
          <span>ใช้ได้หลังหักออม</span>
          <strong data-testid="actual-spendable">
            {hidden ? "••••" : shortBaht(homeMoney(data.money.spendable))}
          </strong>
        </div>
        <div className="balance-parts">
          <span>
            เงินรวม
            <strong data-testid="actual-cash">{hidden ? "••••" : shortBaht(homeMoney(data.money.total))}</strong>
          </span>
          <span>
            รายรับรอบนี้
            <strong data-testid="actual-income">{hidden ? "••••" : shortBaht(homeMoney(data.cycle.income))}</strong>
          </span>
          <span>
            รายจ่ายรอบนี้
            <strong data-testid="actual-expenses">
              {hidden ? "••••" : shortBaht(homeMoney(data.cycle.expenses))}
            </strong>
          </span>
        </div>
        <small>
          ออมแล้ว {amount(data.money.savings)}
        </small>
      </section>
      <div
        className="home-range-tabs"
        role="tablist"
        aria-label="ช่วงเวลาของภาพรวม"
      >
        {ranges.map((r) => (
          <button
            key={r.id}
            role="tab"
            aria-selected={range === r.id}
            className={range === r.id ? "active" : ""}
            onClick={() => setRange(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>
      </div>
      {range === "day" && (
        <section className="panel home-range-panel garden-panel home-day-panel">
          <div
            className="home-subtabs"
            role="tablist"
            aria-label="ข้อมูลรายวัน"
          >
            {dayTabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={dayTab === t.id}
                className={dayTab === t.id ? "active" : ""}
                onClick={() => setDayTab(t.id)}
              >
                {t.id === "meter" ? <CalendarDays size={16} aria-hidden="true"/> : t.id === "pie" ? <ChartPie size={16} aria-hidden="true"/> : <ListFilter size={16} aria-hidden="true"/>}
                {t.label}
              </button>
            ))}
          </div>
          {dayTab === "meter" && (
            <div className="daily-meter-layout">
              <div
                className="daily-gauge"
                role="meter"
                aria-label="สัดส่วนเป้าหมายรายวัน"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(percent)}
              >
                <div className="gauge-chart">

                  <svg className="daily-meter-svg" viewBox="0 0 300 250" aria-hidden="true">
                    {Array.from({ length: 49 }, (_, i) => <line key={i} x1={i % 4 === 0 ? 252 : 258} y1="130" x2="270" y2="130" transform={`rotate(${150 + i * 5} 150 130)`} stroke={homeMoney(dailyTarget) > 0 && i <= percent * .48 ? "#e8bf60" : "var(--meter-track)"} strokeWidth={i % 4 === 0 ? 3 : 2} strokeLinecap="round" />)}
                    <g className="duck-meter-pointer" style={{transform:`translate(${150+Math.cos((150+percent*2.4)*Math.PI/180)*120}px, ${130+Math.sin((150+percent*2.4)*Math.PI/180)*120}px) rotate(${percent*.6-30}deg)`}}><foreignObject x="-21" y="-24" width="42" height="43"><DuckMascot pose="meter" className="painted-gauge-duck"/></foreignObject></g>
                  </svg>
                  <div className="gauge-garden painted-gauge-garden" aria-hidden="true"><GardenDoodle kind="flower"/><GardenDoodle kind="sprout"/><GardenDoodle kind="flower"/></div>
                  <div className="gauge-value">
                    <span>ใช้วันนี้</span>
                    <strong>{amount(data.daily.expenses)}</strong>
                    <small>{homeMoney(dailyTarget) > 0 ? `${Math.round(percent)}% ของเป้า` : "ตั้งเป้ารายวันของคุณ"}</small>
                  </div>
                </div>
                <form className="daily-target-form" onSubmit={e => void saveDailyTarget(e)}>
                  <label>เป้า / วัน <input aria-label="เป้ารายวัน (บาท)" inputMode="decimal" value={targetDraft} onChange={e => setTargetDraft(e.target.value)} disabled={savingTarget} /></label>
                  <Button type="submit" disabled={savingTarget}>{savingTarget ? "กำลังบันทึก…" : "ตั้งเป้า"}</Button>
                </form>
                {targetError && <small role="alert" className="form-error">{targetError}</small>}

              </div>
              <div className="daily-activity">
                <div className="section-heading">
                  <div>
                    <h2>{date === today ? "วันนี้" : shortDate(date)}</h2>
                    <p>{data.daily.transactions.length} รายการ</p>
                  </div>
                </div>
                {data.daily.transactions.length ? (
                  <div className="home-day-list">
                    {data.daily.transactions.map((t) => (
                      <button key={t.id} type="button" className="home-day-transaction"
                        disabled={opening !== null}
                        aria-busy={opening === t.id}
                        aria-label={`ดูและแก้ไข ${t.merchant}`}
                        onClick={() => void openTransaction(t.id)}>
                        <span
                          className={
                            t.kind === "income" || t.kind === "refund"
                              ? "mint"
                              : "orange"
                          }
                        >
                          {t.kind === "income" || t.kind === "refund" ? (
                            <ArrowDownLeft size={16} />
                          ) : (
                            <ArrowUpRight size={16} />
                          )}
                        </span>
                        <span>
                          <strong>
                            <CategoryArtwork icon={t.kind === "income" ? null : t.icon} name={t.category}/>{t.merchant}
                          </strong>
                          <small>{t.category}</small>
                        </span>
                        <b>
                          {t.kind === "expense" ? "-" : "+"}
                          {amount(t.amount)}
                        </b>
                        <ChevronRight size={16} aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="home-empty"><span className="duck-resting"><DuckMascot pose="rest" className="empty-duck"/><i>z z</i></span><strong>ยังไม่มีรายการในวันที่เลือก</strong><small>พร้อมเมื่อไหร่ ค่อยจดกัน · แตะ + เพื่อเริ่ม</small></div>
                )}
              </div>
            </div>
          )}
          {dayTab === "pie" && (
            <div className="daily-chart-layout">
              {data.daily.categories.length ? (
                <>
                  <div className="home-pie">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.daily.categories.map((c) => ({
                            ...c,
                            value: Math.max(0, homeMoney(c.amount)),
                          }))}
                          dataKey="value"
                          nameKey="name"
                          innerRadius="52%"
                          outerRadius="86%"
                          paddingAngle={3}
                          stroke="none"
                        >
                          {data.daily.categories.map((_, i) => (
                            <Cell key={i} fill={colors[i % colors.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={money} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div>
                      <strong>{amount(data.daily.expenses)}</strong>
                      <small>รายจ่ายสุทธิ</small>
                    </div>
                  </div>
                  <div className="home-chart-legend">
                    {data.daily.categories.map((c, i) => (
                      <div key={c.name}>
                        <i style={{ background: colors[i % colors.length] }} />
                        <span>
                          <CategoryArtwork icon={c.icon} name={c.name}/>{c.name}
                        </span>
                        <strong>{amount(c.amount)}</strong>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="home-empty wide">
                  ยังไม่มีรายจ่ายสำหรับวาดกราฟในวันที่เลือก
                </div>
              )}
            </div>
          )}
          {dayTab === "types" && (
            <div className="daily-types">
              {data.daily.types.length ? (
                data.daily.types.map((t, i) => (
                  <div key={t.type + t.name}>
                    <i
                      style={{
                        background:
                          t.type === "income"
                            ? "#7c9570"
                            : colors[(i + 2) % colors.length],
                      }}
                    />
                    <span>
                      <small>
                        {t.type === "income" ? "รายได้" : "รายจ่าย"}
                      </small>
                      <strong>{t.name}</strong>
                    </span>
                    <b className={t.type === "income" ? "mint-text" : ""}>
                      {t.type === "expense" ? "-" : "+"}
                      {amount(t.amount)}
                    </b>
                  </div>
                ))
              ) : (
                <div className="home-empty wide">
                  ยังไม่มีรายรับหรือรายจ่ายในวันที่เลือก
                </div>
              )}
            </div>
          )}
        </section>
      )}
      {range === "week" && (
        <section className="panel home-range-panel">
          <div className="section-heading">
            <div>
              <h2>สัปดาห์นี้เทียบสัปดาห์ก่อน</h2>
              <p>
                อาทิตย์–เสาร์ · {shortDate(data.weekly.from)}–
                {shortDate(data.weekly.through)}
              </p>
            </div>
          </div>
          <div className="home-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={week} barGap={3}>
                <CartesianGrid strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => `${Math.round(v / 100)}`} />
                <Tooltip formatter={money} />
                <Legend />
                <Bar
                  name="สัปดาห์ก่อน"
                  dataKey="previous"
                  fill="#9aa8b2"
                  radius={[5, 5, 0, 0]}
                />
                <Bar
                  name="สัปดาห์นี้"
                  dataKey="current"
                  fill="#7c9570"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
      {range === "month" && (
        <section className="panel home-range-panel">
          <div className="month-cycle-head">
            <div>
              <span>
                รายได้ในรอบ<strong>{hidden ? "••••" : shortBaht(homeMoney(data.cycle.income))}</strong>
              </span>
              <span>
                รายจ่ายในรอบ<strong>{hidden ? "••••" : shortBaht(homeMoney(data.cycle.expenses))}</strong>
              </span>
            </div>
            <div className="month-budget-meter">
              <span>
                ใช้ไป{" "}
                {budgetTotal > 0
                  ? Math.round((budgetSpent / budgetTotal) * 100)
                  : 0}
                % ของงบรวม
              </span>
              <strong>
                {amount(data.cycle.budget_spent)} /{" "}
                {amount(data.cycle.budget_total)}
              </strong>
              <div>
                <i
                  style={{
                    width: `${Math.min(100, budgetTotal > 0 ? (budgetSpent / budgetTotal) * 100 : 0)}%`,
                  }}
                />
              </div>
            </div>
          </div>
          <div className="home-budget-list">{data.monthly.budgets.map(b=><BudgetTile key={b.id} name={b.name} icon={b.icon} target={b.target} spent={b.spent} remaining={b.remaining} hidden={hidden}/>)}</div>
        </section>
      )}
      {range === "year" && (
        <section className="home-year-grid">
          <article className="panel">
            <div className="section-heading">
              <div>
                <h2>รายรับ–รายจ่ายแต่ละเดือน</h2>
                <p>อิงวันเริ่มรอบเดือนที่ตั้งไว้</p>
              </div>
            </div>
            <div className="home-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={year}>
                  <CartesianGrid strokeDasharray="3 5" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(v) => `${Math.round(v / 100)}`} />
                  <Tooltip formatter={money} />
                  <Legend />
                  <Bar
                    name="รายรับ"
                    dataKey="income"
                    fill="#7c9570"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    name="รายจ่าย"
                    dataKey="expenses"
                    fill="#e987a0"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>
          <article className="panel">
            <div className="section-heading">
              <div>
                <h2>การเติบโตของเงินเก็บ</h2>
                <p>ยอดแยกออมสะสม ณ สิ้นแต่ละรอบ</p>
              </div>
            </div>
            <div className="home-chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={year}>
                  <CartesianGrid strokeDasharray="3 5" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(v) => `${Math.round(v / 100)}`} />
                  <Tooltip formatter={money} />
                  <Line
                    name="เงินเก็บ"
                    dataKey="savings"
                    stroke="#9b8aba"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>
        </section>
      )}
    </div>
  );
}
