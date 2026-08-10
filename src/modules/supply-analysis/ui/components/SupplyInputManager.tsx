import type { useSupplyAccount } from "../hooks/useSupplyAccount";
import { qualityStateLabel, roleGroupLabel, sourceDomainLabel } from "../supplyDisplay";

export function SupplyInputManager({
  state,
}: {
  state: ReturnType<typeof useSupplyAccount>;
}) {
  const { manager, workspace } = state;
  if (!manager || !workspace) return null;
  const required = workspace.roles.filter((role) => role.required);
  const selectedCount = required.filter((role) => state.selections[role.code]).length;
  const complete = selectedCount === required.length;

  return (
    <div
      aria-labelledby="supply-input-title"
      className="production-dialog supply-input-dialog"
      role="dialog"
    >
      <header className="supply-input-header">
        <div>
          <p className="section-kicker">供需数据来源确认</p>
          <h2 id="supply-input-title">确认供需数据来源</h2>
          <p>
            账户项目、顺序和可用来源均由系统提供。当前已确认 {selectedCount}/
            {required.length} 个必填项目的数据来源。
          </p>
        </div>
        <button onClick={state.closeInputManager} type="button">
          关闭
        </button>
      </header>

      <section
        aria-labelledby="upstream-release-title"
        className="supply-source-release"
      >
        <h3 id="upstream-release-title">登记新的已审核来源</h3>
        <p>
          仅供负责数据来源管理的员工使用。请从已审核的产情或物流详情中取得业务记录编号、
          记录版本号和数据项目；系统会再次核对产品、地区、年度、单位与原始值。
        </p>
        <div className="supply-source-release-fields">
          <label>
            来源业务
            <select
              aria-label="来源业务"
              onChange={(event) =>
                state.setReleaseDraft({
                  ...manager.releaseDraft,
                  sourceDomain: event.target.value as "PRODUCTION" | "LOGISTICS",
                })
              }
              value={manager.releaseDraft.sourceDomain}
            >
              <option value="PRODUCTION">产情监测</option>
              <option value="LOGISTICS">物流监测</option>
            </select>
          </label>
          <label>
            账户项目
            <select
              aria-label="释放到账户项目"
              onChange={(event) =>
                state.setReleaseDraft({
                  ...manager.releaseDraft,
                  roleCode: event.target.value,
                })
              }
              value={manager.releaseDraft.roleCode}
            >
              <option value="">请选择</option>
              {workspace.roles.map((role) => (
                <option key={role.code} value={role.code}>
                  {role.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            已审核记录编号
            <input
              aria-label="已审核记录编号"
              placeholder="填写来源详情中的业务记录编号"
              onChange={(event) =>
                state.setReleaseDraft({
                  ...manager.releaseDraft,
                  sourceRecordId: event.target.value,
                })
              }
              value={manager.releaseDraft.sourceRecordId}
            />
          </label>
          <label>
            记录版本号
            <input
              aria-label="记录版本号"
              inputMode="numeric"
              placeholder="填写来源详情中的当前版本"
              onChange={(event) =>
                state.setReleaseDraft({
                  ...manager.releaseDraft,
                  sourceVersion: event.target.value,
                })
              }
              value={manager.releaseDraft.sourceVersion}
            />
          </label>
          <label>
            来源数据项目
            <input
              aria-label="来源数据项目"
              placeholder="填写需要采用的数据项目"
              onChange={(event) =>
                state.setReleaseDraft({
                  ...manager.releaseDraft,
                  sourceFieldCode: event.target.value,
                })
              }
              value={manager.releaseDraft.sourceFieldCode}
            />
          </label>
          <label>
            数据质量
            <select
              aria-label="来源数据质量"
              onChange={(event) =>
                state.setReleaseDraft({
                  ...manager.releaseDraft,
                  qualityState: event.target.value as "PASSED" | "WARNING" | "BLOCKING",
                })
              }
              value={manager.releaseDraft.qualityState}
            >
              <option value="PASSED">通过</option>
              <option value="WARNING">需关注</option>
              <option value="BLOCKING">阻断</option>
            </select>
          </label>
          <button
            disabled={state.busy}
            onClick={() => void state.releaseSource()}
            type="button"
          >
            登记为可采用来源
          </button>
        </div>
      </section>

      <div className="supply-input-role-list">
        {workspace.roles.map((role) => {
          const manual = manager.manualDrafts[role.code] ?? { value: "", reason: "" };
          return (
            <section className="supply-input-role" key={role.code}>
              <div className="supply-input-role-title">
                <div>
                  <span>{roleGroupLabel(role.groupCode)}</span>
                  <h3>{role.label}</h3>
                </div>
                <span>{role.required ? "必填" : "选填"}</span>
              </div>
              {role.releases.length > 0 ? (
                <label>
                  已审核来源
                  <select
                    aria-label={`${role.label}已审核来源`}
                    onChange={(event) =>
                      state.setSelection(role.code, event.target.value)
                    }
                    value={state.selections[role.code] ?? ""}
                  >
                    <option value="">请选择已审核来源</option>
                    {role.releases.map((release) => (
                      <option key={release.id} value={release.id}>
                        {sourceDomainLabel(release.sourceDomain)} · {release.value}{" "}
                        {release.unitCode} · {qualityStateLabel(release.qualityState)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="supply-input-role__empty">暂无可采用的已审核来源</p>
              )}
              {role.manualAllowed && (
                <details className="supply-manual-input">
                  <summary>没有合适来源？填写拟采用数值</summary>
                  <p>
                    仅在没有合适的已审核来源，或来源数据经业务复核确需纠正时使用。
                    必须说明数据出处和调整原因，核定结果会保留审计记录。
                  </p>
                  <div className="supply-manual-input__fields">
                    <label>
                      拟采用数值
                      <input
                        aria-label={`${role.label}拟采用数值`}
                        inputMode="decimal"
                        onChange={(event) =>
                          state.setManualDraft(role.code, {
                            ...manual,
                            value: event.target.value,
                          })
                        }
                        placeholder="填写本账户项目准备采用的数值"
                        value={manual.value}
                      />
                    </label>
                    <label>
                      调整原因与数据出处
                      <input
                        aria-label={`${role.label}调整原因与数据出处`}
                        onChange={(event) =>
                          state.setManualDraft(role.code, {
                            ...manual,
                            reason: event.target.value,
                          })
                        }
                        placeholder="说明调整原因、数据出处和复核情况"
                        value={manual.reason}
                      />
                    </label>
                    <button
                      disabled={
                        state.busy || !manual.value.trim() || !manual.reason.trim()
                      }
                      onClick={() => void state.approveManualInput(role.code)}
                      type="button"
                    >
                      核定并登记
                    </button>
                  </div>
                </details>
              )}
            </section>
          );
        })}
      </div>

      <footer className="supply-input-footer">
        <label>
          本次数据来源说明
          <textarea
            aria-label="本次数据来源说明"
            onChange={(event) => state.setInputSetReason(event.target.value)}
            value={state.inputSetReason}
          />
        </label>
        <button
          disabled={state.busy || !complete || !state.inputSetReason.trim()}
          onClick={() => void state.createInputSet()}
          type="button"
        >
          确认本次数据来源
        </button>
      </footer>
    </div>
  );
}
