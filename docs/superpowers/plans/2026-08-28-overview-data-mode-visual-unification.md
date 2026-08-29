# 总揽监测供需右侧栏 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将供需平衡从遮挡地图的顶部大面板改为地图右侧固定详情栏，同时保留五项核心指标和完整正式表格。

**Architecture:** `OverviewPage` 在供需模式向 `OverviewCommandCenter` 传入 `sideDataPanel`。指挥舱通过该状态缩窄地图、上移工具栏并把同一个 `OverviewDataModePanel` 定位为约 540px 的右栏；地区数据仍使用顶部 KPI 条。供需表格改为项目、数值、单位三列，正式口径放在项目行标题内，不改变数据请求、计算或实时刷新。

**Tech Stack:** React 19、TypeScript 5.9、Vitest、Testing Library、CSS。

## Global Constraints

- 不改变 Backend、Web、数据库、正式数据契约、供需计算公式、实时刷新与筛选逻辑。
- 缺失数据不得伪造为零。
- 样本点继续作为默认模式，不修改样本点地图、边界、图标或数量逻辑。
- 保护共享脏工作树，不提交、合并、推送、切分支、清理或重置。
- 只发布到本地受管 `63182`，不得访问云端、生产或远程业务数据库。

---

### Task 1: 用失败测试锁定右侧栏和三列表格

**Files:**

- Modify: `src/modules/overview/ui/components/OverviewCommandCenter.dataMode.spec.tsx`
- Modify: `src/modules/overview/ui/components/OverviewDataModePanel.spec.tsx`

**Interfaces:**

- Consumes: 当前 `expandedDataPanel` 顶部扩展布局和四列表格。
- Produces: `OverviewCommandCenter.sideDataPanel?: boolean` 行为约束；三列正式表格语义约束。

- [ ] **Step 1: 把指挥舱布局测试改成右侧栏期望**

将现有扩展面板测试改为：

```tsx
<OverviewCommandCenter
  dataModeControls={<nav aria-label="总揽展示内容">展示模式</nav>}
  dataModePanel={<section aria-label="供需平衡指标">供需平衡</section>}
  sideDataPanel
  {...requiredProps}
/>;

expect(screen.getByRole("main")).toHaveClass("has-side-data-panel");
expect(screen.getByLabelText("粮食商情总览地图")).toBeInTheDocument();
```

- [ ] **Step 2: 把表格测试改成窄栏三列期望**

在完整供需表测试中增加：

```tsx
expect(within(table).getAllByRole("columnheader")).toHaveLength(3);
expect(
  within(table).queryByRole("columnheader", { name: "口径" }),
).not.toBeInTheDocument();
const openingRow = within(table).getByRole("row", {
  name: /期初库存 按正式口径填报 待填报 万吨/,
});
expect(openingRow).toBeVisible();
```

- [ ] **Step 3: 运行测试确认 RED**

Run: `npm test -- src/modules/overview/ui/components/OverviewDataModePanel.spec.tsx src/modules/overview/ui/components/OverviewCommandCenter.dataMode.spec.tsx`

Expected: FAIL；主容器没有 `has-side-data-panel`，表格仍有四个列标题。

### Task 2: 实现右侧栏、地图缩窄和三列完整表格

**Files:**

- Modify: `src/modules/overview/ui/components/OverviewCommandCenter.tsx`
- Modify: `src/modules/overview/ui/components/OverviewDataModePanel.tsx`
- Modify: `src/modules/overview/ui/components/overview-data-mode.css`
- Modify: `src/modules/overview/ui/pages/OverviewPage.tsx`
- Modify: `src/app/styles/global.css`

**Interfaces:**

- Consumes: `dataModePanel`、`dataModeControls`、`SupplyBalanceSummary.rows`。
- Produces: `sideDataPanel?: boolean`；`has-side-data-panel`；右侧供需栏；项目/数值/单位三列表格。

- [ ] **Step 1: 替换父组件布局状态**

