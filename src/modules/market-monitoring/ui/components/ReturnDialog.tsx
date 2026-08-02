export function ReturnDialog({
  loading,
  onCancel,
  onConfirm,
  onReasonChange,
  reason,
}: {
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onReasonChange: (reason: string) => void;
  reason: string;
}) {
  return (
    <div
      aria-labelledby="market-return-title"
      className="production-dialog"
      role="dialog"
    >
      <h2 id="market-return-title">退回市场记录</h2>
      <label>
        退回原因
        <textarea
          aria-label="退回原因"
          onChange={(event) => onReasonChange(event.target.value)}
          value={reason}
        />
      </label>
      <button disabled={loading || !reason.trim()} onClick={onConfirm} type="button">
        确认退回
      </button>
      <button onClick={onCancel} type="button">
        取消
      </button>
    </div>
  );
}
