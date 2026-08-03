import type { SupplyRunCommand } from "../../domain/supplyAccount";

export function SupplyRunner({
  busy,
  command,
  onCancel,
  onChange,
  onRun,
}: {
  busy: boolean;
  command: SupplyRunCommand;
  onCancel: () => void;
  onChange: (command: SupplyRunCommand) => void;
  onRun: () => void;
}) {
  return (
    <div
      aria-labelledby="supply-run-title"
      className="production-dialog supply-run-dialog"
      role="dialog"
    >
      <h2 id="supply-run-title">提交调整建议并重新计算</h2>
      <label>
        拟议调整值
        <input
          aria-label="拟议调整值"
          value={command.adjustmentProposalValue}
          onChange={(event) =>
            onChange({ ...command, adjustmentProposalValue: event.target.value })
          }
        />
      </label>
      <label>
        调整建议理由
        <textarea
          aria-label="调整建议理由"
          value={command.adjustmentProposalReason}
          onChange={(event) =>
            onChange({ ...command, adjustmentProposalReason: event.target.value })
          }
        />
      </label>
      <label>
        <input
          checked={command.publish}
          onChange={(event) => onChange({ ...command, publish: event.target.checked })}
          type="checkbox"
        />
        审核通过后发布正式结果
      </label>
      <button
        disabled={
          busy ||
          !command.adjustmentProposalValue.trim() ||
          !command.adjustmentProposalReason.trim()
        }
        onClick={onRun}
      >
        执行计算
      </button>
      <button onClick={onCancel}>取消</button>
    </div>
  );
}
