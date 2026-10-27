import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartNoAxesCombined, LockKeyhole, RefreshCw } from "lucide-react";
import { supabase } from "../supabase";
import {
  comparisonSeries,
  type ComparisonData,
  type ComparisonMetric,
} from "../comparison";
import { baht } from "../finance";
import { financialError } from "../ledger";
import { Button } from "./ui/button";
const colors = { tape: "#2978c5", pat: "#cc4e8c" };
const money = (v: unknown) => baht(Number(v));
const axisMoney = (value: number) =>
  new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(
    value / 100,
  );
export default function Comparison({
  month,
  revision,
}: {
  month: string;
  revision: unknown;
}) {
  const [data, setData] = useState<ComparisonData | null>(null),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0),
    [busy, setBusy] = useState(false),
    [metric, setMetric] = useState<ComparisonMetric>("net");
  const saving = useRef(false);
  useEffect(() => {
    let live = true;
    let sequence = 0;
    setData(null);
    setError("");
    async function load() {
      const request = ++sequence;
      try {
        const { data, error } = await supabase.rpc("moneyspace_comparison", {
          p_month: month,
        });
        if (!live || request !== sequence) return;
        if (error || !data)
          throw Error("โหลดกราฟเปรียบเทียบไม่สำเร็จ กรุณาลองใหม่");
        setData(data);
        setError("");
      } catch (e) {
        if (live && request === sequence) {
          setData(null);
          setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
        }
      }
    }
    void load();
    const onFocus = () => void load();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 30000);
    window.addEventListener("focus", onFocus);
    return () => {
      live = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [month, revision, reload]);
  async function consent() {
    if (!data || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const { data: result, error } = await supabase.rpc(
        "moneyspace_comparison_consent",
        { p_enabled: !data.mine_enabled, p_version: data.version },
      );
      if (error) throw Error(financialError(error));
      if (!result?.confirmed) throw Error("ยังไม่ได้รับการยืนยันจาก Supabase");
      setData(null);
      setReload((n) => n + 1);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "ยังไม่ได้ยืนยันการแชร์");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  const calculated = useMemo(() => {
    if (data?.status !== "ready") return null;
    try {
      return { value: comparisonSeries(data, metric), error: "" };
    } catch {
      return {
        value: null,
        error: "ยอดหรือช่วงวันที่เกินขอบเขตการแสดงอย่างแม่นยำ กรุณาโหลดใหม่",
      };
    }
  }, [data, metric]);
  const result = calculated?.value;
  const tooltip = {
    contentStyle: {
      background: "var(--panel)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      color: "var(--text)",
    },
    labelStyle: { color: "var(--text)" },
    formatter: money,
  };
  return (
    <div className="comparison-space">
      <section className="comparison-intro panel">
        <div>
          <span className="eyebrow">TWO PERSPECTIVES, ONE BETTER HABIT</span>
          <h2>
            <ChartNoAxesCombined size={24} /> จังหวะการใช้เงินของเราสองคน
          </h2>
          <p>เทียบเพื่อเข้าใจและช่วยกันปรับ ไม่ตัดสินว่าใครเก่งกว่า</p>
        </div>
        <div className="comparison-legend">
          <span style={{ color: colors.tape }}>● Tape</span>
          <span style={{ color: colors.pat }}>● Pat</span>
        </div>
      </section>
      {error || calculated?.error ? (
        <section className="panel" role="alert">
          <p>{error || calculated?.error}</p>
          <Button variant="outline" onClick={() => setReload((n) => n + 1)}>
            <RefreshCw size={16} />
            โหลดเปรียบเทียบใหม่
          </Button>
        </section>
      ) : !data ? (
        <section className="panel" role="status">
          กำลังโหลดข้อมูลสรุปที่ได้รับอนุญาต…
        </section>
      ) : data.status === "unavailable" ? (
        <section className="panel">
          <h2>ยังไม่ได้เชื่อมคู่เปรียบเทียบ</h2>
          <p>
            หน้านี้ใช้ได้เฉพาะคู่บัญชีที่ผู้ดูแลตั้งไว้
            ไม่เปิดค้นหาข้อมูลผู้ใช้อื่น
          </p>
        </section>
      ) : (
        <>
          <section
            className={`comparison-consent panel ${data.status === "ready" ? "ready-consent" : ""}`}
          >
            <div>
              <h3>
                <LockKeyhole size={17} /> แชร์เฉพาะข้อมูลสรุป
              </h3>
              <p>
                รายจ่ายสุทธิรายวัน ค่ากิน เครื่องดื่ม และจำนวนรายการเท่านั้น
                ไม่แชร์ชื่อร้าน หมายเหตุ รายรับ เงินรวม หรือเงินออม
              </p>
              <small>
                {data.mine_enabled ? "คุณเปิดแชร์แล้ว" : "คุณยังไม่ได้เปิดแชร์"}{" "}
                ·{" "}
                {data.peer_enabled
                  ? "อีกคนเปิดแชร์แล้ว"
                  : "รออีกคนเปิดแชร์จากบัญชีของตนเอง"}
              </small>
            </div>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void consent()}
            >
              {busy
                ? "กำลังรอยืนยัน…"
                : data.mine_enabled
                  ? "หยุดแชร์ของฉัน"
                  : "เปิดแชร์ยอดสรุปของฉัน"}
            </Button>
          </section>
          {data.status !== "ready" ? (
            <section className="comparison-wait panel">
              <LockKeyhole size={30} />
              <h2>กราฟพร้อมเมื่อเราสองคนเปิดแชร์</h2>
              <p>แต่ละคนควบคุมการแชร์ของตนเอง หยุดได้ทุกเมื่อ</p>
              <Button variant="outline" onClick={() => setReload((n) => n + 1)}>
                ตรวจสถานะอีกครั้ง
              </Button>
            </section>
          ) : (
            result && (
              <>
                <div className="comparison-toolbar">
                  <div role="group" aria-label="ข้อมูลที่เปรียบเทียบ">
                    {(
                      [
                        { id: "net", label: "รายจ่ายทั้งหมด" },
                        { id: "food", label: "ค่ากิน" },
                        { id: "drink", label: "เครื่องดื่ม" },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.id}
                        aria-pressed={metric === m.id}
                        onClick={() => setMetric(m.id)}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <small>
                    ช่วงเดียวกัน {data.month} ถึง {data.through} · บาท
                  </small>
                </div>
                <p className="comparison-caveat">
                  ยอดจากที่จดเท่านั้น ·
                  วันที่ไม่มีรายการไม่ได้ยืนยันว่าไม่ใช้เงิน ·
                  เงินคืนหักในวันที่ได้รับ จึงอาจติดลบ · ไม่รวมโอนเงิน ตั้งงบ
                  หรือกันออม
                </p>
                <section className="panel comparison-chart-panel">
                  <div className="section-heading">
                    <div>
                      <h2>วันไหน ใช้เท่าไหร่</h2>
                      <p>วางยอดรายวันเคียงกัน เห็นวันที่ใช้มากได้ทันที</p>
                    </div>
                  </div>
                  <div
                    className="comparison-chart"
                    role="img"
                    aria-label="กราฟเปรียบเทียบรายจ่ายรายวัน Tape และ Pat"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={result.daily}>
                        <CartesianGrid
                          stroke="var(--border)"
                          vertical={false}
                          strokeDasharray="3 5"
                        />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: "var(--muted)", fontSize: 11 }}
                        />
                        <YAxis
                          tickFormatter={axisMoney}
                          width={65}
                          tick={{ fill: "var(--muted)", fontSize: 11 }}
                        />
                        <Tooltip
                          {...tooltip}
                          labelFormatter={(v) => `วันที่ ${v}`}
                        />
                        <Legend />
                        <Bar
                          name="Tape"
                          dataKey="tape"
                          fill={colors.tape}
                          radius={[3, 3, 0, 0]}
                          isAnimationActive={false}
                        />
                        <Bar
                          name="Pat"
                          dataKey="pat"
                          fill={colors.pat}
                          radius={[3, 3, 0, 0]}
                          isAnimationActive={false}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
                <section className="comparison-summary">
                  {result.summaries.map((p) => (
                    <article
                      className="panel"
                      key={p.key}
                      style={
                        {
                          "--person-color": colors[p.key],
                        } as React.CSSProperties
                      }
                    >
                      <span className="comparison-person">● {p.name}</span>
                      <strong>{baht(p.total)}</strong>
                      <div>
                        <span>
                          เฉลี่ย / วันปฏิทิน
                          <strong>{baht(p.calendarAverage)}</strong>
                        </span>
                        <span>
                          วันที่มีรายจ่าย<strong>{p.spendingDays} วัน</strong>
                        </span>
                        <span>
                          จำนวนรายจ่าย<strong>{p.count} ครั้ง</strong>
                        </span>
                      </div>
                      <small>
                        จาก {result.daily.length} วัน · เฉพาะวันที่มีรายจ่าย{" "}
                        {p.spendingAverage === null
                          ? "—"
                          : baht(p.spendingAverage)}{" "}
                        / วัน
                      </small>
                    </article>
                  ))}
                </section>
                <div className="comparison-chart-grid">
                  <section className="panel">
                    <h2>จังหวะรายสัปดาห์</h2>
                    <p className="analytics-note">
                      จันทร์–อาทิตย์ ·
                      สัปดาห์ต้น/ท้ายแสดงเฉพาะวันที่อยู่ในช่วงที่เลือก
                    </p>
                    <div
                      className="comparison-chart"
                      role="img"
                      aria-label="กราฟเปรียบเทียบรายจ่ายรายสัปดาห์"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={result.weekly}>
                          <CartesianGrid
                            stroke="var(--border)"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="label"
                            tick={{ fill: "var(--muted)", fontSize: 11 }}
                          />
                          <YAxis
                            tickFormatter={axisMoney}
                            width={65}
                            tick={{ fill: "var(--muted)", fontSize: 11 }}
                          />
                          <Tooltip
                            {...tooltip}
                            labelFormatter={(v) => `วันที่ ${v}`}
                          />
                          <Legend />
                          <Bar
                            name="Tape"
                            dataKey="tape"
                            fill={colors.tape}
                            radius={[5, 5, 0, 0]}
                            isAnimationActive={false}
                          />
                          <Bar
                            name="Pat"
                            dataKey="pat"
                            fill={colors.pat}
                            radius={[5, 5, 0, 0]}
                            isAnimationActive={false}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </section>
                  <section className="panel">
                    <h2>เส้นทางรายจ่ายสะสม</h2>
                    <p className="analytics-note">
                      ยอดสะสมตั้งแต่ต้นเดือน หักเงินคืนตามวันที่ได้รับ
                    </p>
                    <div
                      className="comparison-chart"
                      role="img"
                      aria-label="กราฟเส้นยอดรายจ่ายสะสม"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={result.daily}>
                          <CartesianGrid
                            stroke="var(--border)"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="label"
                            tick={{ fill: "var(--muted)", fontSize: 11 }}
                          />
                          <YAxis
                            tickFormatter={axisMoney}
                            width={65}
                            tick={{ fill: "var(--muted)", fontSize: 11 }}
                          />
                          <Tooltip {...tooltip} />
                          <Legend />
                          <Line
                            name="Tape"
                            dataKey="tapeRunning"
                            type="linear"
                            stroke={colors.tape}
                            strokeWidth={3}
                            dot={false}
                            isAnimationActive={false}
                          />
                          <Line
                            name="Pat"
                            dataKey="patRunning"
                            type="linear"
                            stroke={colors.pat}
                            strokeWidth={3}
                            dot={false}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </section>
                </div>
                <div className="comparison-chart-grid">
                  <section className="panel">
                    <h2>เงินไปกับอะไรบ้าง</h2>
                    <p className="analytics-note">
                      ค่ากิน เครื่องดื่ม และอื่น ๆ · ยอดสุทธิอาจติดลบจากเงินคืน
                    </p>
                    <div
                      className="comparison-chart"
                      role="img"
                      aria-label="กราฟแยกค่ากิน เครื่องดื่ม และรายจ่ายอื่น"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={result.breakdown}>
                          <CartesianGrid
                            stroke="var(--border)"
                            vertical={false}
                          />
                          <XAxis dataKey="name" />
                          <YAxis tickFormatter={axisMoney} width={65} />
                          <Tooltip {...tooltip} />
                          <Legend />
                          <Bar
                            name="ค่ากิน"
                            dataKey="food"
                            fill="#da9c32"
                            isAnimationActive={false}
                          />
                          <Bar
                            name="เครื่องดื่ม"
                            dataKey="drink"
                            fill="#9874c5"
                            isAnimationActive={false}
                          />
                          <Bar
                            name="อื่น ๆ"
                            dataKey="other"
                            fill="#4b9c91"
                            isAnimationActive={false}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </section>
                  <section className="panel">
                    <h2>ขึ้นลงในแต่ละวัน</h2>
                    <p className="analytics-note">
                      อีกมุมของยอดรายวัน ·
                      ใช้เส้นตรงเพื่อไม่สร้างยอดระหว่างวันที่ไม่มีจริง
                    </p>
                    <div
                      className="comparison-chart"
                      role="img"
                      aria-label="กราฟแนวโน้มรายจ่ายรายวัน"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={result.daily}>
                          <CartesianGrid
                            stroke="var(--border)"
                            vertical={false}
                          />
                          <XAxis dataKey="label" />
                          <YAxis tickFormatter={axisMoney} width={65} />
                          <Tooltip {...tooltip} />
                          <Legend />
                          <Area
                            name="Tape"
                            type="linear"
                            dataKey="tape"
                            stroke={colors.tape}
                            fill={colors.tape}
                            fillOpacity={0.12}
                            isAnimationActive={false}
                          />
                          <Area
                            name="Pat"
                            type="linear"
                            dataKey="pat"
                            stroke={colors.pat}
                            fill={colors.pat}
                            fillOpacity={0.1}
                            isAnimationActive={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </section>
                </div>
                <details className="panel comparison-table">
                  <summary>ดูตัวเลขประกอบกราฟ</summary>
                  <div className="analytics-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>วันที่</th>
                          <th>Tape</th>
                          <th>Pat</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.daily.map((d) => (
                          <tr key={d.date}>
                            <td>{d.date}</td>
                            <td>{baht(d.tape)}</td>
                            <td>{baht(d.pat)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </>
            )
          )}
        </>
      )}
    </div>
  );
}
