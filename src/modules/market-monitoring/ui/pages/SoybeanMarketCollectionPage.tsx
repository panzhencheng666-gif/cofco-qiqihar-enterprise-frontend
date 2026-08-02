import { useEffect, useMemo, useState } from "react";

import type { MasterDataRepository } from "../../../master-data/application/ports/MasterDataRepository";
import type {
  MasterDataOption,
  RegionOption,
} from "../../../master-data/domain/masterData";
import type { MarketCollectionRepository } from "../../application/ports/MarketCollectionRepository";
import type {
  CollectionStatus,
  MarketCollectionDefinition,
  MarketCollectionRecord,
} from "../../domain/marketCollection";

const productCode = "SOYBEAN";

interface QueryState {
  collectionDate: string;
  regionId: string;
  monitoringPeriodId: string;
  objectTypeId: string;
  cultivarId: string;
  status: "" | CollectionStatus;
}

const initialQuery: QueryState = {
  collectionDate: "2026-07-31",
  regionId: "",
  monitoringPeriodId: "",
  objectTypeId: "",
  cultivarId: "",
  status: "",
};

interface PageData {
  regions: readonly RegionOption[];
  periods: readonly MasterDataOption[];
  objectTypes: readonly MasterDataOption[];
  cultivars: readonly MasterDataOption[];
  definition: MarketCollectionDefinition;
}

