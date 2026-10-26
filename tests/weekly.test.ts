import {describe,it,expect} from 'vitest';
import {readWeekly,weekRange,weeklyCardSvg,type WeeklyData} from '../src/weekly';
const data:WeeklyData={start:'2026-10-19',through:'2026-10-25',income:'30000.25',expenses:'1200.50',savings_change:'-100.00',expense_count:120,recorded_days:5};
describe('weekly privacy and calendar',()=>{
 it('uses Monday weeks and clamps the current incomplete week',()=>{expect(weekRange('2026-10-26')).toEqual({start:'2026-10-26',through:'2026-10-26'});expect(weekRange('2026-10-26',-1)).toEqual({start:'2026-10-19',through:'2026-10-25'});expect(weekRange('2027-01-01')).toEqual({start:'2026-12-28',through:'2027-01-01'});expect(()=>weekRange('2026-10-26',1)).toThrow()});
 it('accepts refunds/net savings releases without treating them as errors',()=>{expect(readWeekly({...data,expenses:'-1200.50'}).expenses).toBe('-1200.50')});
 it('rejects unsafe amounts and impossible counts',()=>{expect(()=>readWeekly({...data,income:'90071992547409.92'})).toThrow();expect(()=>readWeekly({...data,recorded_days:8})).toThrow();expect(()=>readWeekly({...data,through:'2026-10-28'})).toThrow()});
 it('omits all money entirely by default, including hidden metadata',()=>{const svg=weeklyCardSvg(data);expect(svg).toContain('ซ่อนยอดเงิน');expect(svg).not.toContain('30,000.25');expect(svg).not.toContain('1,200.50');expect(svg).not.toContain('100.00');expect(svg).toContain('120 รายการจ่าย')});
 it('escapes profile text and includes money only with explicit opt-in',()=>{const svg=weeklyCardSvg(data,true,'<script>bad</script>');expect(svg).not.toContain('<script>');expect(svg).toContain('&lt;script&gt;');expect(svg).toContain('30,000.25');expect(svg).toContain('1,200.50');expect(svg).toContain('ไม่ใช่สลิปโอนเงิน')});
});
