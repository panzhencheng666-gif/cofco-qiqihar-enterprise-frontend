import { useMemo, useState } from "react";

import type { RegionalAgricultureProfile } from "../../domain/overviewRegionalData";

type Indicator = NonNullable<RegionalAgricultureProfile["indicators"]>[number];
type Source = NonNullable<RegionalAgricultureProfile["sources"]>[number];
type Crop = RegionalAgricultureProfile["crops"][number];
type Forecast = Crop["forecasts"][number];

interface DataExplanation {
  title: string;
  value: string;
  kind: string;
  status: string;
  dataPeriod: string;
  calculationTime: string;
  verificationTime: string;
  definition: string;
  rationale: string;
  method: string;
  formula?: string;
  steps?: readonly string[];
  inputs?: readonly {
    label: string;
    value: string;
    status: string;
    basis?: string;
  }[];
  sources?: readonly {
    id: string;
    name: string;
    type: string;
    sourceClass: string;
    status: string;
    publishedOn: string;
    verifiedAt: string;
    reliability: string;
    evidence: string;
    url: string;
  }[];
  notes?: readonly string[];
}

function format(value: string | number | null | undefined, divisor = 1): string {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value) / divisor;
  return Number.isFinite(number)
    ? number.toLocaleString("zh-CN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "—";
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "尚未完成";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "尚未完成";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
}

function categoryLabel(category: string): string {
  return (
    {
      CROP_GRAIN: "粮食作物",
      CROP_TUBER: "薯类",
      CROP_OIL: "油料作物",
      CROP_VEGETABLE: "蔬菜与食用菌",
      CROP_FRUIT: "瓜果",
      CROP_ECONOMIC: "经济与特色作物",
      CROP_FORAGE: "饲草饲料",
      LIVESTOCK: "畜牧与肉蛋奶",
      FISHERY: "渔业水产",
      ECONOMY: "农业产业经济",
      RURAL: "乡村人口与收入",
      OUTLOOK: "公开历史趋势补算与预测",
      LAND: "土地与种植",
      PRODUCTION: "粮食生产",
      INFRASTRUCTURE: "农业基础设施",
      TECHNOLOGY: "农机与技术",
      INPUT: "农资保障",
      PROCESSING: "加工能力",
      FINANCE: "金融与补贴",
      BRAND: "绿色农业与品牌",
      FLOW: "粮食跨地区流向",
      LOGISTICS: "仓储与流通",
      RISK: "灾害与风险",
    }[category] ?? "农业综合指标"
  );
}

function kindLabel(kind: Indicator["dataKind"]): string {
  if (kind === "OBSERVED") return "公开统计";
  if (kind === "ESTIMATED") return "公式计算";
  if (kind === "PLAN") return "公开计划";
  return "公开参考";
}

function sourceClassLabel(value: string): string {
  if (value === "OFFICIAL") return "政府公开";
  if (value === "PUBLIC_DATA_SERVICE") return "公共数据服务";
  if (value === "MAINSTREAM_MEDIA") return "主流媒体";
  if (value === "GOVERNMENT_MEDIA") return "政务媒体";
  if (value === "MEDIA_PUBLIC_ACCOUNT") return "媒体公众号";
  if (value === "INDUSTRY_MEDIA") return "行业媒体";
  return "公开渠道";
}

function sourceTypeLabel(value: Source["type"]): string {
  if (value === "WEATHER") return "气象";
  if (value === "POLICY") return "政策";
  return "农业统计";
}

function sourceStatusLabel(value: string): string {
  if (value === "SEARCH_NOT_CONFIGURED") return "联网搜索尚未配置";
  if (value === "SEARCH_FAILED") return "联网搜索失败，等待重试";
  if (value === "SEARCH_SUCCESS") return "联网搜索已完成";
  if (value === "WAITING_FOR_SOURCE_SYNC" || value === "BOOTSTRAP")
    return "等待首次联网核验";
  if (value.startsWith("BOOTSTRAP_")) return "历史参考，尚未完成本轮核验";
  if (value === "SUCCESS_CHANGED") return "已核验 · 数据有变化";
  if (value === "SUCCESS_UNCHANGED") return "已核验 · 确认无变化";
  if (["SUCCESS", "BOOTSTRAP_VERIFIED", "BOOTSTRAP_REFERENCE"].includes(value)) {
    return "本轮核验成功";
  }
  return "核验失败 · 保留最近有效值";
}

function refreshResultLabel(value: string | null | undefined): string {
  if (value === "SUCCESS_CHANGED") return "核验完成，发现公开数据变化";
  if (value === "SUCCESS_UNCHANGED") return "核验完成，公开数据确认无变化";
  if (value === "PARTIAL") return "部分来源核验失败，正在重试";
  return "核验完成，当前使用最近有效数据";
}

