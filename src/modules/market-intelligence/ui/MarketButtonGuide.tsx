const controls = [
  [
    "品种 / 全球·中国",
    "品种设置新打开的分析台默认对象；全球与中国同时切换地图视角。概览资料不会被伪装成对应品种的实时数据。",
  ],
  ["2D / 3D", "在平面墨卡托地图与可旋转的立体地球间切换。"],
  [
    "近24小时 / 近7天 / 近30天 / 近90天",
    "设置新打开的分析台默认时段；历史航线和现有月度、每日来源不会因此变为实时轨迹或实时行情。",
  ],
  ["地图＋ / －", "放大或缩小地图，继续放大可查看城市和已提供的道路、铁路参考层。"],
  [
    "底图 / 陆运 / 航运",
    "底图恢复默认显示；陆运显示参考道路与铁路；航运强调历史航线。两类线路都不是实时运力。",
  ],
  [
    "产区 / 港口 / 天气 / 能源 / 政策",
    "相应地理数据尚未接入，按钮暂不可选，避免只有高亮却没有图层。",
  ],
  [
    "右侧栏目 / 指标",
    "切换信息栏，或打开对应指标的独立分析工作台。带“待接入”的指标不显示模拟值。",
  ],
  [
    "直播栏目 / 播放 / 暂停 / 声音 / 全屏 / 设置",
    "筛选已配置视频、控制播放器及管理本机视频链接。没有授权视频源时播放键不可用；播放不会影响自动采集。",
  ],
  [
    "日报 / 周报 / 月报 / 季报 / 年报",
    "下载指定统计周期的 DOCX，内容基于已入库来源并保留来源与缺口说明。",
  ],
  [
    "工具栏 · 人工试算",
    "打开独立计算工具，输入数值后查看公式和结果；它不向实时数据源写入数值。",
  ],
] as const;

export function MarketButtonGuide({ onClose }: { onClose: () => void }) {
  return (
    <div className="mi-button-guide-backdrop" role="presentation" onClick={onClose}>
      <section
        className="mi-button-guide"
        role="dialog"
        aria-modal="true"
        aria-label="商情大屏按键说明"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <small>CONTROL REFERENCE</small>
            <h2>商情大屏按键说明</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭按键说明">
            ×
          </button>
        </header>
        <div className="mi-button-guide-rows">
          {controls.map(([name, description]) => (
            <div key={name}>
              <strong>{name}</strong>
              <p>{description}</p>
            </div>
          ))}
        </div>
        <footer>
          “待接入”表示没有可核验的来源或授权。来源状态显示最近采集结果，不等同交易所实时行情。
        </footer>
      </section>
    </div>
  );
}
