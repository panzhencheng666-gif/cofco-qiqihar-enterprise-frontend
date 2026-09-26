import type { AnalysisTopic } from "./metricCatalog";
import type { AnalysisMode } from "./analysisProfile";

const balanceRows = [
  ["期初库存", "供给"],
  ["本期产量", "供给"],
  ["本期进口", "供给"],
  ["本期消费", "需求"],
  ["本期出口", "需求"],
] as const;

export function PendingAnalysisSurface({
  mode,
  topic,
  range,
  region,
  related,
  checks,
  onSelectTopic,
}: {
  mode: AnalysisMode;
  topic: AnalysisTopic;
  range: string;
  region: string;
  related: readonly AnalysisTopic[];
  checks: readonly string[];
  onSelectTopic: (topic: AnalysisTopic) => void;
}) {
  if (mode === "event") {
    return (
      <section className="mi-ops-surface mi-ops-event" aria-label="事件监视与核验">
        <header className="mi-ops-heading">
          <div>
            <small>EVENT DESK / SOURCE VERIFICATION</small>
            <h2>{topic.title}</h2>
          </div>
          <span>事件来源待接入</span>
        </header>
        <div className="mi-ops-event-body">
          <div className="mi-ops-event-stream">
            <header>
              <strong>事件流</strong>
              <span>
                {region} · {range}
              </span>
            </header>
            <div className="mi-ops-event-columns" aria-hidden="true">
              <span>发布时间</span>
              <span>来源</span>
              <span>事件与地域</span>
              <span>核验</span>
            </div>
            <div className="mi-ops-event-empty" role="status">
              <b>尚无可核验事件</b>
              <p>接入来源后按发布时间排列原始记录；修订和重复消息将保留来源关系。</p>
            </div>
          </div>
          <aside className="mi-ops-event-evidence">
            <header>
              核验队列 <span>0 条</span>
            </header>
            {checks.map((check) => (
              <div key={check}>
                <span>{check}</span>
                <b>待来源</b>
              </div>
            ))}
            <p>当前不生成影响幅度或风险等级。证据不足时保持待核验。</p>
          </aside>
        </div>
      </section>
    );
  }

  if (mode === "balance") {
    return (
      <section className="mi-ops-surface mi-ops-balance" aria-label="供需账本">
        <header className="mi-ops-heading">
          <div>
            <small>SUPPLY LEDGER / PERIOD ALIGNMENT</small>
            <h2>{topic.title}</h2>
          </div>
          <span>统计源待接入</span>
        </header>
        <div className="mi-ops-balance-body">
          <div className="mi-ops-balance-ledger">
            <header>
              <strong>供需账本</strong>
              <span>{region} · 统计期待源定义</span>
            </header>
            <div className="mi-ops-balance-columns" aria-hidden="true">
              <span>流向</span>
              <span>构成</span>
              <span>本期</span>
              <span>上期</span>
              <span>来源</span>
            </div>
            {balanceRows.map(([name, side]) => (
              <div className="mi-ops-balance-row" key={name}>
                <span>{side}</span>
                <strong>{name}</strong>
                <span>—</span>
                <span>—</span>
                <span>待接入</span>
              </div>
            ))}
            <div className="mi-ops-balance-total">
              <strong>期末结余 / 缺口</strong>
              <b>—</b>
              <span>同一地域、统计期和单位齐全后计算</span>
            </div>
          </div>
          <aside className="mi-ops-balance-rule">
            <small>RECONCILIATION</small>
            <strong>供给 − 使用 = 结余</strong>
            <p>
              先核对期初库存、产量、进口、消费与出口的统计口径。任何一项缺失时不输出平衡结果。
            </p>
            <dl>
              <div>
                <dt>地域</dt>
                <dd>{region}</dd>
              </div>
              <div>
                <dt>单位</dt>
                <dd>{topic.unit ?? "待来源定义"}</dd>
              </div>
              <div>
                <dt>数据版本</dt>
                <dd>待接入</dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>
    );
  }

  return (
    <section className="mi-ops-surface mi-ops-market" aria-label="行情监视">
      <header className="mi-ops-heading">
        <div>
          <small>MARKET DESK / OBSERVATION TAPE</small>
          <h2>{topic.title}</h2>
        </div>
        <span>报价或观测源待接入</span>
      </header>
      <div className="mi-ops-market-headline">
        <div>
          <span>最新值</span>
          <strong>—</strong>
          <small>{topic.unit ?? "单位待定义"}</small>
        </div>
        <div>
          <span>较前期</span>
          <strong>—</strong>
          <small>需可比观测</small>
        </div>
        <div>
          <span>发布时间</span>
          <strong>—</strong>
          <small>来源时间戳</small>
        </div>
        <div>
          <span>市场状态</span>
          <strong className="pending">等待来源</strong>
          <small>不显示模拟行情</small>
        </div>
      </div>
      <div className="mi-ops-market-body">
        <div className="mi-ops-market-tape">
          <header>
            <strong>报价与观测</strong>
            <span>
              {region} · {range}
            </span>
          </header>
          <div className="mi-ops-market-columns" aria-hidden="true">
            <span>指标</span>
            <span>最新</span>
            <span>变动</span>
            <span>统计期</span>
          </div>
          <div className="mi-ops-market-row current">
            <b>{topic.title}</b>
            <span>—</span>
            <span>—</span>
            <span>待接入</span>
          </div>
          {related
            .filter((item) => item.id !== topic.id)
            .slice(0, 6)
            .map((item) => (
              <button
                className="mi-ops-market-row"
                type="button"
                key={item.id}
                onClick={() => onSelectTopic(item)}
              >
                <span>{item.title} ↗</span>
                <span>—</span>
                <span>—</span>
                <span>待接入</span>
              </button>
            ))}
        </div>
        <aside className="mi-ops-market-depth">
          <small>SOURCE GATE</small>
          <strong>可比序列尚未形成</strong>
          <p>
            需要具备来源、统计期、地域、单位和修订记录的真实观测，才能计算涨跌、区间和趋势。
          </p>
          <span>当前不推断价格方向</span>
        </aside>
      </div>
    </section>
  );
}