function indicatorGuide(label: string, category: string) {
  if (category === "FLOW")
    return {
      definition: label.includes("净")
        ? "同一年度、同一地区边界的粮食调入量减调出量；正数为净流入，负数为净流出。"
        : "粮食跨越该统计地区边界实际调入或调出的数量；不等于当地粮食产量、销售额或全部货物运输量。",
      rationale:
        "只有统计期、地区边界、品种范围和运输口径一致时，才可对照流入与流出；同一运输批次不得跨方式重复计算。",
    };
  if (category === "LOGISTICS" && /铁路|公路|水路/.test(label))
    return {
      definition: label.includes("周转量")
        ? "运输货物重量乘以运输距离，衡量运输工作量；吨公里与吨不同。"
        : label.includes("里程")
          ? "公开资料统计的运营线路长度；表示基础设施规模，不等于粮食运输能力。"
          : "该运输方式承运的全部货物重量，通常包含煤炭、建材、粮食等，不能直接当作粮食调出量。",
      rationale:
        "用于了解当地运输条件。保留原文统计年和单位；只有取得粮食专门统计后才计入粮食流向。",
    };

  if (category === "OUTLOOK")
    return {
      definition:
        "本地区该指标在目标年度的模型估计；尚未公开的本年数据标为补算，下一年标为预测。",
      rationale:
        "按同地区、同指标、同单位的历史序列计算。三期及以上数据通过逐期回测比较趋势模型与最近值模型；两期按年均变化率；仅一期则延续最近值。所有参数随新数据重新拟合。",
    };
  if (category.startsWith("CROP_"))
    return {
      definition: label.includes("折粮")
        ? "薯类按公报折粮口径统计的产量，用于粮食总量统计；不能当作鲜薯重量，也不能与鲜薯直接相加。"
        : label.includes("平均单产")
          ? "同一地区、同一年度、同一作物每亩播种面积对应的产量。蔬菜及食用菌等总类仅表示该统计类别的综合值。"
          : label.includes("面积")
            ? "报告期内该作物或统计作物类别的播种面积。总类包含子类，不将总类与子类重复相加。"
            : "该作物或统计作物类别在报告期的收获产量。蔬菜及食用菌是合并统计，不能据此认定番茄、辣椒等各占多少。",
      rationale: label.includes("平均单产")
        ? "只有同一公报同时披露面积与产量，才用产量除以面积计算单产；单位先统一。"
        : "按原文的作物名称、统计年度和单位提取；未披露的小品种保留缺项，不平均拆分合计数。",
    };
  if (category === "LIVESTOCK" || category === "FISHERY")
    return {
      definition: label.includes("存栏")
        ? "统计时点仍在饲养的畜禽数量，是时点数。"
        : label.includes("出栏")
          ? "报告期内出栏的畜禽数量，是全年累计数，与年末存栏口径不同。"
          : "报告期内该类畜禽或水产品的产出数量；肉类总量和分项不能重复相加，原奶与加工乳制品分别统计。",
      rationale:
        "保留原文物种、时间范围及数量口径，统一质量单位；不从畜禽数量直接推断肉产量。",
    };
  if (category === "ECONOMY")
    return {
      definition: label.includes("增加值")
        ? "第一产业生产活动新创造的价值，与农林牧渔业总产值口径不同，不能相加。"
        : "按统计公报口径计价的农业生产规模，反映产业经济体量；产值不等于利润或农民收入。",
      rationale:
        "保留公报现价金额。价格变化和产量变化都会影响金额，因此不把产值变化直接解释为实物增产。",
    };
  if (category === "RURAL")
    return {
      definition: label.includes("收入")
        ? "农村居民报告期可用于消费和储蓄的人均收入，涵盖多种收入来源，不等于种粮净利润。"
        : "按来源公报定义统计的乡村人口；常住人口与户籍人口口径需结合原文核对。",
      rationale: "使用对应年度原文数值，人口和收入不能根据作物面积简单换算。",
    };
  if (category === "LOGISTICS")
    return {
      definition:
        "地区农产品冷藏储运容量或配送网络规模，属于流通基础设施指标。设计容量并不等于实际库存或年度运输量。",
      rationale: "使用报道明确披露的设施或线路数量，注明资料期；不与粮食库存混用。",
    };
  if (label.includes("绿色食品认证面积")) {
    return {
      definition:
        "达到绿色食品原料标准化生产要求并通过相关认证或基地认定的面积，用于反映标准化、绿色化生产基础。它不等于当年实际播种面积，也不能直接代表绿色食品产量。",
      rationale:
        "采用公开材料披露的认证或基地面积；原文使用“超过”时按公开下限记录，避免擅自放大。",
    };
  }
  if (label.includes("高标准农田")) {
    return {
      definition:
        "完成田块整治、灌排、道路、地力等建设并达到规定标准的农田累计面积，反映稳定生产能力。",
      rationale: "采用公开累计建设值；覆盖率类指标再除以农作物播种面积，便于地区比较。",
    };
  }
  if (label.includes("机械化率")) {
    return {
      definition: "主要农作物耕、种、收三个环节机械化作业水平的综合比例。",
      rationale: "采用公开部门口径；该比例反映作业方式，不直接等同于产量增长。",
    };
  }
  if (label.includes("保护性耕作")) {
    return {
      definition: "采用少耕、免耕和秸秆覆盖等方式实施黑土地保护的作业面积。",
      rationale: "采用公开年度实施面积；覆盖率按该面积除以农作物播种面积计算。",
    };
  }
  if (label.includes("单产提升示范")) {
    return {
      definition: "集中应用良田、良种、良机、良法开展单产提升的示范面积。",
      rationale: "采用公开示范任务或完成面积；只表示示范覆盖，不直接当作增产量。",
    };
  }
  if (label.includes("加工能力")) {
    return {
      definition: "现有粮食加工设施按设计条件一年可处理的原粮规模。",
      rationale:
        "公开设计能力用于衡量产业承载力；与粮食产量之比用于识别加工能力是否充足。",
    };
  }
  if (label.includes("加工企业")) {
    return {
      definition: "公开材料统计的粮食加工企业数量。",
      rationale: "企业密度按企业数除以粮食产量计算，用于比较产业主体集聚程度。",
    };
  }
  if (label.includes("播种面积")) {
    return {
      definition:
        "报告期内实际或计划播种农作物的面积，同一地块复种时可按播种次数统计。",
      rationale: "优先采用同年度、同地区公开统计；计划值和实际值分开标识。",
    };
  }
  if (label.includes("总产量")) {
    return {
      definition: "报告期内对应作物收获的总产出，系统统一换算为万吨。",
      rationale: "优先采用公开总产；只有缺项时才使用面积乘单产补算。",
    };
  }
  if (label.includes("补贴")) {
    return {
      definition: "公开文件披露的涉农补贴补助规模或执行进度。",
      rationale:
        "金额采用公开值；发放率按已发放金额除以安排金额计算，不能解释为农户实际到手均值。",
    };
  }
  if (label.includes("贷款") || label.includes("资金")) {
    return {
      definition: "用于农业生产、备春耕或涉农经营的公开资金需求或计划投放规模。",
      rationale: "计划值不等于最终实际支出，因此单独标记为公开计划。",
    };
  }
  if (label.includes("种子") || label.includes("化肥") || label.includes("柴油")) {
    return {
      definition: "备春耕调度中披露的农业生产资料需求量。",
      rationale: "采用农业主管部门调度值；亩均值按需求量除以计划播种面积计算。",
    };
  }
  if (label.includes("农机")) {
    return {
      definition: "已完成检修或获得补贴的农业机械数量，反映农机保障准备情况。",
      rationale: "采用公开调度数量；密度指标按农机数量除以播种面积计算。",
    };
  }
  return {
    definition: `${categoryLabel(category)}领域的地区农业指标，用于补充三种主粮之外的生产环境和产业能力。`,
    rationale: "优先沿用公开资料原口径；派生值只使用页面列明的基础值计算。",
  };
}

function summaryGuide(title: string) {
  const guides: Record<
    string,
    { definition: string; rationale: string; steps: string[] }
  > = {
    已覆盖作物播种规模: {
      definition:
        "玉米、大豆和水稻本年播种面积之和，仅表示三种主粮，不代表全部农作物面积。",
      rationale:
        "三种作物先分别确定面积，再相加，避免把地区粮食总面积和分品种面积重复计算。",
      steps: [
        "确定每个品种的本年面积及其公开/补算状态。",
        "统一换算为万亩。",
        "三个品种面积相加得到结果。",
      ],
    },
    已覆盖作物总产: {
      definition: "玉米、大豆和水稻本年总产之和，仅表示三种主粮合计。",
      rationale:
        "每个品种先按面积×单产得到总产，再汇总，能够保留品种差异并追溯每个输入。",
      steps: [
        "确定各品种面积：优先公开值，缺项按边界面积和结构系数补算。",
        "确定各品种单产：优先公开值，缺项采用地区多年基线并按年度趋势调整。",
        "分别计算品种总产=面积×单产。",
        "将三个品种总产统一换算为万吨后相加。",
      ],
    },
    加权单产: {
      definition: "三种主粮合计总产除以合计面积得到的综合亩均产量。",
      rationale: "面积较大的作物对综合单产影响更大，因此不能直接对三个单产做简单平均。",
      steps: [
        "汇总三个品种总产。",
        "汇总三个品种面积。",
        "总产换算后除以总面积得到加权单产。",
      ],
    },
    最大品种占比: {
      definition: "三种主粮中播种面积占比最高的品种及其比例。",
      rationale: "用于识别种植结构集中度，比例越高说明结构越集中。",
      steps: ["计算每个品种面积÷已覆盖作物合计面积。", "比较三个比例并取最大值。"],
    },
    种植多样性指数: {
      definition: "根据三个品种面积占比计算的结构均衡程度，数值越高表示结构越分散。",
      rationale: "采用1减赫芬达尔指数，既考虑品种数量，也考虑各品种占比差异。",
      steps: [
        "把各品种占比转换为0到1的小数。",
        "分别平方后求和。",
        "用1减去平方和并转换为百分比。",
      ],
    },
    单位地域粮食产出: {
      definition: "每平方公里行政区域对应的三种主粮产量。",
      rationale: "用于比较空间产出强度；行政区域包含非耕地，因此不能替代耕地单产。",
      steps: [
        "汇总三个品种总产并换算为吨。",
        "读取行政区公开边界面积。",
        "总产除以行政区面积。",
      ],
    },
    公开值覆盖: {
      definition: "三个品种中能够直接取得完整本年公开面积和单产的品种比例。",
      rationale: "把公开统计与模型补算明确分开，数值越高表示结果对模型依赖越低。",
      steps: ["逐品种判断是否为完整公开统计。", "公开品种数除以三个品种。"],
    },
    明年产量变化: {
      definition: "三个品种下一年预测总产相对本年补算/公开总产的变化比例。",
      rationale:
        "先逐品种应用面积、单产、天气和政策修正，再比较合计值，避免用一个统一增速覆盖不同作物。",
      steps: [
        "逐品种生成下一年面积和单产。",
        "叠加天气与政策修正后计算下一年总产。",
        "汇总下一年总产并与本年合计比较。",
      ],
    },
  };
  return (
    guides[title] ?? {
      definition: "由本页当前地区数据计算的农业指标。",
      rationale: "使用已展示的输入值计算，确保结果可复核。",
      steps: ["读取输入值。", "按页面公式计算。", "统一单位并保留两位小数。"],
    }
  );
}

