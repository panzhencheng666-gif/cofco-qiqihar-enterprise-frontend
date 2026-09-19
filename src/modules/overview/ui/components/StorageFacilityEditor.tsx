import { useState, type FormEvent } from "react";

import type {
  StorageFacility,
  StorageFacilityDraft,
  StorageFacilityRelation,
} from "../../domain/operationalFacilities";
import type { OverviewRegion } from "../../domain/overview";

export function StorageFacilityEditor({
  facility,
  selectedRegion,
  onCancel,
  onSave,
  onArchive,
}: {
  facility?: StorageFacility;
  selectedRegion?: OverviewRegion;
  onCancel: () => void;
  onSave: (draft: StorageFacilityDraft, facilityCode?: string) => Promise<void>;
  onArchive?: (facility: StorageFacility) => Promise<void>;
}) {
  const [name, setName] = useState(facility?.name ?? "");
  const [relationType, setRelationType] = useState<StorageFacilityRelation>(
    facility?.relationType ?? "OWNED",
  );
  const [regionCode, setRegionCode] = useState(
    facility?.regionCode ?? selectedRegion?.code ?? "",
  );
  const [address, setAddress] = useState(facility?.address ?? "");
  const [longitude, setLongitude] = useState(facility?.longitude?.toString() ?? "");
  const [latitude, setLatitude] = useState(facility?.latitude?.toString() ?? "");
  const [capacity, setCapacity] = useState(facility?.capacityTonnes?.toString() ?? "");
  const [capacityAsOf, setCapacityAsOf] = useState(facility?.capacityAsOf ?? "");
  const [pending, setPending] = useState(false);
  const [issue, setIssue] = useState<string>();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setIssue(undefined);
    try {
      await onSave(
        {
          name,
          relationType,
          regionCode,
          address,
          longitude: numberOrNull(longitude),
          latitude: numberOrNull(latitude),
          operationalStatus: "ACTIVE",
          capacityTonnes: numberOrNull(capacity),
          capacityAsOf: capacityAsOf || null,
          validFrom: null,
          validTo: null,
          expectedVersion: facility?.version ?? 0,
        },
        facility?.code,
      );
      onCancel();
    } catch {
      setIssue("保存失败，请核对地区、地址、经纬度和仓容后重试。");
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      className="storage-facility-editor"
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <header>
        <div>
          <span>正式填报</span>
          <h3>{facility ? "维护库点" : "新增库点"}</h3>
        </div>
        <button type="button" aria-label="关闭库点填报" onClick={onCancel}>
          ×
        </button>
      </header>
      <p>库点只保存当前登录用户提交的内容，不通过 AI 或公开搜索自动生成。</p>
      <label>
        <span>库点名称</span>
        <input
          required
          minLength={2}
          maxLength={200}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <div className="storage-facility-editor__row">
        <label>
          <span>关系类型</span>
          <select
            value={relationType}
            onChange={(event) =>
              setRelationType(event.target.value as StorageFacilityRelation)
            }
          >
            <option value="OWNED">自有库点</option>
            <option value="LEASED">租赁库点</option>
            <option value="HISTORICAL_LEASED">历史租赁库点</option>
          </select>
        </label>
        <label>
          <span>行政区代码</span>
          <input
            required
            pattern="[0-9]{6,12}"
            value={regionCode}
            onChange={(event) => setRegionCode(event.target.value)}
          />
        </label>
      </div>
      <label>
        <span>详细地址</span>
        <input
          required
          minLength={3}
          maxLength={1000}
          value={address}
          onChange={(event) => setAddress(event.target.value)}
        />
      </label>
      <div className="storage-facility-editor__row">
        <label>
          <span>经度（可选）</span>
          <input
            type="number"
            min={-180}
            max={180}
            step="0.000001"
            value={longitude}
            onChange={(event) => setLongitude(event.target.value)}
          />
        </label>
        <label>
          <span>纬度（可选）</span>
          <input
            type="number"
            min={-90}
            max={90}
            step="0.000001"
            value={latitude}
            onChange={(event) => setLatitude(event.target.value)}
          />
        </label>
      </div>
      <div className="storage-facility-editor__row">
        <label>
          <span>仓容（吨）</span>
          <input
            type="number"
            min={0}
            step="0.001"
            value={capacity}
            onChange={(event) => setCapacity(event.target.value)}
          />
        </label>
        <label>
          <span>仓容核定日期</span>
          <input
            type="date"
            value={capacityAsOf}
            onChange={(event) => setCapacityAsOf(event.target.value)}
          />
        </label>
      </div>
      {issue && (
        <p role="alert" className="storage-facility-editor__issue">
          {issue}
        </p>
      )}
      <footer>
        {facility && onArchive && (
          <button
            type="button"
            className="is-danger"
            disabled={pending}
            onClick={() => {
              setPending(true);
              setIssue(undefined);
              void onArchive(facility)
                .then(onCancel)
                .catch(() => {
                  setIssue("归档失败，请刷新后重试。");
                  setPending(false);
                });
            }}
          >
            归档库点
          </button>
        )}
        <button type="button" onClick={onCancel}>
          取消
        </button>
        <button type="submit" disabled={pending}>
          {pending ? "正在保存" : "保存库点"}
        </button>
      </footer>
    </form>
  );
}

function numberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