在 `OverviewCommandCenter` 中用以下接口替换 `expandedDataPanel`：

```tsx
sideDataPanel = false,
// props
sideDataPanel?: boolean;
// className
`${sideDataPanel ? " has-side-data-panel" : ""}`
```

在 `OverviewPage` 的非样本模式装配中传入：

```tsx
sideDataPanel: dataMode === "SUPPLY_BALANCE",
```

- [ ] **Step 2: 将供需表改为三列但保留全部行**

表头和行使用以下结构：

```tsx
<tr>
  <th>项目</th>
  <th>数值</th>
  <th>单位</th>
</tr>
// rows
<th scope="row">
  <strong>{row.label}</strong>
  <small>{row.requirement}</small>
</th>
<td>{balanceValueLabel(row)}</td>
<td>{row.unit}</td>
```

继续对 `supplyBalance.rows.map` 全量渲染，不删除任何正式项目。

- [ ] **Step 3: 实现右侧布局 CSS**

在 `global.css` 中让右栏状态取消顶部 KPI 高度并缩窄地图：

```css
.overview-command-center.has-side-data-panel {
  --command-kpi-height: 0px;
}
.overview-command-center.has-side-data-panel .overview-command-map {
  right: var(--command-details-offset);
}
.overview-command-center.has-side-data-panel .overview-command-tools {
  right: var(--command-details-offset);
}
```

在 `overview-data-mode.css` 中把供需面板定位到右侧：

```css
.overview-command-center.has-side-data-panel .overview-data-mode {
  top: var(--command-kpi-top);
  right: 22px;
  bottom: 24px;
  left: auto;
  width: var(--command-details-width);
  height: auto;
}
```

供需核心指标使用两列网格，第五项跨两列；表格填充剩余高度，仅纵向滚动。

- [ ] **Step 4: 运行定向测试确认 GREEN**

Run: `npm test -- src/modules/overview/ui/components/OverviewDataModePanel.spec.tsx src/modules/overview/ui/components/OverviewCommandCenter.dataMode.spec.tsx src/modules/overview/ui/pages/OverviewPage.spec.tsx`

Expected: 3 个测试文件全部 PASS，无失败。

### Task 3: 门禁、受管发布与真实浏览器验收

**Files:**

- Verify only: 本计划涉及的源码、测试、文档和受管运行副本。

**Interfaces:**

- Consumes: Task 2 通过定向测试的前端源码。
- Produces: 本地 `63182` 可见的右侧供需栏预览。

- [ ] **Step 1: 格式化本任务文件并运行静态门禁**

Run: `npx prettier --write <owned-files>`，随后分别执行 `npm run format:check`、`npm run lint`、`npm run architecture`、`npm run build`。

Expected: 全部退出码 0；构建允许仓库既有的 chunk-size 提示，但不得有编译错误。

- [ ] **Step 2: 检查共享工作树边界**

Run: `git diff --check`、`git status --short`、本任务文件聚焦 diff。

Expected: 无空白错误；没有清理、覆盖或夹带其他用户文件。

- [ ] **Step 3: 发布受管本地运行时**

从 Backend 仓执行 `./scripts/local-runtime.sh install`，完成后执行 `./scripts/local-runtime.sh status` 和 `pgrep -af caffeinate`。

Expected: `8090`、`63182`、`63200` HTTP 200，caffeinate 在线。

- [ ] **Step 4: 在真实 `63182` 浏览器验收**

打开 `http://127.0.0.1:63182/overview-monitoring/?embed=1#/overview` 并检查：

- 样本点仍为默认模式；
- 地区数据仍为顶部 KPI 条；
- 供需平衡位于右侧，地图边界不被其覆盖；
- 右栏包含五项核心指标和完整三列表格；
- 页面与表格无横向滚动；
- 控制台无 error/warn。

- [ ] **Step 5: 交付本地预览边界**

报告 `63182` 地址、测试/构建/健康/浏览器证据和未提交边界；明确这不是云端、预发布或生产发布。
