import type { AnalysisTopic } from "./metricCatalog";
import { useMarketQuoteBoard } from "./useMarketQuoteBoard";

const number = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 3 });
const cadence = {
  INTRADAY: "盘中报价",
  DAILY: "按日发布",
  WEEKLY: "按周发布",
  MONTHLY: "按月发布",
};

export function QuoteAnalysisPanel({ topic }: { topic: AnalysisTopic }) {
  const { board, error, hidePrices, sourceUnavailable, label, feedAge } =
    useMarketQuoteBoard();
  // Match the backend directory exactly. Never infer a supplier contract from a
  // commodity name or convert units without a verified mapping.
  const matches = board?.instruments.filter((item) => item.name === topic.title) ?? [];
  const instrument = matches.length === 1 ? matches[0] : undefined;
  const unitMismatch = instrument && topic.unit && instrument.unit !== topic.unit;
  const mappingIssue = !board
    ? error
      ? "行情目录读取失败"
      : "正在核对行情目录"
    : matches.length > 1
      ? "标的对应关系待核验"
      : !instrument
        ? "标的尚未进入行情目录"
        : unitMismatch
          ? "目录单位不一致 · 报价未展示"
          : null;
  const quote =
    !hidePrices && !mappingIssue
      ? board?.quotes.find((item) => item.id === instrument?.id)
      : undefined;
  const cached = Boolean(quote && sourceUnavailable);
  const stale = cached || quote?.state === "STALE";
  const previous = quote?.previousClose ?? null;
  const difference = quote && previous !== null ? quote.last - previous : null;
  const percent =
    difference !== null && previous !== null && previous > 0
      ? (difference / previous) * 100
      : null;
  const signed = (value: number | null) =>
    value === null ? "--" : `${value > 0 ? "+" : ""}${number.format(value)}`;
  const tone =
    stale || difference === null ? "muted" : difference >= 0 ? "rising" : "falling";
  return (
    <section className="mi-quote-analysis" aria-label="自动报价分析">
      <header>
        <div>
          <small>MARKET / QUOTE MONITOR</small>
          <h2>{topic.title}</h2>
        </div>
        <p role="status">{mappingIssue ?? label ?? "正在读取行情"}</p>
      </header>
      <div className="mi-quote-analysis-tape">
        <div aria-label="最新报价">
          <span>最新报价</span>
          <strong className={tone}>{quote ? number.format(quote.last) : "--"}</strong>
          <small>
            {instrument?.unit ?? topic.unit ?? "单位待核验"} ·{" "}
            {cached
              ? "缓存报价"
              : quote?.state === "STALE"
                ? "报价已过期"
                : quote
                  ? "按源时间展示"
                  : "尚无可展示报价"}
          </small>
        </div>
        <div>
          <span>前收盘</span>
          <strong>{previous === null ? "--" : number.format(previous)}</strong>
          <small>供应商提供的比较基准</small>
        </div>
        <div>
          <span>较前收盘变动</span>
          <strong className={tone}>{signed(difference)}</strong>
          <small>{percent === null ? "--" : `${signed(percent)}%`}</small>
        </div>
      </div>
      <div className="mi-quote-analysis-details">
        <section>
          <h3>来源与时效</h3>
          <dl>
            <div>
              <dt>数据提供方</dt>
              <dd>{quote?.provider ?? "待核验"}</dd>
            </div>
            <div>
              <dt>源时间（含时区）</dt>
              <dd>{quote?.sourceAt ?? "--"}</dd>
            </div>
            <div>
              <dt>采集心跳年龄</dt>
              <dd>{feedAge === null ? "待核验" : `${Math.floor(feedAge)} 秒`}</dd>
            </div>
            <div>
              <dt>市场 / 发布频率</dt>
              <dd>
                {instrument
                  ? `${instrument.market} / ${cadence[instrument.cadence]}`
                  : "待核验"}
              </dd>
            </div>
            <div>
              <dt>系统标的编号</dt>
              <dd>{instrument?.id ?? "待核验"}</dd>
            </div>
          </dl>
          <p>
            每 10
            秒自动检查报价；采集心跳年龄不代表交易所行情延迟。源时间保留供应商时区，不以页面刷新时间代替。
          </p>
        </section>
        <section>
          <h3>价格比较与数据边界</h3>
          <p>
            变动＝最新报价－前收盘；变动率＝变动÷前收盘×100%。缺少有效前收盘时不计算变动率。
          </p>
          <p>
            当前展示最近接收的报价快照。历史成交、分时与 K
            线、买卖盘和成交持仓尚未接入，不由定时刷新生成或补造。
          </p>
          <p>
            主力标的是目录名称；供应商实际合约、换月规则与授权范围仍需通过供应商配置核验。这里的系统标的编号不是供应商合约代码。
          </p>
        </section>
      </div>
    </section>
  );
}
