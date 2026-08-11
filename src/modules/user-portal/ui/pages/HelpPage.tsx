export function HelpPage() {
  return (
    <main className="ledger-panel">
      <header className="page-heading">
        <p>帮助中心</p>
        <h1>平台使用手册</h1>
        <span>
          汇总了市场、产情、物流和供需业务流程；请先完成对应模块授权再进入填报。
        </span>
      </header>
      <section className="ledger-scroll">
        <article className="reporting-preview">
          <h2>一、业务链路</h2>
          <ol>
            <li>先从「市场监测」「产情监测」完成采集与提交。</li>
            <li>随后再由审批角色发起审核与退回。</li>
            <li>物流、供需平衡模块以核定数据联动并自动同步。</li>
          </ol>
        </article>
        <article className="reporting-preview">
          <h2>二、同步与联动</h2>
          <p>
            页面仅展示来自服务端的业务定义与审批结果；如果发现列表或卡片停滞，请先刷新页面重新建立长轮询。
          </p>
        </article>
      </section>
    </main>
  );
}
