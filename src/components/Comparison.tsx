import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
  detailedComparison,
  type ComparisonData,
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
    [busy, setBusy] = useState(false);
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
  async function consent(details = false) {
    if (!data || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const { data: result, error } = await supabase.rpc(
        details
          ? "moneyspace_comparison_details"
          : "moneyspace_comparison_consent",
        {
          p_enabled: details ? !data.details_mine_enabled : !data.mine_enabled,
          p_version: data.version,
        },
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
      return {
        value: {
          monthly: comparisonSeries(data, "net"),
          ...detailedComparison(data),
        },
        error: "",
      };
    } catch {
      return {
        value: null,
        error: "ยอดหรือช่วงวันที่เกินขอบเขตการแสดงอย่างแม่นยำ กรุณาโหลดใหม่",
      };
    }
  }, [data]);
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
    <div className="comparison-space four-chart-comparison">
      <div className="comparison-intro panel">
        <div>
          <h2>
            <ChartNoAxesCombined size={24} /> จังหวะการใช้เงินของเราสองคน
          </h2>
          <p>เทียบจากที่จดจริง หมวดของเราไม่จำเป็นต้องเหมือนกัน</p>
        </div>
        <div className="comparison-legend">
          <span style={{ color: colors.tape }}>● Tape</span>
          <span style={{ color: colors.pat }}>● Pat</span>
        </div>
      </div>
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
                ไม่แชร์ชื่อร้าน หมายเหตุ หรือรายการส่วนตัว
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
                <section
                  className="panel comparison-chart-panel"
                  data-testid="comparison-recent"
                >
                  <div className="section-heading">
                    <div>
                      <span className="comparison-order">01 · RECENT DAYS</span>
                      <h2>รายจ่าย 7 วันที่ผ่านมา</h2>
                      <p>
                        {data.recent_from} ถึง {data.recent_through} · รวมวันนี้
                        ไม่ขึ้นกับเดือนที่เลือก
                      </p>
                    </div>
                  </div>
                  <div
                    className="comparison-chart"
                    role="img"
                    aria-label="กราฟรายจ่าย 7 วันล่าสุด Tape และ Pat"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={result.recent}>
                        <CartesianGrid
                          stroke="var(--border)"
                          vertical={false}
                          strokeDasharray="3 5"
                        />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: "var(--muted)", fontSize: 11 }}
                        />
                        <YAxis tickFormatter={axisMoney} width={65} />
                        <Tooltip
                          {...tooltip}
                          labelFormatter={(v) => `วันที่ ${v}`}
                        />
                        <Legend />
                        <Bar
                          name="Tape"
                          dataKey="tape"
                          fill={colors.tape}
                          radius={[4, 4, 0, 0]}
                          isAnimationActive={false}
                        />
                        <Bar
                          name="Pat"
                          dataKey="pat"
                          fill={colors.pat}
                          radius={[4, 4, 0, 0]}
                          isAnimationActive={false}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="comparison-inline-totals">
                    <span>
                      Tape <strong>{baht(result.recentTape)}</strong>
                    </span>
                    <span>
                      Pat <strong>{baht(result.recentPat)}</strong>
                    </span>
                  </div>
                  <p className="analytics-note">
                    บาท · หักเงินคืนตามวันที่ได้รับ
                    วันที่ไม่มีรายการไม่ได้ยืนยันว่าไม่ได้ใช้เงิน
                  </p>
                </section>
                <section
                  className="panel comparison-chart-panel"
                  data-testid="comparison-month"
                >
                  <div className="section-heading">
                    <div>
                      <span className="comparison-order">
                        02 · MONTH TO DATE
                      </span>
                      <h2>รายจ่ายสะสมทั้งเดือน</h2>
                      <p>
                        {data.month} ถึง {data.through} · สองเส้นในกราฟเดียวกัน
                      </p>
                    </div>
                  </div>
                  <div
                    className="comparison-chart"
                    role="img"
                    aria-label="กราฟเส้นรายจ่ายสะสมทั้งเดือน Tape และ Pat"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={result.monthly.daily}>
                        <CartesianGrid
                          stroke="var(--border)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: "var(--muted)", fontSize: 11 }}
                        />
                        <YAxis tickFormatter={axisMoney} width={65} />
                        <Tooltip
                          {...tooltip}
                          labelFormatter={(v) => `วันที่ ${v}`}
                        />
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
                  <div className="comparison-inline-totals">
                    {result.monthly.summaries.map((p) => (
                      <span key={p.key}>
                        {p.name} <strong>{baht(p.total)}</strong>
                      </span>
                    ))}
                  </div>
                  <p className="analytics-note">
                    หักเงินคืนแล้ว จึงอาจลดลงบางวัน · ไม่รวมโอนเงิน ตั้งงบ
                    หรือกันออม
                  </p>
                </section>
                <section
                  className="panel comparison-chart-panel"
                  data-testid="comparison-categories"
                >
                  <div className="section-heading">
                    <div>
                      <span className="comparison-order">
                        03 · YOUR OWN CATEGORIES
                      </span>
                      <h2>รายจ่ายสะสมแยกประเภท</h2>
                      <p>
                        เดือนที่เลือก · แสดงหมวดจริงของแต่ละคนข้างกัน
                        ไม่บังคับจับคู่หมวด · ใช้สเกลจำนวนเงินเดียวกัน
                      </p>
                    </div>
                  </div>
                  <p className="comparison-caveat">
                    ถ้าจดอาหารกับเครื่องดื่มรวมกัน กราฟจะแสดงตามหมวดที่จด
                    ไม่เดาแยกยอด · หมวดชื่อเดียวกันอาจมีขอบเขตต่างกัน
                  </p>
                  <div className="comparison-details-sharing">
                    <div>
                      <strong>
                        การแชร์เพิ่มเติม: ชื่อหมวดและยอดเงินรวมปัจจุบัน
                      </strong>
                      <p>
                        {data.details_mine_enabled
                          ? "คุณเปิดแชร์เพิ่มเติมแล้ว"
                          : "คุณยังไม่ได้เปิดแชร์เพิ่มเติม"}{" "}
                        ·{" "}
                        {data.details_peer_enabled
                          ? "อีกคนเปิดแล้ว"
                          : "รออีกคนเปิดด้วย"}{" "}
                        ไม่เปิดเผยชื่อร้านหรือหมายเหตุ
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => void consent(true)}
                    >
                      {busy
                        ? "กำลังรอยืนยัน…"
                        : data.details_mine_enabled
                          ? "หยุดแชร์หมวดและเงินรวม"
                          : "แชร์หมวดและเงินรวมของฉัน"}
                    </Button>
                  </div>
                  {data.details_ready ? (
                    <div className="comparison-own-categories">
                      {result.categories.map((p) => (
                        <article key={p.key}>
                          <div
                            className="comparison-person-title"
                            style={{ color: colors[p.key] }}
                          >
                            <h3>{p.name}</h3>
                            <strong>{baht(p.total)}</strong>
                          </div>
                          {p.rows.length ? (
                            <>
                              <div className="own-category-scroll">
                                <div
                                  style={{
                                    height: Math.max(
                                      220,
                                      p.rows.length * 45 + 35,
                                    ),
                                  }}
                                  role="img"
                                  aria-label={`กราฟรายจ่ายสะสมแยกหมวด ${p.name}`}
                                >
                                  <ResponsiveContainer
                                    width="100%"
                                    height="100%"
                                  >
                                    <BarChart
                                      data={p.rows}
                                      layout="vertical"
                                      margin={{ left: 0, right: 20 }}
                                    >
                                      <CartesianGrid
                                        stroke="var(--border)"
                                        horizontal={false}
                                      />
                                      <XAxis
                                        type="number"
                                        domain={result.categoryDomain}
                                        tickFormatter={axisMoney}
                                        tick={{ fontSize: 10 }}
                                      />
                                      <YAxis
                                        type="category"
                                        dataKey="label"
                                        width={120}
                                        tick={{
                                          fontSize: 11,
                                          fill: "var(--text)",
                                        }}
                                        tickFormatter={(v) =>
                                          String(v).length > 21
                                            ? String(v).slice(0, 21) + "…"
                                            : String(v)
                                        }
                                      />
                                      <Tooltip
                                        {...tooltip}
                                        labelFormatter={(_, payload) =>
                                          payload?.[0]?.payload?.label || ""
                                        }
                                      />
                                      <Bar
                                        name="สุทธิสะสม"
                                        dataKey="value"
                                        fill={colors[p.key]}
                                        radius={[0, 4, 4, 0]}
                                        isAnimationActive={false}
                                      />
                                    </BarChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>
                              <details className="comparison-category-values">
                                <summary>ดูชื่อหมวดเต็มและยอดสะสม</summary>
                                {p.rows.map((c) => (
                                  <div key={c.key}>
                                    <span>{c.label}</span>
                                    <strong>{baht(c.value)}</strong>
                                  </div>
                                ))}
                              </details>
                            </>
                          ) : (
                            <p className="analytics-note">
                              ยังไม่มีรายจ่ายที่จดในเดือนนี้
                            </p>
                          )}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="comparison-locked-note">
                      <LockKeyhole size={18} />
                      รอทั้งสองคนเปิดแชร์เพิ่มเติม จึงจะแสดงชื่อหมวดและยอดสะสม
                    </div>
                  )}
                </section>
                <section
                  className="panel comparison-chart-panel"
                  data-testid="comparison-wealth"
                >
                  <div className="section-heading">
                    <div>
                      <span className="comparison-order">04 · TOTAL MONEY</span>
                      <h2>ความมั่งคั่งสุทธิ · เงินรวมที่บันทึก</h2>
                      <p>
                        ยอดปัจจุบัน ณ {data.money_as_of} · รวมเงินที่กันออมแล้ว
                        ไม่ขึ้นกับเดือนที่เลือก
                      </p>
                    </div>
                  </div>
                  {data.details_ready ? (
                    <>
                      <div
                        className="comparison-chart"
                        role="img"
                        aria-label="กราฟแท่งเงินรวมปัจจุบันรวมเงินออม Tape และ Pat"
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={result.wealth} barSize={80}>
                            <CartesianGrid
                              stroke="var(--border)"
                              vertical={false}
                            />
                            <XAxis dataKey="name" />
                            <YAxis tickFormatter={axisMoney} width={70} />
                            <Tooltip {...tooltip} />
                            <Bar
                              name="เงินรวมรวมเงินออม"
                              dataKey="value"
                              radius={[7, 7, 0, 0]}
                              isAnimationActive={false}
                            >
                              {result.wealth.map((p) => (
                                <Cell key={p.key} fill={colors[p.key]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="comparison-inline-totals">
                        {result.wealth.map((p) => (
                          <span key={p.key}>
                            {p.name} <strong>{baht(p.value)}</strong>
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="comparison-locked-note">
                      <LockKeyhole size={18} />
                      รอเปิดแชร์หมวดและเงินรวมจากทั้งสองบัญชี
                    </div>
                  )}
                  <p className="analytics-note">
                    เงินออมที่กันไว้รวมอยู่ในเงินทั้งหมดแล้ว จึงไม่บวกซ้ำ ·
                    เป็นเงินตามบันทึกในแอป
                    ไม่ใช่สินทรัพย์สุทธิหลังหักหนี้หรือทรัพย์สินที่ไม่ได้จด
                  </p>
                </section>
                <details className="panel comparison-table">
                  <summary>ดูตัวเลขรายวันของเดือนที่เลือก</summary>
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
                        {result.monthly.daily.map((d) => (
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
