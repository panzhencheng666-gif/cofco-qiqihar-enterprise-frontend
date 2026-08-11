const notifications = [
  {
    title: "审批提示",
    message: "有 1 条供需平衡变更等待复核，点击【我的工作】可查看详情。",
    time: "09:17",
  },
  {
    title: "系统提示",
    message: "市场采集页面于 10 分钟后将进入离线模式，请提前完成本地草稿提交。",
    time: "09:02",
  },
  {
    title: "运维公告",
    message: "调度服务已恢复，全部业务模块可进行历史版本回溯。",
    time: "08:45",
  },
];

export function NotificationsPage() {
  return (
    <main className="ledger-panel">
      <header className="page-heading">
        <p>通知中心</p>
        <h1>待办与系统通知</h1>
      </header>
      <section className="ledger-scroll">
        <ul>
          {notifications.map((item) => (
            <li className="reporting-preview" key={item.title + item.time}>
              <h2>{item.title}</h2>
              <p>{item.message}</p>
              <p>{item.time}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
