const accountMenus = [
  ["用户名", "王洋"],
  ["所属单位", "经营部本部"],
  ["角色", "企业管理员"],
  ["上次登录", "2026-08-07 09:20（中国标准时间）"],
];

export function AccountPage() {
  return (
    <main className="ledger-panel">
      <header className="page-heading">
        <p>个人中心</p>
        <h1>账号与个人资料</h1>
        <span>当前登录态保持在前端会话内，切换账号请联系统一身份认证中心。</span>
      </header>
      <section className="ledger-scroll">
        <dl className="detail-grid">
          {accountMenus.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <p className="page-alert">
        正在同步组织权限与审计视图，请等待 15 秒内首次刷新完成。
      </p>
    </main>
  );
}
