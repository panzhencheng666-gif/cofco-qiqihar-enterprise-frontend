import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, vi } from "vitest";
import type { ReportingRepository } from "../../application/ports/ReportingRepository";
import { ReportingCenterPage } from "./ReportingCenterPage";

describe("ReportingCenterPage", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses backend-supplied parameters and enforces preview before export and publication", async () => {
    const user = userEvent.setup();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const preview = vi.fn<ReportingRepository["preview"]>(() =>
      Promise.resolve(samplePreview),
    );
    const exportReport = vi.fn<ReportingRepository["export"]>(() =>
      Promise.resolve({
        id: "export-1",
        previewId: "preview-1",
        formatCode: "CSV",
        filename: "报告.csv",
        contentType: "text/csv",
        requestedAt: "2026-08-03T00:00:00Z",
      }),
    );
    const download = vi.fn<ReportingRepository["download"]>(() =>
      Promise.resolve({
        filename: "报告.csv",
        contentType: "text/csv",
        content: new Blob(["报告名称,核定数据条数"]),
      }),
    );
    const publish = vi.fn<ReportingRepository["publish"]>(() =>
      Promise.resolve({
        id: "publication-1",
        previewId: "preview-1",
        exportTaskId: "export-1",
        publishedAt: "2026-08-03T00:00:00Z",
        version: 1,
      }),
    );
    render(
      <ReportingCenterPage
        repository={{
          options: () => Promise.resolve(options),
          preview,
          export: exportReport,
          download,
          publish,
        }}
      />,
    );
    expect(await screen.findByRole("heading", { name: "业务报告" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "导出预览" })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("报告定义"), "PRODUCTION_DAILY");
    await user.selectOptions(screen.getByLabelText("产品"), "CORN");
    await user.selectOptions(screen.getByLabelText("地区层级"), "PREFECTURE");
    await user.selectOptions(screen.getByLabelText("地区"), "230200");
    await user.selectOptions(screen.getByLabelText("期间"), "2026-Q3");
    await user.selectOptions(screen.getByLabelText("输出格式"), "CSV");
    await user.click(screen.getByRole("button", { name: "生成核定数据预览" }));
    await waitFor(() =>
      expect(preview).toHaveBeenCalledWith(
        expect.objectContaining({ productCode: "CORN", regionCode: "230200" }),
      ),
    );
    await user.click(screen.getByRole("button", { name: "导出预览" }));
    await waitFor(() => expect(exportReport).toHaveBeenCalledWith("preview-1", "CSV"));
    await user.click(screen.getByRole("button", { name: "下载已生成文件" }));
    await waitFor(() => expect(download).toHaveBeenCalledWith("export-1"));
    await user.click(screen.getByRole("button", { name: "发布报告" }));
    await waitFor(() =>
      expect(publish).toHaveBeenCalledWith("preview-1", "export-1", 0),
    );
    expect(screen.getByText("报告已发布并写入审计记录。")).toBeVisible();
  });
});

const options = {
  definitions: [
    {
      code: "PRODUCTION_DAILY",
      name: "产情日报",
      businessDomain: "PRODUCTION",
      businessSubtype: "MONITORING",
      frequencyCode: "DAILY",
      version: 1,
      sections: [],
    },
  ],
  products: [{ code: "CORN", label: "玉米" }],
  cultivars: [],
  regionLevels: [{ code: "PREFECTURE", label: "地市" }],
  regions: [{ code: "230200", label: "齐齐哈尔市" }],
  periods: [{ code: "2026-Q3", label: "2026年第三季度" }],
  formats: [{ code: "CSV", label: "CSV（中文列名）" }],
} as const;
const samplePreview = {
  id: "preview-1",
  definitionCode: "PRODUCTION_DAILY",
  datasetId: "dataset-1",
  title: "齐齐哈尔市玉米产情日报",
  dataCutoffLabel: "2026-Q3",
  lines: [{ label: "核定数据条数", value: "1", note: "服务端核定快照" }],
  sections: [{ code: "OVERVIEW", title: "总体概览", body: "已采用 1 条核定数据。" }],
  expiresAt: "2026-08-03T00:30:00Z",
  version: 0,
  legacyReadOnly: false,
} as const;
