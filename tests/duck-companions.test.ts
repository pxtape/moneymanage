import {describe,it,expect} from 'vitest';
import {duckMoment,readDailyActivity} from '../src/duck-companions';
import {weeklyCardSvg} from '../src/weekly';
describe('duck companion data',()=>{
 it('uses Bangkok time for morning, daytime and the night blanket',()=>{
  expect(duckMoment(new Date('2026-11-02T23:00:00Z'))).toBe('morning');
  expect(duckMoment(new Date('2026-11-02T06:00:00Z'))).toBe('day');
  expect(duckMoment(new Date('2026-11-02T15:00:00Z'))).toBe('night');
 });
 it('rejects malformed or duplicate activity instead of inventing empty days',()=>{
  expect(()=>readDailyActivity([{date:'2026-11-02',count:1,expenses:'oops',income:'0'}])).toThrow();
  const day={date:'2026-11-02',count:1,expenses:'-5.00',income:'0'};
  expect(readDailyActivity([day])).toEqual([day]);
  expect(()=>readDailyActivity([day,day])).toThrow();
 });
 it('keeps postcard amounts private until explicitly revealed',()=>{
  const data={start:'2026-11-02',through:'2026-11-02',income:'1234.56',expenses:'57.89',savings_change:'100',expense_count:1,recorded_days:1};
  const daily=[{date:'2026-11-02',count:1,expenses:'57.89',income:'1234.56'}];
  const hidden=weeklyCardSvg(data,false,'<Tape>',daily);
  expect(hidden).not.toContain('1,234.56');expect(hidden).not.toContain('57.89');expect(hidden).toContain('&lt;Tape&gt;');
  expect(weeklyCardSvg(data,true,'Tape',daily)).toContain('1,234.56');
 });
});
