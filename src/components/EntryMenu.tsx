import { DuckMascot } from "./DuckMascot";
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Target, X } from 'lucide-react';
import type { LedgerGoal } from '../ledger';

export function EntryMenu({ open, onOpenChange, goals, onExpense, onIncome, onSavings }: {
  open: boolean; onOpenChange: (open: boolean) => void; goals: LedgerGoal[];
  onExpense: () => void; onIncome: () => void; onSavings: (goal?: LedgerGoal) => void;
}) {
  const [chooseGoal, setChooseGoal] = useState(false);
  function close() { onOpenChange(false); setChooseGoal(false); }
  function select(action: () => void) { close(); action(); }
  return <Dialog.Root open={open} onOpenChange={value => { onOpenChange(value); if (!value) setChooseGoal(false); }}><Dialog.Portal>
    <Dialog.Overlay className="dialog-overlay entry-menu-overlay" />
    <Dialog.Content className="entry-menu">
      <Dialog.Title>{chooseGoal ? 'กันออมให้เป้าหมายไหน' : 'จดอะไรดี'}</Dialog.Title>
      <Dialog.Description className="sr-only">เลือกบันทึกรายจ่าย รายได้ หรือกันออม</Dialog.Description>
      {chooseGoal ? <div className="entry-goals">{goals.map(goal => <button key={goal.id} onClick={() => select(() => onSavings(goal))}><Target size={20}/>{goal.name}</button>)}</div> :
      <div className="entry-menu-options">
        <button onClick={() => select(onExpense)}><span className="action-mint"><DuckMascot pose="journal"/></span>รายจ่าย</button>
        <button onClick={() => select(onIncome)}><span className="action-blue"><DuckMascot pose="wave"/></span>รายได้</button>
        <button onClick={() => goals.length > 1 ? setChooseGoal(true) : select(() => onSavings(goals[0]))}><span className="action-gold"><DuckMascot pose="save"/></span>กันออม</button>
      </div>}
      <button className="entry-menu-close" aria-label="ปิดเมนูเพิ่มรายการ" onClick={close}><X size={25}/></button>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
