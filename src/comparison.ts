import { decimalSatang } from "./ledger";
export interface ComparisonDay {
  date: string;
  net: string;
  food: string;
  drink: string;
  count: number;
  food_count: number;
  drink_count: number;
  refund_count: number;
}
export interface ComparisonPerson {
  key: "tape" | "pat";
  name: string;
  daily: ComparisonDay[];
  recent_daily?: { date: string; net: string; count: number }[];
  categories?: {
    name: string;
    icon: string;
    net: string;
    gross: string;
    refund: string;
    count: number;
  }[];
  total_money?: string;
}
export interface ComparisonData {
  status: "unavailable" | "waiting" | "ready";
  mine_enabled?: boolean;
  peer_enabled?: boolean;
  version?: string;
  details_mine_enabled?: boolean;
  details_peer_enabled?: boolean;
  details_ready?: boolean;
  recent_from?: string;
  recent_through?: string;
  money_as_of?: string;
  month?: string;
  through?: string;
  people?: ComparisonPerson[];
}
export type ComparisonMetric = "net" | "food" | "drink";
function add(a: number, b: number) {
  const n = a + b;
  if (!Number.isSafeInteger(n)) throw Error("ยอดสูงเกินช่วงแสดงผลอย่างแม่นยำ");
  return n;
}
export function comparisonSeries(
  data: ComparisonData,
  metric: ComparisonMetric,
) {
  const tape = data.people?.find((p) => p.key === "tape")?.daily || [];
  const pat = data.people?.find((p) => p.key === "pat")?.daily || [];
  if (data.people?.length !== 2 || tape.length !== pat.length || !tape.length)
    throw Error("ข้อมูลเปรียบเทียบไม่ครบ");
  let tapeRunning = 0,
    patRunning = 0;
  const daily = tape.map((d, i) => {
    const peer = pat[i];
    if (!peer || peer.date !== d.date)
      throw Error("ช่วงวันที่เปรียบเทียบไม่ตรงกัน");
    const a = decimalSatang(d[metric]),
      b = decimalSatang(peer[metric]);
    tapeRunning = add(tapeRunning, a);
    patRunning = add(patRunning, b);
    return {
      date: d.date,
      label: String(Number(d.date.slice(8))),
      tape: a,
      pat: b,
      tapeRunning,
      patRunning,
    };
  });
  const weeks = new Map<
    string,
    { date: string; label: string; tape: number; pat: number; days: number }
  >();
  for (const d of daily) {
    const date = new Date(d.date + "T12:00:00Z");
    const weekday = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - weekday);
    const key = date.toISOString().slice(0, 10);
    const w = weeks.get(key) || {
      date: key,
      label: `${Number(d.date.slice(8))}`,
      tape: 0,
      pat: 0,
      days: 0,
    };
    w.tape = add(w.tape, d.tape);
    w.pat = add(w.pat, d.pat);
    w.days++;
    w.label = w.label.split("–")[0] + "–" + Number(d.date.slice(8));
    weeks.set(key, w);
  }
  const countKey =
    metric === "net"
      ? "count"
      : metric === "food"
        ? "food_count"
        : "drink_count";
  const summaries = (data.people || []).map((p) => {
    const total = p.daily.reduce((s, d) => add(s, decimalSatang(d[metric])), 0);
    const spendingDays = p.daily.filter((d) => d[countKey] > 0).length;
    const recordedDays = p.daily.filter(
      (d) => d.count > 0 || d.refund_count > 0,
    ).length;
    return {
      key: p.key,
      name: p.name,
      total,
      spendingDays,
      recordedDays,
      count: p.daily.reduce((s, d) => s + d[countKey], 0),
      calendarAverage: p.daily.length ? Math.round(total / p.daily.length) : 0,
      spendingAverage: spendingDays ? Math.round(total / spendingDays) : null,
    };
  });
  const breakdown = (data.people || []).map((p) => {
    const sum = (key: ComparisonMetric) =>
      p.daily.reduce((s, d) => add(s, decimalSatang(d[key])), 0);
    return {
      name: p.name,
      food: sum("food"),
      drink: sum("drink"),
      other: add(add(sum("net"), -sum("food")), -sum("drink")),
    };
  });
  return { daily, weekly: [...weeks.values()], summaries, breakdown };
}

export function detailedComparison(data: ComparisonData) {
  const people = data.people || [];
  if (people.length !== 2) throw Error("ข้อมูลไม่ครบ");
  const tape = people.find((p) => p.key === "tape")!,
    pat = people.find((p) => p.key === "pat")!;
  const recent = tape.recent_daily || [];
  const peerRecent = pat.recent_daily || [];
  if (recent.length !== 7 || peerRecent.length !== 7)
    throw Error("ข้อมูล 7 วันไม่ครบ");
  const recentRows = recent.map((d, i) => {
    if (d.date !== peerRecent[i].date) throw Error("วันที่ไม่ตรงกัน");
    return {
      date: d.date,
      label: `${Number(d.date.slice(8))}/${Number(d.date.slice(5, 7))}`,
      tape: decimalSatang(d.net),
      pat: decimalSatang(peerRecent[i].net),
    };
  });
  if (data.details_ready && people.some((p) => !Array.isArray(p.categories)))
    throw Error("ไม่พบข้อมูลหมวด");
  const categories = data.details_ready
    ? people.map((p) => ({
        key: p.key,
        name: p.name,
        rows: (p.categories || []).map((c, i) => ({
          ...c,
          key: String(i),
          value: decimalSatang(c.net),
          label: `${c.icon} ${c.name}`,
        })),
        total: (p.categories || []).reduce(
          (s, c) => add(s, decimalSatang(c.net)),
          0,
        ),
      }))
    : [];
  const wealth = data.details_ready
    ? people.map((p) => {
        if (p.total_money === undefined) throw Error("ไม่พบเงินรวม");
        return {
          key: p.key,
          name: p.name,
          value: decimalSatang(p.total_money),
        };
      })
    : [];
  const categoryDomain: [number, number] = [0, 0];
  for (const p of categories)
    for (const c of p.rows) {
      categoryDomain[0] = Math.min(categoryDomain[0], c.value);
      categoryDomain[1] = Math.max(categoryDomain[1], c.value);
    }
  if (categoryDomain[0] === categoryDomain[1]) categoryDomain[1] = 1;
  return {
    categoryDomain,
    recent: recentRows,
    recentTape: recentRows.reduce((s, d) => add(s, d.tape), 0),
    recentPat: recentRows.reduce((s, d) => add(s, d.pat), 0),
    categories,
    wealth,
  };
}
