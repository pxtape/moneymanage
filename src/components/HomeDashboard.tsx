import { useCallback, useEffect, useState } from "react";
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
  Settings2,
} from "lucide-react";
import { supabase } from "../supabase";
import { baht } from "../finance";
import { bangkokToday } from "../categories";
import {
  budgetPercent,
  gaugePercent,
  homeMoney,
  type HomeDashboardData,
  type HomeRange,
} from "../home-dashboard";
import { Button } from "./ui/button";

const colors = [
  "#58d9aa",
  "#799df3",
  "#f2b76d",
  "#e987a0",
  "#a987e8",
  "#70cbd1",
  "#f58a67",
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
  onExpense,
}: {
  revision: unknown;
  hidden: boolean;
  onToggle: () => void;
  onExpense: () => void;
}) {
  const today = bangkokToday();
  const [date, setDate] = useState(today);
  const [range, setRange] = useState<HomeRange>("day");
  const [dayTab, setDayTab] = useState<(typeof dayTabs)[number]["id"]>("meter");
  const [data, setData] = useState<HomeDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data: result, error } = await supabase.rpc("moneyspace_home", {
      p_date: date,
    });
    if (error || !result) {
      setError("โหลดภาพรวมตามวันที่เลือกไม่ได้ กรุณาลองใหม่");
      setLoading(false);
      return;
    }
    setData(result as HomeDashboardData);
    setLoading(false);
  }, [date]);
  useEffect(() => {
    void load();
  }, [load, revision]);
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
        กำลังคำนวณภาพรวมตามวันที่เลือก…
      </section>
    );
  if (!data)
    return (
      <section className="panel home-dashboard-loading" role="alert">
        {error}
        <button className="text-link" onClick={() => void load()}>
          ลองใหม่
        </button>
      </section>
    );
  const amount = (value: string) => (hidden ? "••••" : baht(homeMoney(value)));
  const percent = gaugePercent(data.daily.expenses, data.daily.target);
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
      <section className="home-date-toolbar panel">
        <div>
          <span className="eyebrow">ดูเงินในอดีตได้เป็นวัน</span>
          <div className="home-date-controls">
            <button aria-label="วันก่อน" onClick={() => shiftDay(-1)}>
              <ChevronLeft size={18} />
            </button>
            <label>
              <CalendarDays size={17} />
              <input
                aria-label="วันที่ของภาพรวม"
                type="date"
                min="2000-01-01"
                max={today}
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
              />
              <strong>{date === today ? "วันนี้" : fullDate(date)}</strong>
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
        <div className="cycle-setting">
          <Settings2 size={16} />
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
        </div>
      </section>
      {error && (
        <div className="ledger-error" role="alert">
          {error}
        </div>
      )}
      <section className="home-balance-card">
        <div className="balance-card-heading">
          <span>สถานะ ณ {fullDate(data.selected_date)}</span>
          <button
            aria-label={hidden ? "แสดงยอดสรุป" : "ซ่อนยอดสรุป"}
            onClick={onToggle}
          >
            {hidden ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        <div className="balance-primary">
          <span>เงินเหลือหลังแยกออม</span>
          <strong data-testid="actual-spendable">
            {amount(data.money.spendable)}
          </strong>
        </div>
        <div className="balance-parts">
          <span>
            เงินรวมทั้งหมด
            <strong data-testid="actual-cash">{amount(data.money.total)}</strong>
          </span>
          <span>
            แยกออมไว้<strong>{amount(data.money.savings)}</strong>
          </span>
          <span>
            รายได้สุทธิในรอบ
            <strong data-testid="actual-income">{amount(data.cycle.income)}</strong>
          </span>
          <span>
            รายจ่ายสุทธิในรอบ
            <strong data-testid="actual-expenses">
              {amount(data.cycle.expenses)}
            </strong>
          </span>
        </div>
        <small>
          รอบ {shortDate(data.cycle_from)}–{shortDate(data.cycle_through)} ·
          เงินรวมมีเงินออมอยู่แล้ว จึงไม่บวกซ้ำ
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
      {range === "day" && (
        <section className="panel home-range-panel">
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
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[{ v: percent }, { v: 100 - percent }]}
                        dataKey="v"
                        startAngle={210}
                        endAngle={-30}
                        innerRadius="76%"
                        outerRadius="96%"
                        stroke="none"
                        isAnimationActive
                      >
                        <Cell
                          fill={
                            percent > 100
                              ? "#eb657b"
                              : percent > 80
                                ? "#f2b76d"
                                : "#58d9aa"
                          }
                        />
                        <Cell fill="var(--track)" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div>
                    <span>ใช้วันนี้</span>
                    <strong>{amount(data.daily.expenses)}</strong>
                    <small>{Math.round(percent)}% ของเป้า</small>
                  </div>
                </div>
                <p>
                  เป้าหมาย <strong>{amount(data.daily.target)}</strong> / วัน
                </p>
                <small>คำนวณจากงบรวม ÷ จำนวนวันในรอบเดือน</small>
              </div>
              <div className="daily-activity">
                <div className="section-heading">
                  <div>
                    <h2>วันนี้จ่ายอะไรไปบ้าง</h2>
                    <p>{data.daily.transactions.length} รายการในวันที่เลือก</p>
                  </div>
                  <Button onClick={onExpense}>
                    <ArrowUpRight size={16} />
                    จดรายจ่าย
                  </Button>
                </div>
                {data.daily.transactions.length ? (
                  <div className="home-day-list">
                    {data.daily.transactions.map((t) => (
                      <div key={t.id}>
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
                            {t.icon} {t.merchant}
                          </strong>
                          <small>{t.category}</small>
                        </span>
                        <b>
                          {t.kind === "expense" ? "-" : "+"}
                          {amount(t.amount)}
                        </b>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="home-empty">ยังไม่มีรายการในวันที่เลือก</div>
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
                          {c.icon} {c.name}
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
                            ? "#58d9aa"
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
                  fill="#58d9aa"
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
                รายได้ในรอบ<strong>{amount(data.cycle.income)}</strong>
              </span>
              <span>
                รายจ่ายในรอบ<strong>{amount(data.cycle.expenses)}</strong>
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
          <div className="home-budget-list">
            {data.monthly.budgets.map((b) => {
              const pct = budgetPercent(b.spent, b.target);
              return (
                <article key={b.id}>
                  <div>
                    <span>
                      {b.icon} <strong>{b.name}</strong>
                    </span>
                    <b
                      className={
                        homeMoney(b.remaining) < 0 ? "overspent-label" : ""
                      }
                    >
                      {homeMoney(b.remaining) < 0 ? "เกิน" : "เหลือ"}{" "}
                      {amount(String(Math.abs(homeMoney(b.remaining)) / 100))}
                    </b>
                  </div>
                  <div className="pocket-track">
                    <i style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                  <small>
                    ใช้ {amount(b.spent)} จากงบ {amount(b.target)} ·{" "}
                    {pct.toFixed(0)}%
                  </small>
                </article>
              );
            })}
            {!data.monthly.budgets.length && (
              <div className="home-empty wide">ยังไม่มีก้อนงบสำหรับรอบนี้</div>
            )}
          </div>
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
                    fill="#58d9aa"
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
                    stroke="#799df3"
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
