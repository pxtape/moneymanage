import { Check, Sun, Moon, Flower2 } from "lucide-react";
import { useTheme, type Theme } from "../theme";
const options: { id: Theme; label: string; note: string; icon: typeof Sun }[] =
  [
    {
      id: "light",
      label: "สว่าง",
      note: "สะอาด อ่านง่าย · ค่าเริ่มต้น",
      icon: Sun,
    },
    {
      id: "pink",
      label: "ชมพู",
      note: "หวานนิด ๆ จดเงินให้อารมณ์ดี",
      icon: Flower2,
    },
    { id: "dark", label: "เข้ม", note: "สบายตาในเวลากลางคืน", icon: Moon },
  ];
export function ThemePicker() {
  const { theme, setTheme, error } = useTheme();
  return (
    <section className="panel theme-picker">
      <div className="section-heading">
        <div>
          <h2>ธีมที่เป็นคุณ</h2>
          <p>เลือกโทนที่อยากเปิดใช้ทุกวัน · จำไว้บนเครื่องนี้</p>
        </div>
      </div>
      <div className="theme-options" role="group" aria-label="เลือกธีม">
        {options.map((o) => (
          <button
            key={o.id}
            data-theme-option={o.id}
            aria-pressed={theme === o.id}
            onClick={() => setTheme(o.id)}
          >
            <span className="theme-swatch">
              <o.icon size={22} />
              {theme === o.id && <Check size={15} />}
            </span>
            <strong>{o.label}</strong>
            <small>{o.note}</small>
          </button>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
