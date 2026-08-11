import type { ReactNode } from "react";

type TopNavigationApplication =
  "产情监测" | "市场监测" | "物流监测" | "供需分析" | "报表中心" | "我的工作";

type UtilityRoute = "help" | "settings" | "account" | "notifications";

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
    label: "总览监测",
    items: [{ label: "粮食商情总览", route: "#/overview" }],
  },
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
      { label: "产情填报", route: "#/production" },
      { label: "产情分析", route: "#/产情监测/产情分析" },
    ],
  },
  {
    label: "市场监测",
    items: [
      { label: "市场采集", route: "#/market" },
      { label: "市场分析", route: "#/市场监测/市场分析" },
    ],
  },
  {
    label: "物流监测",
    items: [{ label: "物流节点监测", route: "#/logistics" }],
  },
  {
    label: "供需分析",
    items: [{ label: "供需平衡", route: "#/supply" }],
  },
  {
    label: "报表中心",
    items: [{ label: "业务报告", route: "#/报表中心/业务报告" }],
  },
];

function navigate(route: string) {
  window.location.hash = route.slice(1);
}

function resolveTopNavigationRoute(
  application: TopNavigationApplication,
  products: readonly ProductNavigationItem[],
) {
  if (application === "产情监测") {
    const productRoute = products[0]
      ? `#/pages/PRODUCTION/MONITORING/${encodeURIComponent(products[0].id)}`
      : "#/pages/PRODUCTION/MONITORING";
    return productRoute;
  }
  if (application === "市场监测") {
    const productRoute = products[0]
      ? `#/pages/MARKET/MONITORING/${encodeURIComponent(products[0].id)}`
      : "#/pages/MARKET/MONITORING";
    return productRoute;
  }
  if (application === "物流监测") {
    const productRoute = products[0]
      ? `#/pages/LOGISTICS/MONITORING/${encodeURIComponent(products[0].id)}`
      : "#/pages/LOGISTICS/MONITORING";
    return productRoute;
  }
  if (application === "供需分析") {
    const productRoute = products[0]
      ? `#/pages/SUPPLY/ACCOUNT/${encodeURIComponent(products[0].id)}`
      : "#/pages/SUPPLY/ACCOUNT";
    return productRoute;
  }
  if (application === "报表中心") {
    return "#/报表中心";
  }
  return "#/work/pending";
}

function isTopNavigationActive(
  application: TopNavigationApplication,
  activePath: string,
) {
  if (application === "我的工作") {
    return activePath.startsWith("#/work/");
  }
  if (application === "报表中心") {
    return activePath.startsWith("#/报表中心");
  }
  if (application === "产情监测") {
    return activePath.includes("PRODUCTION");
  }
  if (application === "市场监测") {
    return activePath.includes("MARKET");
  }
  if (application === "物流监测") {
    return activePath.includes("LOGISTICS");
  }
  return activePath.includes("SUPPLY");
}

function routeForUtility(route: UtilityRoute) {
  return `#/${route}`;
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
  productItemSuffix = "质量指标",
  productNavigationTitle = "质量指标",
}: {
  activeProductId?: string;
  children: ReactNode;
  onProductSelect?: (productId: string) => void;
  products?: readonly ProductNavigationItem[];
  productItemSuffix?: string;
  productNavigationTitle?: string;
}) {
  const activePath = window.location.hash.split("?", 1)[0] ?? "";

  return (
    <div className="enterprise-app-shell">
      <header className="enterprise-header">
        <button
          aria-label="返回市场采集首页"
          className="enterprise-brand"
          onClick={() => navigate("#/overview")}
          type="button"
        >
          <span>齐</span>
          <strong>齐齐哈尔粮食商情企业平台</strong>
        </button>
        <nav aria-label="业务应用" className="enterprise-top-nav">
          {topApplications.map((application) => {
            const active = isTopNavigationActive(application, activePath);
            const requiresProduct =
              application !== "我的工作" && application !== "报表中心";
            const route = resolveTopNavigationRoute(application, products);
            return (
              <button
                aria-current={active ? "page" : undefined}
                className={active ? "is-active" : ""}
                key={application}
                disabled={requiresProduct && products.length === 0}
                onClick={() => navigate(route)}
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
          <button type="button" onClick={() => navigate("#/work/pending")}>
            待办
          </button>
          <button type="button" onClick={() => navigate("#/notifications")}>
            通知<sup>2</sup>
          </button>
          <button type="button" onClick={() => navigate(routeForUtility("help"))}>
            帮助
          </button>
          <button
            aria-label="系统设置"
            onClick={() => navigate(routeForUtility("settings"))}
            type="button"
          >
            设置
          </button>
          <button
            aria-label="个人账户：王洋"
            className="enterprise-account"
            onClick={() => navigate(routeForUtility("account"))}
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
                {group.items.map((item) => {
                  const route =
                    item.route === "#/production" && products[0]
                      ? `#/pages/PRODUCTION/MONITORING/${encodeURIComponent(products[0].id)}`
                      : item.route === "#/market" && products[0]
                        ? `#/pages/MARKET/MONITORING/${encodeURIComponent(products[0].id)}`
                        : item.route === "#/logistics" && products[0]
                          ? `#/pages/LOGISTICS/MONITORING/${encodeURIComponent(products[0].id)}`
                          : item.route === "#/supply" && products[0]
                            ? `#/pages/SUPPLY/ACCOUNT/${encodeURIComponent(products[0].id)}`
                            : item.route;
                  return (
                    <button
                      aria-current={activePath === route ? "page" : undefined}
                      className={activePath === route ? "is-active" : ""}
                      disabled={
                        [
                          "#/production",
                          "#/market",
                          "#/logistics",
                          "#/supply",
                        ].includes(item.route) && !products[0]
                      }
                      key={item.route}
                      onClick={() => navigate(route)}
                      type="button"
                    >
                      {item.label}
                    </button>
                  );
                })}
              </section>
            ))}
            {products.length > 0 && (
              <section>
                <h2>▾ {productNavigationTitle}</h2>
                {products.map((product) => (
                  <button
                    aria-current={activeProductId === product.id ? "page" : undefined}
                    className={activeProductId === product.id ? "is-active" : ""}
                    key={product.id}
                    onClick={() => onProductSelect?.(product.id)}
                    type="button"
                  >
                    {product.name}
                    {productItemSuffix}
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
