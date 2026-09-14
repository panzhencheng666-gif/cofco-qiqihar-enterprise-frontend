import { useState } from "react";
import type {
  CurrentEstimate,
  RegionalEstimateBatch,
} from "../../domain/regionalEstimates";
import "./regional-estimate-comparison.css";

const number = (value: string | null) =>
  value == null
    ? "—"
    : Number(value).toLocaleString("zh-CN", { maximumFractionDigits: 2 });
const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("zh-CN", {
        timeZone: "Asia/Shanghai",
        hour12: false,
      })
    : "尚未完成";
const safeUrl = (value: string) => (/^https?:\/\//i.test(value) ? value : undefined);

function EstimateLogic({
  estimate,
  unit,
}: {
  estimate: CurrentEstimate;
  unit: string;
}) {
  const meanings: Record<string, string> = {
    最近值延续: "没有足够证据支持持续增减时，使用最近一期水平作为估算基线。",
    线性趋势:
      "用历史数据估计每年增加或减少多少，再推算目标年度。每年的变化量由数据拟合。",
    对数趋势:
      "用历史数据估计相对变化速度，适合始终为正、按比例变化的指标。参数由数据拟合。",
  };
  return (
    <div className="regional-estimates__logic">
      <section>
        <h5>1. 这些输入从哪里来</h5>
        <p>只使用早于目标年度的同指标、同单位资料；目标年度公开结果不参与自身估算。</p>
        <div className="regional-estimates__inputs">
          {estimate.inputs.map((input) => (
            <div key={`${input.year}-${input.url}`}>
              <strong>
                {number(input.value)} {input.unit}
              </strong>
              <a href={safeUrl(input.url)} target="_blank" rel="noopener noreferrer">
                {input.year}年 · {input.source}
              </a>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h5>2. 为什么选这个方法</h5>
        <strong>{estimate.model}</strong>
        <p>{meanings[estimate.model]}</p>
        <p>{estimate.selection}</p>
        {estimate.candidates.length > 0 && (
          <>
            <div className="regional-estimates__candidates">
              {estimate.candidates.map((candidate) => (
                <div key={candidate.model}>
                  <span>{candidate.model}</span>
                  <strong>
                    {number(candidate.meanAbsoluteError)} {unit}
                  </strong>
                  <small>{candidate.validationYears}个留出年度</small>
                </div>
              ))}
            </div>
            <p>
              上方为历史平均绝对误差：每次用更早数据估算下一年，再与那一年的公开值对照，取差额绝对值的平均。越小表示这段历史表现越好，不代表未来一定准确。
            </p>
          </>
        )}
      </section>
      <section>
        <h5>3. 参数与结果如何算出</h5>
        <p className="regional-estimates__formula">{estimate.formula}</p>
        <p>
          输入变化后重新拟合并选择模型；不会给所有地区统一套用固定增长率。未取得校准证据的天气、政策影响，不任意乘进结果。
        </p>
      </section>
    </div>
  );
}

export function RegionalEstimateComparison({
  batch,
}: {
  batch: RegionalEstimateBatch;
}) {
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(8);
  const names: Record<string, string> = {
    "230200": "齐齐哈尔市",
    "231100": "黑河市",
    "150700": "呼伦贝尔市",
    "232700": "大兴安岭地区",
  };
  const priority = ["稻谷产量", "玉米产量", "大豆产量"];
  const filtered = [...batch.comparisons]
    .sort((a, b) => {
      const rank = (label: string) =>
        priority.includes(label) ? priority.indexOf(label) : 10;
      return rank(a.label) - rank(b.label) || a.label.localeCompare(b.label, "zh-CN");
    })
    .filter((row) => row.label.includes(search.trim()));
  const status =
    batch.calculationStatus === "RECALCULATED_UNCHANGED"
      ? "已重新计算，结果无变化"
      : batch.calculationStatus === "RECALCULATED_CHANGED"
        ? "已重新计算，结果有变化"
        : batch.calculationStatus === "FAILED_RETAINED"
          ? "本次计算失败，保留上次结果"
          : "即时估算，尚未写入每日批次";
  return (
    <section className="regional-estimates" aria-label="公开值与当前估算对比">
      <h3>公开值与当前估算对比</h3>
      <p>
        {names[batch.rootRegionCode] ?? batch.rootRegionCode} · {batch.year}年估算 ·{" "}
        {batch.comparisons.length}项公开指标。当前估算描述所选年度，明年预测另列。
      </p>
      <div className="regional-estimates__status">
        <strong>{status}</strong>
        <span>
          {batch.sourceStatus === "PARTIAL"
            ? "部分来源未完成核验"
            : "来源核验状态见来源记录"}
        </span>
        <small>
          执行：{date(batch.attemptedAt)} · 计算完成：{date(batch.calculatedAt)} ·
          来源检查：{date(batch.sourceCheckedAt)}
        </small>
      </div>
      <label className="regional-estimates__search">
        查找对比指标
        <input
          type="search"
          placeholder="稻谷、铁路、蔬菜…"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setLimit(8);
          }}
        />
      </label>
      {filtered.slice(0, limit).map((row) => (
        <article key={`${row.label}-${row.unit}`}>
          <h4>{row.label}</h4>
          <div className="regional-estimates__values">
            <div>
              <span>公开值 · {row.publicYear}年</span>
              <strong>
                {number(row.publicValue)} {row.unit}
              </strong>
              <a
                href={safeUrl(row.sourceUrl)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {row.sourceName} ↗
              </a>
            </div>
            <div>
              <span>当前估算 · {row.estimateYear}年</span>
              <strong>
                {row.current ? `${number(row.current.value)} ${row.unit}` : "依据不足"}
              </strong>
              <small>{row.current?.model ?? "不以零代替"}</small>
            </div>
            <div>
              <span>同年差额 · 估算减公开值</span>
              <strong>
                {row.difference == null ? "—" : `${number(row.difference)} ${row.unit}`}
              </strong>
              <small>
                {row.publicYear !== row.estimateYear
                  ? "年度不同，不计算差额"
                  : row.differencePercent == null
                    ? "无可用百分比"
                    : `相对公开值 ${number(row.differencePercent)}%`}
              </small>
            </div>
          </div>
          <details>
            <summary>查看{row.label}的估算逻辑与对比</summary>
            {row.current ? (
              <EstimateLogic estimate={row.current} unit={row.unit} />
            ) : (
              <p>
                当前没有足够的独立历史输入，或最近历史值距目标年超过两年。保留已查证公开值，待取得资料后由系统重新计算。
              </p>
            )}
            <section className="regional-estimates__conclusion">
              <h5>4. 这个差异说明什么</h5>
              <p>{row.conclusion}</p>
              <p>
                这是一套可复算的系统判断，不是调查实测，也不会修改公开原值。比较范围限于上述地市；不得直接当作所属行政村的统计结果。
              </p>
            </section>
            {row.publicYear !== row.estimateYear && row.historicalCheck && (
              <details className="regional-estimates__historical">
                <summary>对{row.publicYear}年公开值做历史检验</summary>
                <p>
                  仅使用{row.publicYear}年以前的数据，估算得到
                  {number(row.historicalCheck.value)}
                  {row.unit}；公开值为{number(row.publicValue)}
                  {row.unit}，差额{number(row.historicalDifference)}
                  {row.unit}。
                </p>
                <EstimateLogic estimate={row.historicalCheck} unit={row.unit} />
              </details>
            )}
          </details>
        </article>
      ))}
      {filtered.length === 0 && (
        <p>尚无符合条件、可核验的公开指标。未取得数据不等于没有农业活动。</p>
      )}
      {filtered.length > limit && (
        <button type="button" onClick={() => setLimit(limit + 12)}>
          再显示12项（剩余{filtered.length - limit}项）
        </button>
      )}
    </section>
  );
}
