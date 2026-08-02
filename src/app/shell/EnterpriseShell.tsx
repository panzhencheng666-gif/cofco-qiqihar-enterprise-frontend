import type { ReactNode } from "react";

interface NavigationItem {
  label: string;
  route: string;
}

interface NavigationGroup {
  label: string;
  items: readonly NavigationItem[];
}

const topApplications = [
  "产情监测",
  "市场监测",
  "物流监测",
  "供需分析",
  "报表中心",
  "我的工作",
] as const;

const navigationGroups: readonly NavigationGroup[] = [
  {
    label: "我的工作",
    items: [
      { label: "待办任务", route: "#/work/pending" },
      { label: "已办事项", route: "#/work/completed" },
    ],
  },
  {
    label: "产情监测",
    items: [
      { label: "产情填报", route: "#/产情监测/产情填报" },
      { label: "产情分析", route: "#/产情监测/产情分析" },
    ],
  },
  {
    label: "市场监测",
    items: [
      { label: "物流节点监测", route: "#/市场监测/物流节点监测" },
      { label: "市场分析", route: "#/市场监测/市场分析" },
    ],
  },
  {
    label: "供需分析",
    items: [{ label: "供需平衡", route: "#/供需分析/供需平衡" }],
  },
  {
    label: "报表中心",
    items: [
      { label: "业务报告", route: "#/报表中心/业务报告" },
      { label: "综合报告", route: "#/报表中心/综合报告" },
    ],
  },
];

function navigate(route: string) {
  window.location.hash = route.slice(1);
}

export interface ProductNavigationItem {
  id: string;
  name: string;
}

export function EnterpriseShell({
  activeProductId,
  children,
  onProductSelect,
  products = [],
}: {
  activeProductId?: string;
  children: ReactNode;
  onProductSelect?: (productId: string) => void;
  products?: readonly ProductNavigationItem[];
}) {
  const activePath = window.location.hash.split("?", 1)[0] ?? "";

  return (
    <div className="enterprise-app-shell">
      <header className="enterprise-header">
        <button
          aria-label="返回市场采集首页"
          className="enterprise-brand"
          type="button"
        >
          <span>齐</span>
          <strong>齐齐哈尔粮食商情企业平台</strong>
        </button>
        <nav aria-label="业务应用" className="enterprise-top-nav">
          {topApplications.map((application) => {
            const active =
              application === "我的工作"
                ? activePath.startsWith("#/work/")
                : activePath.includes(application);
            return (
              <button
                aria-current={active ? "page" : undefined}
                className={active ? "is-active" : ""}
                key={application}
                type="button"
              >
                {application}
              </button>
            );
          })}
        </nav>
        <button className="enterprise-unit" type="button">
          <span aria-hidden="true">⌂</span>
          经营部本部
        </button>
        <label className="enterprise-global-search">
          <span aria-hidden="true">⌕</span>
          <input aria-label="全局搜索" placeholder="搜索地区、企业、任务和报告" />
        </label>
        <div className="enterprise-user-tools">
          <button type="button">待办</button>
          <button type="button">
            通知<sup>2</sup>
          </button>
          <button type="button">帮助</button>
          <button aria-label="系统设置" type="button">
            设置
          </button>
          <button
            aria-label="个人账户：王洋"
            className="enterprise-account"
            type="button"
          >
            <span>王</span>王洋⌄
          </button>
        </div>
      </header>

      <div className="enterprise-body">
        <aside className="enterprise-sidebar">
          <nav aria-label="业务目录">
            <strong className="enterprise-sidebar-title">业务目录</strong>
            {navigationGroups.map((group) => (
              <section key={group.label}>
                <h2>▾ {group.label}</h2>
                {group.items.map((item) => (
                  <button
                    aria-current={activePath === item.route ? "page" : undefined}
                    className={activePath === item.route ? "is-active" : ""}
                    key={item.route}
                    onClick={() => navigate(item.route)}
                    type="button"
                  >
                    {item.label}
                  </button>
                ))}
              </section>
            ))}
            {products.length > 0 && (
              <section>
                <h2>▾ 质量指标</h2>
                {products.map((product) => (
                  <button
                    aria-current={activeProductId === product.id ? "page" : undefined}
                    className={activeProductId === product.id ? "is-active" : ""}
                    key={product.id}
                    onClick={() => onProductSelect?.(product.id)}
                    type="button"
                  >
                    {product.name}质量指标
                  </button>
                ))}
              </section>
            )}
          </nav>
        </aside>
        <main className="enterprise-main">{children}</main>
      </div>
    </div>
  );
}