function sourcePurpose(type: Source["type"]): string {
  if (type === "WEATHER") return "用于农业天气监测及预测中的天气修正";
  if (type === "POLICY") return "用于政策影响判断及预测中的政策修正";
  return "用于地区档案、种植规模、产量和农业专题指标";
}

function readableEvidence(source: Source): string {
  const evidence = source.evidence.trim();
  const looksLikePayload =
    evidence.startsWith("{") ||
    evidence.startsWith("[") ||
    /"(?:latitude|longitude|generationtime_ms|timezone)"/.test(evidence);
  if (looksLikePayload) {
    if (source.type === "WEATHER") {
      return "已提取本地区逐日气温、降水和表层土壤含水率；接口原始报文由系统留存，页面展示标准化后的农业天气指标。";
    }
    return `已从该公开渠道提取结构化记录，${sourcePurpose(source.type)}；接口原始报文由系统留存。`;
  }
  return evidence || `该来源${sourcePurpose(source.type)}。`;
}

function metricFormula(
  crop: Crop,
  key: "area" | "yield" | "output" | "share",
  totalArea: number,
) {
  if (key === "area")
    return `${crop.productName}面积=${format(crop.plantedAreaMu, 10_000)}万亩`;
  if (key === "yield")
    return `${crop.productName}亩均单产=${format(crop.yieldPerMuKg)}公斤/亩`;
  if (key === "output") {
    return `${format(crop.plantedAreaMu, 10_000)}万亩×${format(crop.yieldPerMuKg)}公斤/亩÷1000=${format(crop.totalOutputKg, 10_000_000)}万吨`;
  }
  return `${format(crop.plantedAreaMu, 10_000)}÷${format(totalArea, 10_000)}×100=${format(crop.structurePercent)}%`;
}

function forecastFactor(formula: string | undefined, label: string): number {
  const match = formula?.match(new RegExp(`×([0-9.]+)（${label}）`));
  return match ? Number(match[1]) : 1;
}

function factorChange(factor: number): string {
  const change = (factor - 1) * 100;
  if (Math.abs(change) < 0.0001) return "不调整";
  return `${change > 0 ? "+" : ""}${format(change)}%`;
}

