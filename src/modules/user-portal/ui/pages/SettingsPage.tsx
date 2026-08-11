const settingGroups = [
  {
    title: "账号安全",
    items: [
      "绑定手机与邮箱",
      "变更登录密码（请通过统一身份认证系统）",
      "查看登录会话与异常登录记录",
    ],
  },
  {
    title: "消息订阅",
    items: ["任务提醒推送", "数据变更通知", "系统公告与维护提醒"],
  },
];

export function SettingsPage() {
  return (
    <main className="ledger-panel">
      <header className="page-heading">
        <p>设置中心</p>
        <h1>系统设置</h1>
        <span>所有设置均在本平台生效，涉及权限与安全的变更需提交审批。</span>
      </header>
      <section className="ledger-scroll">
        {settingGroups.map((group) => (
          <article className="reporting-preview" key={group.title}>
            <h2>{group.title}</h2>
            <ul>
              {group.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </main>
  );
}
