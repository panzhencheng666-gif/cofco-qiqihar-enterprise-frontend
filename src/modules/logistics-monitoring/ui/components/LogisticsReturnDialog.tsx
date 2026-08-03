export function LogisticsReturnDialog({
  busy,
  reason,
  onCancel,
  onChange,
  onConfirm,
}: {
  busy: boolean;
  reason: string;
  onCancel: () => void;
  onChange: (reason: string) => void;
  onConfirm: () => void;
}) {
  return (
    <div
      aria-labelledby="logistics-return-title"
      className="production-dialog"
      role="dialog"
    >
      <h2 id="logistics-return-title">退回物流记录</h2>
      <label>
        退回原因
        <textarea
          aria-label="退回原因"
          value={reason}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      <button disabled={busy || !reason.trim()} onClick={onConfirm}>
        确认退回
      </button>
      <button onClick={onCancel}>取消</button>
    </div>
  );
}
