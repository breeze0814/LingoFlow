import { useState } from 'react';

type InputDialogProps = {
  open: boolean;
  clearAfterSubmit: boolean;
  onCancel: () => void;
  onSubmit: (text: string) => Promise<void>;
};

export function InputDialog({ open, clearAfterSubmit, onCancel, onSubmit }: InputDialogProps) {
  const [text, setText] = useState('');
  if (!open) return null;

  async function handleSubmit() {
    if (!text.trim()) return;
    await onSubmit(text.trim());
    if (clearAfterSubmit) {
      setText('');
    }
  }

  return (
    <div className="dialogMask">
      <div className="dialog">
        <h2>输入翻译</h2>
        <textarea value={text} onChange={(e) => setText(e.target.value)} />
        <div className="toolbarActions">
          <button onClick={onCancel}>取消</button>
          <button onClick={handleSubmit}>提交</button>
        </div>
      </div>
    </div>
  );
}