export function SoybeanMarketCollectionPage({
  masterDataRepository,
  marketCollectionRepository,
}: {
  masterDataRepository: MasterDataRepository;
  marketCollectionRepository: MarketCollectionRepository;
}) {
  const [query, setQuery] = useState<QueryState>(initialQuery);
  const [pageData, setPageData] = useState<PageData>();
  const [records, setRecords] = useState<readonly MarketCollectionRecord[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void Promise.all([
      masterDataRepository.getRegionRoots(),
      masterDataRepository.getMonitoringPeriods("MARKET", productCode),
      masterDataRepository.getMarketObjectTypes(productCode),
      masterDataRepository.getCultivars(productCode),
      marketCollectionRepository.getDefinition(productCode),
    ])
      .then(([regions, periods, objectTypes, cultivars, definition]) => {
        if (!active) return;
        setPageData({ regions, periods, objectTypes, cultivars, definition });
      })
      .catch(() => {
        if (active) setErrorMessage("主数据加载失败，请检查后端服务后重试。");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [marketCollectionRepository, masterDataRepository]);

  const fields = useMemo(
    () => pageData?.definition.fieldGroups.flatMap((group) => group.fields) ?? [],
    [pageData],
  );

  function change<K extends keyof QueryState>(key: K, value: QueryState[K]) {
    setQuery((current) => ({ ...current, [key]: value }));
  }

  async function search() {
    setLoading(true);
    setErrorMessage("");
    try {
      const criteria = {
        productCode,
        ...(query.collectionDate ? { collectionDate: query.collectionDate } : {}),
        ...(query.regionId ? { regionId: query.regionId } : {}),
        ...(query.monitoringPeriodId
          ? { monitoringPeriodId: query.monitoringPeriodId }
          : {}),
        ...(query.objectTypeId ? { objectTypeId: query.objectTypeId } : {}),
        ...(query.cultivarId ? { cultivarId: query.cultivarId } : {}),
        ...(query.status ? { status: query.status } : {}),
      };
      setRecords(await marketCollectionRepository.search(criteria));
    } catch {
      setErrorMessage("查询失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="market-collection-page">
      <div className="page-breadcrumb">市场监测 / 大豆市场采集</div>
      <section
        aria-label="大豆市场查询条件"
        className="enterprise-query-bar"
        role="search"
      >
        <label className="query-field query-field--date">
          <span>采集日期</span>
          <input
            aria-label="采集日期"
            onChange={(event) => change("collectionDate", event.target.value)}
            type="date"
            value={query.collectionDate}
          />
        </label>
        <label className="query-field query-field--region">
          <span>地区</span>
          <select
            aria-label="地区"
            onChange={(event) => change("regionId", event.target.value)}
            value={query.regionId}
          >
            <option value="">请选择地区</option>
            {pageData?.regions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        <label className="query-field query-field--period">
          <span>监测批次</span>
          <select
            aria-label="监测批次"
            onChange={(event) => change("monitoringPeriodId", event.target.value)}
            value={query.monitoringPeriodId}
          >
            <option value="">全部可用监测期</option>
            {pageData?.periods.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        <label className="query-field query-field--object">
          <span>对象类型</span>
          <select
            aria-label="对象类型"
            onChange={(event) => change("objectTypeId", event.target.value)}
            value={query.objectTypeId}
          >
            <option value="">全部适用对象</option>
            {pageData?.objectTypes.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        <label className="query-field query-field--cultivar">
          <span>具体品种</span>
          <select
            aria-label="具体品种"
            onChange={(event) => change("cultivarId", event.target.value)}
            value={query.cultivarId}
          >
            <option value="">全部大豆品种</option>
            {pageData?.cultivars.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        <label className="query-field query-field--status">
          <span>填报状态</span>
          <select
            aria-label="填报状态"
            onChange={(event) =>
              change("status", event.target.value as QueryState["status"])
            }
            value={query.status}
          >
            <option value="">全部状态</option>
            <option value="填写中">填写中</option>
            <option value="待审核">待审核</option>
            <option value="已核定">已核定</option>
            <option value="需补充">需补充</option>
          </select>
        </label>
        <div className="query-actions">
          <button
            className="button-primary"
            onClick={() => void search()}
            type="button"
          >
            查询
          </button>
          <button onClick={() => setQuery(initialQuery)} type="button">
            重置
          </button>
          <button type="button">保存常用条件</button>
        </div>
      </section>

      {errorMessage && <div className="page-alert">{errorMessage}</div>}

      <header className="ledger-title">
        <h1>大豆市场采集表</h1>
        <p>当前业务对象 · 当前监测期 · 当前授权地区</p>
      </header>

      <section aria-label="大豆市场采集表区域" className="ledger-panel">
        <div className="ledger-toolbar">
          <strong>
            共 {records.length} 个采集对象，当前显示 {records.length > 0 ? 1 : 0}–
            {records.length}
          </strong>
          <div>
            <button type="button">批量导入</button>
            <button type="button">新建采集记录</button>
          </div>
        </div>
        <div className="ledger-scroll" tabIndex={0}>
          <table aria-label="大豆市场采集表">
            <thead>
              <tr>
                <th rowSpan={2}>序号</th>
                <th rowSpan={2}>采集日期</th>
                <th rowSpan={2}>填报日期</th>
                <th rowSpan={2}>采集对象</th>
                <th rowSpan={2}>对象类型</th>
                <th rowSpan={2}>行政区划</th>
                <th rowSpan={2}>具体品种</th>
                {pageData?.definition.fieldGroups.map((group) => (
                  <th colSpan={Math.max(group.fields.length, 1)} key={group.id}>
                    {group.name}
                  </th>
                ))}
                <th rowSpan={2}>填报状态</th>
                <th rowSpan={2}>操作</th>
              </tr>
              <tr>
                {pageData?.definition.fieldGroups.flatMap((group) =>
                  group.fields.length > 0 ? (
                    group.fields.map((field) => (
                      <th aria-label={field.name} key={field.id}>
                        {field.name}
                        {field.unit && <small>{field.unit}</small>}
                        {field.note && <small>{field.note}</small>}
                      </th>
                    ))
                  ) : (
                    <th aria-label={group.name} key={`${group.id}-empty`}>
                      —
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {records.map((record, index) => (
                <tr key={record.id}>
                  <td>{index + 1}</td>
                  <td>{record.collectionDate}</td>
                  <td>{record.submittedAt}</td>
                  <th scope="row">{record.subjectName}</th>
                  <td>{record.objectTypeName}</td>
                  <td>{record.regionName}</td>
                  <td>{record.cultivarName}</td>
                  {fields.map((field) => (
                    <td className="operational-cell" key={field.id}>
                      {record.values[field.id] ?? "—"}
                    </td>
                  ))}
                  <td>{record.status}</td>
                  <td>
                    <button className="link-button" type="button">
                      查看
                    </button>
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td className="empty-ledger" colSpan={fields.length + 9}>
                    {loading
                      ? "正在加载大豆市场采集记录"
                      : "当前范围暂无大豆市场采集记录"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="ledger-footer">
          <span>本页已填 0 项，缺失 0 项，异常 0 项</span>
          <nav aria-label="采集表分页">
            <button type="button">‹</button>
            <button className="is-current" type="button">
              1
            </button>
            <button type="button">›</button>
          </nav>
        </div>
      </section>
    </div>
  );
}