function formatFactor(factor: number): string {
  return factor.toLocaleString("zh-CN", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function forecastSteps(
  _profile: RegionalAgricultureProfile,
  crop: Crop,
  forecast: Forecast,
): string[] {
  const areaFactor = forecastFactor(forecast.formula, "面积趋势");
  const yieldFactor = forecastFactor(forecast.formula, "单产趋势");
  const weatherFactor = forecastFactor(forecast.formula, "天气修正");
  const policyFactor = forecastFactor(forecast.formula, "政策修正");
  return [
    `本年面积基线为${format(crop.plantedAreaMu, 10_000)}万亩，来源状态为${crop.dataKind === "OBSERVED" ? "公开统计" : "模型补算"}。`,
    `面积趋势系数取${formatFactor(areaFactor)}（${factorChange(areaFactor)}）。来自本地区同作物历史面积序列；只有一期或缺少历史时取1，沿用基线。`,
    `本年单产基线为${format(crop.yieldPerMuKg)}公斤/亩，单产趋势系数取${formatFactor(yieldFactor)}（${factorChange(yieldFactor)}）。`,
    `天气系数取${formatFactor(weatherFactor)}：当前未以历史产量校准天气影响，因此不把实时天气直接乘入全年预测。天气仍单独更新展示。`,
    `政策修正系数取${formatFactor(policyFactor)}（${factorChange(policyFactor)}）。政策用于背景研判；尚无经历史数据校准的因果系数，不预设政策必然带来固定增产。`,
    `将本年面积、面积趋势、本年单产、单产趋势、天气修正和政策修正相乘，得到${forecast.year}年预测总产${format(forecast.totalOutputKg, 10_000_000)}万吨。`,
  ];
}

function indicatorEvidence(
  indicator: NonNullable<RegionalAgricultureProfile["indicators"]>[number],
): Partial<DataExplanation> {
  if (indicator.category !== "OUTLOOK") return {};
  const parts = indicator.method.split("。").filter(Boolean);
  const field = (prefix: string) =>
    parts.find((part) => part.startsWith(prefix))?.slice(prefix.length) ?? "未提供";
  const formula = field("计算：");
  const slope = formula.match(/exp\(([-0-9.]+)×(\d+)\)/);
  const model = field("方法：");
  return {
    formula,
    method: model,
    steps: [
      `先取同一地区、同一指标、同一单位的历史值；本次使用${field("历史输入：").split("；").length}期，具体数值见下方。`,
      model.includes("最近值")
        ? "选择最近值延续：不假设增长，把最后一期作为预测基线。"
        : "拟合按比例变化的趋势：对数值取自然对数，再拟合年份与对数值的直线；这样可以得到年度变化倍率。",
      `选择理由：${field("选择原因：")}。`,
      slope
        ? `斜率 b=${slope[1]}，年度倍率 exp(b)=${Math.exp(Number(slope[1])).toFixed(4)}；预测距离最近公开年为${slope[2]}年，因此使用 exp(b×${slope[2]})。`
        : "使用上方选定模型计算到目标年份。",
      "将最近公开值乘以预测倍率，得到目标年结果；不把新闻热度、当前天气或政策条数直接换算为增产。",
    ],
    inputs: field("历史输入：")
      .split("；")
      .map((entry) => {
        const [period, value] = entry.split("=");
        return {
          label: period ?? "历史期",
          value: value ?? entry,
          status: "公开历史值",
          basis: "对应年度统计公报；原文链接列于来源依据。",
        };
      }),
  };
}

export function RegionalAgricultureProfilePanel({
  profile,
}: {
  profile: RegionalAgricultureProfile;
}) {
  const [detail, setDetail] = useState<DataExplanation>();
  const [indicatorSearch, setIndicatorSearch] = useState("");
  const [indicatorCategory, setIndicatorCategory] = useState("ALL");
  const [copiedSource, setCopiedSource] = useState<string>();
  const topics = [...new Set((profile.indicators ?? []).map((i) => i.category))];
  const searchSource = profile.sources?.find((s) => s.sourceClass === "PUBLIC_SEARCH");
  const summary = useMemo(() => {
    const totalArea = profile.crops.reduce(
      (sum, crop) => sum + Number(crop.plantedAreaMu),
      0,
    );
    const totalOutput = profile.crops.reduce(
      (sum, crop) => sum + Number(crop.totalOutputKg),
      0,
    );
    const nextOutput = profile.crops.reduce(
      (sum, crop) => sum + Number(crop.forecasts[0]?.totalOutputKg ?? 0),
      0,
    );
    const observed = profile.crops.filter(
      (crop) => crop.dataKind === "OBSERVED",
    ).length;
    const shares = profile.crops.map((crop) => Number(crop.structurePercent) / 100);
    const sources = profile.sources ?? [];
    const official = sources.filter((source) =>
      ["OFFICIAL", "GOVERNMENT_MEDIA"].includes(source.sourceClass),
    ).length;
    const successful = sources.filter((source) =>
      ["SUCCESS", "SUCCESS_CHANGED", "SUCCESS_UNCHANGED"].includes(source.status),
    ).length;
    const changed = sources.filter(
      (source) => source.status === "SUCCESS_CHANGED",
    ).length;
    const unchanged = sources.filter(
      (source) => source.status === "SUCCESS_UNCHANGED",
    ).length;
    const forecastConfidences = profile.crops.flatMap((crop) =>
      crop.forecasts
        .filter((forecast) => forecast.confidencePercent != null)
        .map((forecast) => Number(forecast.confidencePercent)),
    );
    return {
      totalArea,
      totalOutput,
      nextOutput,
      weightedYield: totalArea > 0 ? totalOutput / totalArea : 0,
      concentration: Math.max(0, ...shares) * 100,
      diversity: (1 - shares.reduce((sum, share) => sum + share * share, 0)) * 100,
      observed,
      observedPercent: profile.crops.length
        ? (observed / profile.crops.length) * 100
        : 0,
      forecastChange: totalOutput ? (nextOutput / totalOutput - 1) * 100 : 0,
      outputDensity:
        Number(profile.regionFacts.areaSquareKilometres) > 0
          ? totalOutput / 1_000 / Number(profile.regionFacts.areaSquareKilometres)
          : 0,
      sourceCount: sources.length,
      officialPercent: sources.length ? (official / sources.length) * 100 : 0,
      successful,
      changed,
      unchanged,
      retained: sources.length - successful,
      forecastConfidence: forecastConfidences.length
        ? forecastConfidences.reduce((sum, value) => sum + value, 0) /
          forecastConfidences.length
        : null,
    };
  }, [profile]);

  const leadingCrop = profile.crops.reduce<Crop | undefined>(
    (best, crop) =>
      !best || Number(crop.structurePercent) > Number(best.structurePercent)
        ? crop
        : best,
    undefined,
  );
  const groups = useMemo(() => {
    const result = new Map<string, Indicator[]>();
    (profile.indicators ?? [])
      .filter(
        (i) =>
          (indicatorCategory === "ALL" || i.category === indicatorCategory) &&
          (i.label + categoryLabel(i.category) + i.dataYear).includes(
            indicatorSearch.trim(),
          ),
      )
      .forEach((indicator) => {
        result.set(indicator.category, [
          ...(result.get(indicator.category) ?? []),
          indicator,
        ]);
      });
    return [...result.entries()];
  }, [profile.indicators, indicatorCategory, indicatorSearch]);
  const calculatedAt = formatDateTime(profile.generatedAt);
  const verifiedAt = formatDateTime(profile.refreshStatus?.lastSuccessAt);
  const explanationSources = useMemo(
    () =>
      (profile.sources ?? []).map((source) => ({
        id: source.id,
        name: source.name,
        type: sourceTypeLabel(source.type),
        sourceClass: sourceClassLabel(source.sourceClass),
        status: sourceStatusLabel(source.status),
        publishedOn: source.publishedOn ?? "来源页未标注",
        verifiedAt: formatDateTime(source.fetchedAt),
        reliability: `${format(Number(source.reliabilityWeight) * 100)}%`,
        evidence: readableEvidence(source),
        url: source.url,
      })),
    [profile.sources],
  );
  const cropInputs = useMemo(
    () =>
      profile.crops.flatMap((crop) => {
        const officialArea = crop.basis.includes("面积采用地区正式数据");
        const modeledYield = crop.basis.includes("单产由多年均值");
        return [
          {
            label: `${crop.productName}播种面积`,
            value: `${format(crop.plantedAreaMu, 10_000)}万亩`,
            status:
              crop.dataKind === "OBSERVED" || officialArea ? "公开基线" : "模型补算",
            basis: officialArea
              ? "取地区公开资料中的面积值；若资料年度早于当前年度，再按面积趋势补齐年度差。"
              : "公开资料未给出本级完整面积，按行政区边界面积、耕作系数和地区品种结构权重分摊。",
          },
          {
            label: `${crop.productName}亩均单产`,
            value: `${format(crop.yieldPerMuKg)}公斤/亩`,
            status:
              crop.dataKind === "OBSERVED" && !modeledYield ? "公开统计" : "模型参数",
            basis: modeledYield
              ? "当前公开资料缺少可直接使用的本年单产，采用该品种地区多年单产基线并按年度趋势调整。"
              : "由同一公开资料的总产除以播种面积换算，或直接采用公开单产。",
          },
          {
            label: `${crop.productName}总产`,
            value: `${format(crop.totalOutputKg, 10_000_000)}万吨`,
            status: "公式计算",
            basis: `${format(crop.plantedAreaMu, 10_000)}万亩×${format(crop.yieldPerMuKg)}公斤/亩÷1000=${format(crop.totalOutputKg, 10_000_000)}万吨。`,
          },
        ];
      }),
    [profile.crops],
  );
  const openSummary = (
    title: string,
    value: string,
    formula: string,
    method = "由本页三个品种的当前值实时汇总",
  ) =>
    setDetail({
      ...summaryGuide(title),
      title,
      value,
      kind: "公式计算",
      status: "随当前基础数据自动重算",
      dataPeriod: `${profile.year}年`,
      calculationTime: calculatedAt,
      verificationTime: verifiedAt,
      method,
      formula,
      inputs: cropInputs,
      sources: explanationSources.filter((source) =>
        (profile.sources ?? []).some(
          (item) => item.id === source.id && item.type === "AGRICULTURE",
        ),
      ),
      notes: [
        "每日08:30核验登记来源；来源更新后重新生成本年补算值。",
        "来源临时失败时保留最近有效值，并进入每小时重试队列。",
      ],
    });

  return (
    <div className="overview-data-mode__profile">
      <header>
        <div>
          <h2>{profile.regionName}农业概况</h2>
          <span>公开资料自动核验 · 缺项自动补算 · 仅预测下一年</span>
        </div>
        <b>无需日常人工填报</b>
      </header>

      {detail && (
        <aside
          aria-label={`${detail.title}计算与来源说明`}
          className="overview-data-mode__detail-sheet"
          role="dialog"
        >
          <header>
            <div>
              <small>{detail.kind} · 数据追溯</small>
              <h3>{detail.title}</h3>
            </div>
            <button type="button" onClick={() => setDetail(undefined)}>
              关闭
            </button>
          </header>
          <div className="overview-data-mode__detail-result">
            <span>当前结果</span>
            <strong>{detail.value}</strong>
            <b>{detail.status}</b>
          </div>
          <dl className="overview-data-mode__detail-meta">
            <div>
              <dt>数据性质</dt>
              <dd>{detail.kind}</dd>
            </div>
            <div>
              <dt>数据期</dt>
              <dd>{detail.dataPeriod}</dd>
            </div>
            <div>
              <dt>本次计算</dt>
              <dd>{detail.calculationTime}</dd>
            </div>
            <div>
              <dt>最近核验</dt>
              <dd>{detail.verificationTime}</dd>
            </div>
          </dl>
          <section className="overview-data-mode__detail-section">
            <h4>指标解释</h4>
            <p>{detail.definition}</p>
          </section>
          <section className="overview-data-mode__detail-section">
            <h4>为什么这样计算</h4>
            <p>{detail.rationale}</p>
            <p className="overview-data-mode__detail-method">口径：{detail.method}</p>
          </section>
          {detail.steps && detail.steps.length > 0 && (
            <section className="overview-data-mode__detail-section">
              <h4>逐步计算逻辑</h4>
              <ol>
                {detail.steps.map((step, index) => (
                  <li key={step}>
                    <b>步骤{index + 1}</b>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {detail.inputs && detail.inputs.length > 0 && (
            <section className="overview-data-mode__detail-section">
              <h4>参与计算的数据</h4>
              <div className="overview-data-mode__detail-inputs">
                {detail.inputs.map((input) => (
                  <article key={`${input.label}-${input.value}`}>
                    <header>
                      <b>{input.label}</b>
                      <span>{input.status}</span>
                    </header>
                    <strong>{input.value}</strong>
                    {input.basis && <p>{input.basis}</p>}
                  </article>
                ))}
              </div>
            </section>
          )}
          {detail.formula && (
            <section className="overview-data-mode__detail-section">
              <h4>
                {detail.kind === "公开统计" || detail.kind === "公开参考"
                  ? "原始依据与口径"
                  : "计算过程"}
              </h4>
              <div className="overview-data-mode__detail-formula">
                <span>代入公式</span>
                <strong>{detail.formula}</strong>
              </div>
            </section>
          )}
          {detail.sources && detail.sources.length > 0 && (
            <section className="overview-data-mode__detail-section">
              <h4>来源依据（{detail.sources.length}项）</h4>
              <div className="overview-data-mode__detail-sources">
                {detail.sources.map((source) => (
                  <article key={source.id}>
                    <header>
                      <div>
                        <b>{source.name}</b>
                        <span>
                          {source.type} · {source.sourceClass}
                        </span>
                      </div>
                      <i>{source.status}</i>
                    </header>
                    <dl>
                      <div>
                        <dt>资料期</dt>
                        <dd>{source.publishedOn}</dd>
                      </div>
                      <div>
                        <dt>核验时间</dt>
                        <dd>{source.verifiedAt}</dd>
                      </div>
                      <div>
                        <dt>来源优先权重</dt>
                        <dd>{source.reliability}</dd>
                      </div>
                    </dl>
                    <p>{source.evidence}</p>
                    <div className="overview-data-mode__source-actions">
                      <a href={source.url} rel="noopener noreferrer" target="_blank">
                        查看公开原文 ↗
                      </a>
                      <button
                        type="button"
                        onClick={() =>
                          void navigator.clipboard
                            .writeText(source.url)
                            .then(() => setCopiedSource(source.id))
                            .catch(() => setCopiedSource("failed"))
                        }
                      >
                        {copiedSource === source.id ? "链接已复制" : "复制原文链接"}
                      </button>
                    </div>
                    <small className="overview-data-mode__source-address">
                      {source.url}
                    </small>
                    {source.status.includes("失败") && (
                      <p>
                        该来源最近访问未成功。可先查阅上方已留存依据，原文恢复后将重新核验。
                      </p>
                    )}
                    {source.url ===
                      "https://hlj.people.com.cn/n2/2026/0515/c220024-41581714.html" && (
                      <a
                        href="https://drc.hlj.gov.cn/drc/c111429/202605/c00_31944370.shtml"
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        查看相关政务报道（省发改委） ↗
                      </a>
                    )}
                    {copiedSource === "failed" && (
                      <small role="status">
                        复制暂不可用，可选中上方完整地址复制。
                      </small>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}
          {detail.notes && detail.notes.length > 0 && (
            <section className="overview-data-mode__detail-section">
              <h4>更新与质量说明</h4>
              <ul>
                {detail.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      )}

      <section aria-label="地区数据时间" className="overview-data-mode__time-strip">
        <div>
          <span>统计年度</span>
          <strong>{profile.year}年</strong>
        </div>
        <div>
          <span>本次计算</span>
          <strong>{calculatedAt}</strong>
        </div>
        <div>
          <span>最近来源核验</span>
          <strong>{formatDateTime(profile.refreshStatus?.lastSuccessAt)}</strong>
        </div>
        <div>
          <span>下次定时任务</span>
          <strong>{formatDateTime(profile.refreshStatus?.nextRefreshAt)}</strong>
        </div>
      </section>

      <section
        className="overview-data-mode__refresh-result"
        aria-label="最近自动核验结果"
      >
        <div>
          <span>最近一次自动核验</span>
          <strong>{refreshResultLabel(profile.refreshStatus?.status)}</strong>
        </div>
        <small>
          每日08:30固定执行；即使公开数据没有变化，也会记录“确认无变化”和本次核验时间。
        </small>
      </section>

      {profile.coverageDescription && (
        <p className="overview-data-mode__coverage">{profile.coverageDescription}</p>
      )}

      <div className="overview-data-mode__refresh-result" role="status">
        <span>每日联网搜索</span>
        <strong>
          {searchSource
            ? sourceStatusLabel(searchSource.status)
            : "尚无联网搜索执行记录"}
        </strong>
        <small>
          {searchSource?.evidence ?? "固定来源核验与搜索发现新资料分开记录。"}
        </small>
      </div>
      {profile.crops.length < 3 && (
        <p className="overview-data-mode__assessment">
          三大作物目前有 {profile.crops.length}/3
          项具备可计算的面积和单产依据。以下合计只覆盖这些作物；未具备完整依据的作物不按零处理，公开面积与其他产量仍可在农业指标中查看。
        </p>
      )}
      {profile.administrativeLevel !== "PREFECTURE" && (
        <p className="overview-data-mode__assessment">
          下方扩展农业指标、天气和政策为所属地市背景资料，来源覆盖范围不自动等同于本县、乡镇或行政村。本地推算单独说明面积分摊依据。
        </p>
      )}
      <section aria-labelledby="regional-facts-title">
        <h3 id="regional-facts-title">地区档案</h3>
        <div className="overview-data-mode__fact-grid">
          <div>
            <span>区域面积</span>
            <strong>{format(profile.regionFacts.areaSquareKilometres)}</strong>
            <small>平方公里</small>
          </div>
          <div>
            <span>直接下辖</span>
            <strong>{profile.regionFacts.directChildCount}</strong>
            <small>个行政区</small>
          </div>
          <div>
            <span>县级地区</span>
            <strong>{profile.regionFacts.countyCount}</strong>
            <small>个</small>
          </div>
          <div>
            <span>乡镇地区</span>
            <strong>{profile.regionFacts.townshipCount}</strong>
            <small>个</small>
          </div>
          <div>
            <span>行政村</span>
            <strong>{profile.regionFacts.villageCount}</strong>
            <small>个</small>
          </div>
          <div>
            <span>主导作物</span>
            <strong>{leadingCrop?.productName ?? "—"}</strong>
            <small>按已覆盖作物结构</small>
          </div>
        </div>
        {leadingCrop && (
          <p className="overview-data-mode__introduction">
            {profile.regionName}区域面积约
            {format(profile.regionFacts.areaSquareKilometres)}平方公里， 共纳入
            {profile.regionFacts.countyCount}个县级地区、
            {profile.regionFacts.townshipCount}个乡镇和
            {profile.regionFacts.villageCount}个行政村；已覆盖作物合计约
            {format(summary.totalArea, 10_000)}万亩，结构以{leadingCrop.productName}
            为主。
          </p>
        )}
      </section>

      <section aria-labelledby="regional-scale-title">
        <h3 id="regional-scale-title">农业规模、结构与效率</h3>
        <div className="overview-data-mode__metric-grid">
          <MetricButton
            label="已覆盖作物播种规模"
            value={`${format(summary.totalArea, 10_000)} 万亩`}
            meta={`${profile.year}年 · 点击查看计算`}
            onClick={() =>
              openSummary(
                "已覆盖作物播种规模",
                `${format(summary.totalArea, 10_000)} 万亩`,
                profile.crops
                  .map((crop) => format(crop.plantedAreaMu, 10_000))
                  .join("+") + `=${format(summary.totalArea, 10_000)}万亩`,
              )
            }
          />
          <MetricButton
            label="已覆盖作物总产"
            value={`${format(summary.totalOutput, 10_000_000)} 万吨`}
            meta={`${profile.year}年 · 点击查看计算`}
            onClick={() =>
              openSummary(
                "已覆盖作物总产",
                `${format(summary.totalOutput, 10_000_000)} 万吨`,
                profile.crops
                  .map((crop) => format(crop.totalOutputKg, 10_000_000))
                  .join("+") + `=${format(summary.totalOutput, 10_000_000)}万吨`,
              )
            }
          />
          <MetricButton
            label="加权单产"
            value={`${format(summary.weightedYield)} 公斤/亩`}
            meta={`${profile.year}年 · 点击查看公式`}
            onClick={() =>
              openSummary(
                "加权单产",
                `${format(summary.weightedYield)} 公斤/亩`,
                `${format(summary.totalOutput, 10_000_000)}万吨×100÷${format(summary.totalArea, 10_000)}万亩=${format(summary.weightedYield)}公斤/亩`,
              )
            }
          />
          <MetricButton
            label="最大品种占比"
            value={`${format(summary.concentration)}%`}
            meta={`${profile.year}年 · 点击查看公式`}
            onClick={() =>
              openSummary(
                "最大品种占比",
                `${format(summary.concentration)}%`,
                `max(${profile.crops.map((crop) => `${crop.productName}${format(crop.structurePercent)}%`).join("，")})=${format(summary.concentration)}%`,
              )
            }
          />
          <MetricButton
            label="种植多样性指数"
            value={`${format(summary.diversity)}%`}
            meta="结构均衡程度 · 点击查看公式"
            onClick={() =>
              openSummary(
                "种植多样性指数",
                `${format(summary.diversity)}%`,
                `(1-${profile.crops
                  .map((crop) => `${format(Number(crop.structurePercent) / 100)}²`)
                  .join("-")})×100=${format(summary.diversity)}%`,
              )
            }
          />
          <MetricButton
            label="单位地域粮食产出"
            value={`${format(summary.outputDensity)} 吨/平方公里`}
            meta="空间产出强度 · 点击查看公式"
            onClick={() =>
              openSummary(
                "单位地域粮食产出",
                `${format(summary.outputDensity)} 吨/平方公里`,
                `${format(summary.totalOutput / 1_000)}吨÷${format(profile.regionFacts.areaSquareKilometres)}平方公里=${format(summary.outputDensity)}吨/平方公里`,
              )
            }
          />
          <MetricButton
            label="公开值覆盖"
            value={`${format(summary.observedPercent)}%`}
            meta={`${summary.observed}/${profile.crops.length}个品种 · 其余模型补算`}
            onClick={() =>
              openSummary(
                "公开值覆盖",
                `${format(summary.observedPercent)}%`,
                `${summary.observed}÷${profile.crops.length}×100=${format(summary.observedPercent)}%`,
                "按三个品种中公开统计值的数量计算",
              )
            }
          />
          <MetricButton
            label="明年产量变化"
            value={`${summary.forecastChange >= 0 ? "+" : ""}${format(summary.forecastChange)}%`}
            meta={`${profile.year + 1}年预测 · 点击查看公式`}
            onClick={() =>
              openSummary(
                "明年产量变化",
                `${summary.forecastChange >= 0 ? "+" : ""}${format(summary.forecastChange)}%`,
                `(${format(summary.nextOutput, 10_000_000)}-${format(summary.totalOutput, 10_000_000)})÷${format(summary.totalOutput, 10_000_000)}×100=${format(summary.forecastChange)}%`,
              )
            }
          />
        </div>
      </section>

      <section aria-labelledby="regional-model-title">
        <h3 id="regional-model-title">来源覆盖与模型诊断</h3>
        <div className="overview-data-mode__diagnostic-grid">
          <div>
            <span>来源总数</span>
            <strong>{summary.sourceCount}</strong>
            <small>已登记公开渠道</small>
          </div>
          <div>
            <span>政府及政务来源</span>
            <strong>{format(summary.officialPercent)}%</strong>
            <small>按来源数量</small>
          </div>
          <div>
            <span>本轮核验成功</span>
            <strong>{summary.successful}</strong>
            <small>按最近成功核验记录计数</small>
          </div>
          <div>
            <span>发现数据变化</span>
            <strong>{summary.changed}</strong>
            <small>已保存新值并触发重算</small>
          </div>
          <div>
            <span>确认数据无变化</span>
            <strong>{summary.unchanged}</strong>
            <small>已完成核验，不是未更新</small>
          </div>
          <div>
            <span>核验失败</span>
            <strong>{summary.retained}</strong>
            <small>保留有效值并每小时重试</small>
          </div>
          <div>
            <span>明年预测模型参考评分</span>
            <strong>
              {summary.forecastConfidence == null
                ? "尚未校准"
                : `${format(summary.forecastConfidence)}%`}
            </strong>
            <small>未校准时不提供置信概率</small>
          </div>
          <div>
            <span>定时运行</span>
            <strong>08:30</strong>
            <small>北京时间每日执行</small>
          </div>
        </div>
      </section>

      {(profile.indicators?.length ?? 0) > 0 && (
        <section aria-labelledby="regional-indicators-title">
          <h3 id="regional-indicators-title">
            农业粮食专题指标（{profile.indicators?.length ?? 0}项）
          </h3>
          <div className="overview-data-mode__indicator-tools">
            <input
              type="search"
              aria-label="搜索农业指标"
              placeholder="搜索作物、畜牧、产业、年份…"
              value={indicatorSearch}
              onChange={(e) => setIndicatorSearch(e.target.value)}
            />
            <select
              aria-label="农业指标主题"
              value={indicatorCategory}
              onChange={(e) => setIndicatorCategory(e.target.value)}
            >
              <option value="ALL">全部主题</option>
              {topics.map((topic) => (
                <option key={topic} value={topic}>
                  {categoryLabel(topic)}（
                  {profile.indicators?.filter((i) => i.category === topic).length}）
                </option>
              ))}
            </select>
          </div>
          <p className="overview-data-mode__indicator-note">
            共{topics.length}个主题 ·
            每个数值均标注资料期。总类与分项分别展示，不重复汇总；未披露的小品种不从合计数中平均拆分。
          </p>
          {groups.length === 0 && (
            <p role="status">没有匹配的已采集指标，请调整关键词或主题。</p>
          )}
          {profile.administrativeLevel !== "PREFECTURE" && (
            <p className="overview-data-mode__indicator-note">
              专题指标采用所属地市公开资料作为环境背景；本级作物数据按本行政区边界另行补算。
            </p>
          )}
          <div className="overview-data-mode__indicator-groups">
            {groups.map(([category, indicators]) => (
              <section key={category}>
                <h4>{categoryLabel(category)}</h4>
                <div className="overview-data-mode__indicator-grid">
                  {indicators.map((indicator) => (
                    <button
                      aria-label={`查看${indicator.label}计算与来源`}
                      key={`${category}-${indicator.label}`}
                      type="button"
                      onClick={() =>
                        setDetail({
                          ...indicatorGuide(indicator.label, indicator.category),
                          title: indicator.label,
                          value: `${format(indicator.value)} ${indicator.unit}`,
                          kind: kindLabel(indicator.dataKind),
                          status:
                            indicator.dataKind === "ESTIMATED"
                              ? "基础值更新后自动重算"
                              : "采用最近有效公开值",
                          dataPeriod: `${indicator.dataYear}年`,
                          calculationTime: calculatedAt,
                          verificationTime: formatDateTime(indicator.verifiedAt),
                          method:
                            indicator.dataKind === "ESTIMATED"
                              ? "根据公开基础值动态计算"
                              : kindLabel(indicator.dataKind),
                          formula: indicator.method,
                          inputs:
                            indicator.category === "OUTLOOK"
                              ? [
                                  {
                                    label: "拟合历史与计算理由",
                                    value: "由本地区公开序列自动生成",
                                    status: "逐期回测或基线延续",
                                    basis: indicator.method,
                                  },
                                ]
                              : [
                                  {
                                    label: "原始证据与口径",
                                    value: `${format(indicator.value)} ${indicator.unit}`,
                                    status: kindLabel(indicator.dataKind),
                                    basis: indicator.method,
                                  },
                                ],
                          steps: indicator.method.includes("历史输入：")
                            ? indicator.method.split("。").filter(Boolean)
                            : indicator.dataKind === "ESTIMATED"
                              ? [
                                  `依据：${indicator.method}`,
                                  "先核对资料期和统计口径；跨年数据或范围不同的数据不直接相除。",
                                  "把分子、分母或面积统一到公式要求的单位。",
                                  "代入下方公式计算，并随任一基础值变化自动重算。",
                                ]
                              : [
                                  `读取来源：${indicator.sourceName}，数据期为${indicator.dataYear}年。`,
                                  indicator.method,
                                  "按原文统计口径提取数值、单位和资料期。",
                                  "如原文使用“超过、约”等表述，则按下限或上下文值记录并明确标记。",
                                ],
                          ...indicatorEvidence(indicator),
                          sources: explanationSources.filter(
                            (source) =>
                              source.url === indicator.sourceUrl ||
                              source.name === indicator.sourceName ||
                              (indicator.category === "OUTLOOK" &&
                                source.name.includes("统计公报")),
                          ),
                          notes: [
                            indicator.dataKind === "ESTIMATED"
                              ? "该结果不是原文直接公布值，由页面所列基础数据按公式自动生成。"
                              : "该结果取自公开资料，系统每日核验来源状态并保留资料期。",
                          ],
                        })
                      }
                    >
                      <span>
                        <b>{indicator.label}</b>
                        <i>{kindLabel(indicator.dataKind)}</i>
                      </span>
                      <strong>
                        {format(indicator.value)} <small>{indicator.unit}</small>
                      </strong>
                      <em>
                        数据期 {indicator.dataYear}年 · 最近核验{" "}
                        {formatDateTime(indicator.verifiedAt)}
                      </em>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="regional-structure-title">
        <h3 id="regional-structure-title">种植结构与分品种数据</h3>
        <div className="overview-data-mode__crop-list">
          {profile.crops.map((crop) => (
            <article key={crop.productCode}>
              <div className="overview-data-mode__crop-heading">
                <strong>{crop.productName}</strong>
                <span className={`is-${crop.dataKind.toLowerCase()}`}>
                  {crop.dataKind === "OBSERVED" ? "公开统计" : "模型补算"}
                </span>
              </div>
              <button
                className="overview-data-mode__structure-bar"
                type="button"
                onClick={() =>
                  setDetail({
                    title: `${crop.productName}已覆盖作物种植占比`,
                    value: `${format(crop.structurePercent)}%`,
                    definition: `${crop.productName}播种面积占目前具备计算依据的作物面积合计的比例；不表示全部农作物结构。`,
                    rationale:
                      "使用面积占比展示种植结构；分母只包含当前三种主粮，因此不能解释为占全部农作物的比例。",
                    kind: crop.dataKind === "OBSERVED" ? "公开统计" : "模型补算",
                    status: "随本年种植结构自动重算",
                    dataPeriod: `${profile.year}年`,
                    calculationTime: calculatedAt,
                    verificationTime: verifiedAt,
                    method: crop.basis,
                    formula: metricFormula(crop, "share", summary.totalArea),
                    steps: [
                      `读取${crop.productName}播种面积${format(crop.plantedAreaMu, 10_000)}万亩。`,
                      `汇总已覆盖作物播种面积${format(summary.totalArea, 10_000)}万亩。`,
                      "本品种面积除以已覆盖作物合计面积并转换为百分比。",
                    ],
                    inputs: cropInputs,
                    sources: explanationSources.filter((source) =>
                      (profile.sources ?? []).some(
                        (item) => item.id === source.id && item.type === "AGRICULTURE",
                      ),
                    ),
                    notes: [
                      "占比按该品种面积除以已覆盖作物合计面积计算。",
                      crop.confidencePercent
                        ? `模型参考评分 ${format(crop.confidencePercent)}%。`
                        : "尚未完成统计误差校准，不提供置信概率或虚构区间。",
                    ],
                  })
                }
              >
                <i
                  style={{ width: `${Math.min(100, Number(crop.structurePercent))}%` }}
                />
                <b>{format(crop.structurePercent)}%</b>
              </button>
              <div className="overview-data-mode__crop-metrics">
                {(["area", "yield", "output"] as const).map((key) => {
                  const labels = { area: "面积", yield: "单产", output: "总产" };
                  const values = {
                    area: `${format(crop.plantedAreaMu, 10_000)} 万亩`,
                    yield: `${format(crop.yieldPerMuKg)} 公斤/亩`,
                    output: `${format(crop.totalOutputKg, 10_000_000)} 万吨`,
                  };
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        setDetail({
                          title: `${crop.productName}${labels[key]}`,
                          value: values[key],
                          definition:
                            key === "area"
                              ? `${crop.productName}在所选地区、所选年度的播种面积。`
                              : key === "yield"
                                ? `${crop.productName}平均每亩形成的产量，是总产计算的效率输入。`
                                : `${crop.productName}在所选地区、所选年度的产量合计。`,
                          rationale:
                            key === "output"
                              ? "总产必须由同一地区、同一年度的面积与单产相乘，避免混用不同资料期。"
                              : crop.basis,
                          kind: crop.dataKind === "OBSERVED" ? "公开统计" : "模型补算",
                          status:
                            crop.dataKind === "OBSERVED"
                              ? "采用最近有效公开值"
                              : "公开基础值更新后自动重算",
                          dataPeriod: `${profile.year}年`,
                          calculationTime: calculatedAt,
                          verificationTime: verifiedAt,
                          method: crop.basis,
                          formula: metricFormula(crop, key, summary.totalArea),
                          steps:
                            key === "output"
                              ? [
                                  `确定面积输入为${format(crop.plantedAreaMu, 10_000)}万亩。`,
                                  `确定单产输入为${format(crop.yieldPerMuKg)}公斤/亩。`,
                                  "面积乘单产得到公斤，再换算为万吨。",
                                ]
                              : [
                                  crop.dataKind === "OBSERVED"
                                    ? "读取所选地区同年度公开统计。"
                                    : "检查公开值是否完整；缺项进入地区模型。",
                                  crop.basis,
                                  "统一单位并保留计算精度后展示。",
                                ],
                          inputs: [
                            {
                              label: crop.productName,
                              value: `面积 ${format(crop.plantedAreaMu, 10_000)}万亩 · 单产 ${format(crop.yieldPerMuKg)}公斤/亩 · 总产 ${format(crop.totalOutputKg, 10_000_000)}万吨`,
                              status:
                                crop.dataKind === "OBSERVED" ? "公开统计" : "模型补算",
                              basis: crop.basis,
                            },
                          ],
                          sources: explanationSources.filter((source) =>
                            (profile.sources ?? []).some(
                              (item) =>
                                item.id === source.id && item.type === "AGRICULTURE",
                            ),
                          ),
                          notes: [
                            crop.confidencePercent
                              ? `模型参考评分 ${format(crop.confidencePercent)}%。`
                              : "尚未完成统计误差校准，不提供置信概率或虚构区间。",
                            crop.uncertaintyLowKg && crop.uncertaintyHighKg
                              ? `总产合理区间为 ${format(crop.uncertaintyLowKg, 10_000_000)}–${format(crop.uncertaintyHighKg, 10_000_000)} 万吨。`
                              : "公开值不额外生成不确定性区间。",
                          ],
                        })
                      }
                    >
                      <span>{labels[key]}</span>
                      <strong>{values[key]}</strong>
                    </button>
                  );
                })}
              </div>
              <p>
                {crop.dataKind === "OBSERVED"
                  ? "采用地区年度数据；点击指标查看原始依据。"
                  : "根据已有面积与历史单产补算；点击指标查看输入来源与假设。"}
              </p>
              <small>
                {crop.confidencePercent
                  ? `模型参考评分 ${format(crop.confidencePercent)}%`
                  : "误差范围尚待历史验证"}
                {crop.uncertaintyLowKg && crop.uncertaintyHighKg
                  ? ` · 情景参考范围 ${format(crop.uncertaintyLowKg, 10_000_000)}–${format(crop.uncertaintyHighKg, 10_000_000)} 万吨`
                  : ""}
              </small>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="regional-forecast-title">
        <h3 id="regional-forecast-title">面积与单产模型预测</h3>
        <div className="overview-data-mode__forecast-table">
          <table>
            <thead>
              <tr>
                <th>品种</th>
                <th>预测期</th>
                <th>面积(万亩)</th>
                <th>总产(万吨)</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              {profile.crops.flatMap((crop) =>
                crop.forecasts.map((forecast) => (
                  <tr key={`${crop.productCode}-${forecast.year}`}>
                    <th scope="row">{crop.productName}</th>
                    <td>{forecast.year}年</td>
                    <td>{format(forecast.plantedAreaMu, 10_000)}</td>
                    <td>{format(forecast.totalOutputKg, 10_000_000)}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() =>
                          setDetail({
                            title: `${crop.productName}${forecast.year}年产量预测`,
                            value: `${format(forecast.totalOutputKg, 10_000_000)} 万吨`,
                            definition: `${crop.productName}${forecast.year}年预测总产，表示在当前基础数据、趋势、天气和政策条件下的模型结果。`,
                            rationale:
                              "先分别预测种植规模和每亩产出，再相乘得到总产。历史序列决定使用趋势或最近值延续；未校准的天气和政策不预设增产系数。",
                            kind: "预测模型",
                            status: "仅预测下一年",
                            dataPeriod: `${forecast.year}年预测`,
                            calculationTime: calculatedAt,
                            verificationTime: verifiedAt,
                            method: forecast.formula ?? "历史基线延续",
                            formula: `${format(forecast.plantedAreaMu, 10_000)}万亩×${format(forecast.yieldPerMuKg)}公斤/亩÷1000=${format(forecast.totalOutputKg, 10_000_000)}万吨`,
                            steps: forecastSteps(profile, crop, forecast),
                            inputs: [
                              {
                                label: `${profile.year}年${crop.productName}基础值`,
                                value: `面积 ${format(crop.plantedAreaMu, 10_000)}万亩 · 单产 ${format(crop.yieldPerMuKg)}公斤/亩`,
                                status:
                                  crop.dataKind === "OBSERVED"
                                    ? "公开统计"
                                    : "模型补算",
                                basis: crop.basis,
                              },
                            ],
                            sources: explanationSources,
                            notes: [
                              forecast.confidencePercent
                                ? `模型参考评分 ${format(forecast.confidencePercent)}%。`
                                : "历史数据较少，当前不提供置信概率。",
                              "模型仅生成本年尚未公开的缺项和下一年预测；公开新值进入后会自动替换旧基础值并重新计算。",
                              "趋势、天气和政策修正均记录在代入公式中，预测结果用于经营研判。",
                            ],
                          })
                        }
                      >
                        查看公式
                      </button>
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="regional-flow-title">
        <h3 id="regional-flow-title">粮食流入、流出与铁路物流</h3>
        <p className="overview-data-mode__indicator-note">
          实际粮食调入、调出按同年度同地区边界统计；铁路、公路全货种运输量单独展示，不能当作粮食流出。
        </p>
        {!profile.indicators?.some((i) => i.category === "FLOW") && (
          <p>
            尚未取得可核验的粮食调入、调出统计。未披露不等于零；取得同口径数据后可自动计算净流入。
          </p>
        )}
        {!profile.indicators?.some((i) => i.category === "LOGISTICS") && (
          <p>
            本地区铁路货运、货运站与物流设施资料仍待采集。上级地区数据只能作为背景参考。
          </p>
        )}
      </section>
      <section aria-labelledby="regional-weather-title">
        <h3 id="regional-weather-title">农业天气</h3>
        {profile.weather ? (
          <div className="overview-data-mode__weather">
            <dl>
              <div>
                <dt>气温</dt>
                <dd>{format(profile.weather.meanTemperatureC)}℃</dd>
              </div>
              <div>
                <dt>降水</dt>
                <dd>{format(profile.weather.precipitationMm)} mm</dd>
              </div>
              <div>
                <dt>表层墒情</dt>
                <dd>{format(profile.weather.soilMoisturePercent)}%</dd>
              </div>
            </dl>
            <p>{profile.weather.assessment}</p>
            <small>
              观测时间 {formatDateTime(profile.weather.observedAt)} ·{" "}
              {profile.weather.risk}
            </small>
          </div>
        ) : (
          <p className="overview-data-mode__pending">
            天气源正在进行首次自动同步，预测暂用区域多年气候系数。
          </p>
        )}
      </section>

      <section aria-labelledby="regional-policy-title">
        <h3 id="regional-policy-title">
          政策影响（{profile.policies?.length ?? 0}项）
        </h3>
        <div className="overview-data-mode__policy-list">
          {(profile.policies ?? []).map((policy) => (
            <article key={policy.sourceUrl}>
              <a href={policy.sourceUrl} target="_blank" rel="noreferrer">
                {policy.title}
              </a>
              <small>
                发布日期 {policy.publishedOn ?? "来源未标注"} · {policy.sourceName}
              </small>
              <p>{policy.impact}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="regional-source-title">
        <h3 id="regional-source-title">来源档案（{summary.sourceCount}个渠道）</h3>
        <p className="overview-data-mode__source-note">
          这里只显示来源状态。点击来源后查看公开依据、资料日期和原文，避免把网页正文堆进页面。
        </p>
        <div className="overview-data-mode__source-list">
          {(profile.sources ?? []).map((source) => (
            <button
              aria-label={`查看${source.name}计算与来源`}
              key={source.id}
              type="button"
              onClick={() =>
                setDetail({
                  title: source.name,
                  value: sourceStatusLabel(source.status),
                  definition:
                    "系统登记并定时核验的公开数据渠道。来源档案记录其性质、资料期、读取状态、提取证据和参与计算的用途。",
                  rationale:
                    "不同来源的权威性、时效性和口径可能不同，因此分别保留并配置融合权重，而不是直接覆盖。",
                  kind: "公开来源",
                  status: [
                    "SUCCESS",
                    "SUCCESS_CHANGED",
                    "SUCCESS_UNCHANGED",
                    "BOOTSTRAP_VERIFIED",
                    "BOOTSTRAP_REFERENCE",
                  ].includes(source.status)
                    ? "当前核验可访问"
                    : "当前使用最近有效记录",
                  dataPeriod: source.publishedOn
                    ? `资料发布于 ${source.publishedOn}`
                    : "来源页未标注发布日期",
                  calculationTime: calculatedAt,
                  verificationTime: formatDateTime(source.fetchedAt),
                  method: sourcePurpose(source.type),
                  steps: [
                    "每日08:30访问公开地址并取得页面或接口内容。",
                    "清洗正文、识别可用字段并统一面积、重量和时间单位。",
                    "将本次结构化内容与上次内容指纹比较，判断“有变化”或“确认无变化”。",
                    "有变化时保存新值并触发补算；无变化时记录本次核验成功但不改业务数值。",
                    "访问或解析失败时保留最近有效值，并每小时重试。",
                  ],
                  sources: explanationSources.filter(
                    (reference) => reference.id === source.id,
                  ),
                  notes: [
                    `系统给该来源配置的融合权重为 ${format(Number(source.reliabilityWeight) * 100)}%。`,
                    [
                      "SUCCESS",
                      "SUCCESS_CHANGED",
                      "SUCCESS_UNCHANGED",
                      "BOOTSTRAP_VERIFIED",
                      "BOOTSTRAP_REFERENCE",
                    ].includes(source.status)
                      ? "本轮已成功访问并完成内容核验。"
                      : "本轮未取得新内容，当前结果保留此前核验通过的有效记录。",
                    "系统每日08:30重新核验；失败来源每小时重试，恢复后自动参与下一轮计算。",
                  ],
                })
              }
            >
              <span>
                <b>{source.name}</b>
                <i>{sourceStatusLabel(source.status)}</i>
              </span>
              <small>
                {sourceTypeLabel(source.type)} · {sourceClassLabel(source.sourceClass)}{" "}
                · 资料期 {source.publishedOn ?? "未标注"} · 核验{" "}
                {formatDateTime(source.fetchedAt)}
              </small>
            </button>
          ))}
        </div>
      </section>

      <footer>
        <p>
          <b>每日 08:30 自动任务：</b>
          核验已登记公开来源，更新可自动解析的作物与天气数据，并重新生成本年缺项和下一年预测；来源失败时保留最近有效值并每小时重试。
        </p>
        <p>
          <b>计算范围：</b>
          {profile.sourceSummary}；{profile.calculationMethod}
        </p>
      </footer>
    </div>
  );
}

function MetricButton({
  label,
  value,
  meta,
  onClick,
}: {
  label: string;
  value: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button aria-label={`查看${label}计算说明`} type="button" onClick={onClick}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{meta}</small>
    </button>
  );
}
