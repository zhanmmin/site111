(() => {
  const isAdminRoute = /^\/admin\/?$/i.test(window.location.pathname || "") || new URLSearchParams(window.location.search).get("admin") === "1";
  if (!isAdminRoute) return;

  const adminData = {
    contentFilter: "all",
    search: "",
    settings: { reviewScan: true, callbackGuard: true, maintenance: false },
    contents: [
      { id: "PC-240805-0108", title: "摄影师通行码", creator: "夜航者", type: "密码文字", price: 18, status: "待审核", risk: "低风险", submitted: "今天 17:47" },
      { id: "PC-240805-0107", title: "城市黄昏摄影作品集", creator: "林间照相馆", type: "图片", price: 29.9, status: "待审核", risk: "低风险", submitted: "今天 16:31" },
      { id: "PC-240805-0106", title: "旅行路线与地图", creator: "远方计划", type: "网址 / 文字", price: 9.9, status: "已通过", risk: "低风险", submitted: "今天 15:02" },
      { id: "PC-240805-0105", title: "夏日人像双图", creator: "Kite Studio", type: "双图", price: 39, status: "已通过", risk: "低风险", submitted: "今天 13:26" },
      { id: "PC-240805-0104", title: "未成年人相关内容", creator: "匿名创作者", type: "图片", price: 18, status: "已驳回", risk: "高风险", submitted: "昨天 21:10" },
      { id: "PC-240805-0103", title: "摄影后期预设包", creator: "光影实验室", type: "网址 / 文字", price: 49, status: "已通过", risk: "低风险", submitted: "昨天 18:44" },
      { id: "PC-240805-0102", title: "私享采访录音", creator: "声音档案", type: "网址 / 文字", price: 12, status: "待审核", risk: "需复核", submitted: "昨天 16:08" },
      { id: "PC-240805-0101", title: "春日花园", creator: "木棉影像", type: "图片", price: 15, status: "已通过", risk: "低风险", submitted: "昨天 11:28" },
    ],
    users: [
      { name: "夜航者", email: "hello@lumenpass.com", contents: 12, revenue: 8240.6, lastActive: "刚刚", status: "正常" },
      { name: "林间照相馆", email: "studio@linjian.cn", contents: 8, revenue: 5168, lastActive: "6 分钟前", status: "正常" },
      { name: "远方计划", email: "hello@farplan.co", contents: 5, revenue: 2810.4, lastActive: "32 分钟前", status: "正常" },
      { name: "匿名创作者", email: "creator_2048@example.com", contents: 2, revenue: 96, lastActive: "昨天", status: "限制中" },
      { name: "Kite Studio", email: "team@kite.studio", contents: 19, revenue: 12680, lastActive: "昨天", status: "正常" },
    ],
    orders: [
      { id: "LP-240805-0328", buyer: "晚风与鲸", content: "城市黄昏摄影作品集", creator: "林间照相馆", amount: 29.9, status: "已支付", time: "今天 17:52" },
      { id: "LP-240805-0327", buyer: "山止川行", content: "摄影后期预设包", creator: "光影实验室", amount: 49, status: "已支付", time: "今天 17:38" },
      { id: "LP-240805-0326", buyer: "Echo", content: "旅行路线与地图", creator: "远方计划", amount: 9.9, status: "待结算", time: "今天 17:19" },
      { id: "LP-240805-0325", buyer: "北岛信物", content: "夏日人像双图", creator: "Kite Studio", amount: 39, status: "已退款", time: "今天 16:46" },
      { id: "LP-240805-0324", buyer: "三时四刻", content: "春日花园", creator: "木棉影像", amount: 15, status: "已支付", time: "今天 16:02" },
    ],
  };

  let adminScreen = "overview";
  let authenticated = false;

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const money = (value) => `¥ ${Number(value || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const statusClass = (value) => /待审核|待结算|需复核/.test(value) ? "pending" : /驳回|退款|限制|高风险/.test(value) ? "danger" : "success";
  const iconForType = (value) => ({ 图片: "ph-image", 双图: "ph-images", "网址 / 文字": "ph-link", 密码文字: "ph-key" }[value] || "ph-file-text");

  function showAdminToast(message) {
    const toast = document.querySelector("#admin-toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(showAdminToast.timer);
    showAdminToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
  }

  function renderAdminLogin(error = "") {
    document.body.className = "admin-login-body";
    document.body.innerHTML = `<main class="admin-login-shell"><div class="admin-login-brand"><span class="brand-symbol"><i class="ph ph-sparkle"></i></span><div><strong>Lumen Pass</strong><small>ADMIN CONSOLE</small></div></div><section class="admin-login-card"><span class="eyebrow">ADMIN ACCESS</span><h1>管理员登录</h1><p>进入网站运营后台，管理内容审核、创作者和交易风险。</p><form id="admin-login-form"><label class="form-label">管理员邮箱<input name="email" type="email" autocomplete="username" placeholder="admin@lumenpass.com" required /></label><label class="form-label">登录密码<input name="password" type="password" autocomplete="current-password" placeholder="请输入管理员密码" required /></label>${error ? `<p class="admin-form-error" role="alert"><i class="ph ph-warning-circle"></i>${escapeHtml(error)}</p>` : ""}<button class="button button-primary full-width" type="submit"><i class="ph ph-sign-in"></i> 进入管理后台</button></form><p class="admin-login-note"><i class="ph ph-info"></i> 演示账号：admin@lumenpass.com / admin123</p></section><a class="admin-login-back" href="/"><i class="ph ph-arrow-left"></i> 返回创作者后台</a></main>`;
  }

  function adminNavigation() {
    const items = [
      ["overview", "ph-squares-four", "运营总览"],
      ["content", "ph-shield-check", "内容审核", adminData.contents.filter((item) => item.status === "待审核").length],
      ["users", "ph-users-three", "用户管理"],
      ["orders", "ph-receipt", "交易与风控"],
      ["settings", "ph-sliders-horizontal", "系统设置"],
    ];
    return items.map(([id, icon, label, badge]) => `<button class="admin-nav-item ${adminScreen === id ? "is-active" : ""}" type="button" data-admin-screen="${id}"><i class="ph ${icon}"></i><span>${label}</span>${badge ? `<b>${badge}</b>` : ""}</button>`).join("");
  }

  function renderAdminShell() {
    document.body.className = "admin-route-body";
    document.body.innerHTML = `<div class="admin-shell"><header class="admin-topbar"><a class="admin-brand" href="/" aria-label="返回创作者后台"><span class="brand-symbol"><i class="ph ph-sparkle"></i></span><span><strong>Lumen Pass</strong><small>ADMIN CONSOLE</small></span></a><div class="admin-topbar-meta"><span class="admin-health"><i class="ph ph-check-circle"></i> 系统运行正常</span><span class="admin-role">网站管理员</span><span class="admin-avatar">A</span><button class="admin-icon-button" type="button" data-admin-action="logout-admin" aria-label="退出管理员登录"><i class="ph ph-sign-out"></i></button></div></header><div class="admin-layout"><aside class="admin-sidebar"><div class="admin-sidebar-heading"><span>运营中心</span><small>OPERATIONS</small></div><nav class="admin-nav" aria-label="管理员导航">${adminNavigation()}</nav><div class="admin-sidebar-footer"><i class="ph ph-shield-check"></i><div><strong>安全策略已启用</strong><span>所有管理操作都会记录</span></div></div></aside><main class="admin-main" id="admin-main"></main></div><div class="admin-toast" id="admin-toast" role="status" aria-live="polite"></div></div>`;
    renderAdminScreen();
  }

  function renderOverview() {
    return `<div class="admin-page-heading"><div><span class="eyebrow">OPERATIONS OVERVIEW</span><h1>运营总览</h1><p>掌握平台内容、创作者、交易与风险状态。</p></div><div class="admin-heading-actions"><button class="button button-outline" type="button" data-admin-action="export-report"><i class="ph ph-download-simple"></i> 导出运营报表</button><button class="button button-primary" type="button" data-admin-screen="content"><i class="ph ph-shield-check"></i> 查看待审核</button></div></div><div class="admin-stat-grid"><article class="admin-stat-card is-revenue"><span>平台交易额</span><strong>${money(128460.8)}</strong><small><i class="ph ph-arrow-up-right"></i> 较上月增长 18.6%</small></article><article class="admin-stat-card"><span>活跃创作者</span><strong>428</strong><small><i class="ph ph-arrow-up-right"></i> 本月新增 36 位</small></article><article class="admin-stat-card"><span>待审核内容</span><strong>${adminData.contents.filter((item) => item.status === "待审核").length}</strong><small>平均处理时长 18 分钟</small></article><article class="admin-stat-card"><span>待处理举报</span><strong>5</strong><small class="is-warning"><i class="ph ph-warning"></i> 2 条高优先级</small></article></div><div class="admin-overview-grid"><section class="admin-panel admin-revenue-panel"><div class="admin-panel-heading"><div><span class="eyebrow">GMV TREND</span><h2>平台交易趋势</h2><p>最近 30 天 · 已支付订单</p></div><span class="admin-panel-value">${money(128460.8)}</span></div><div class="admin-chart"><div class="admin-chart-bars">${[38, 52, 44, 67, 56, 75, 64, 86, 72, 94, 78, 88].map((height) => `<span style="height:${height}%"></span>`).join("")}</div><div class="admin-chart-axis"><span>07/07</span><span>07/14</span><span>07/21</span><span>07/28</span><span>08/05</span></div></div></section><section class="admin-panel admin-task-panel"><div class="admin-panel-heading"><div><span class="eyebrow">ACTION CENTER</span><h2>待处理事项</h2></div><i class="ph ph-list-check admin-panel-icon"></i></div><div class="admin-task-list"><button type="button" data-admin-screen="content"><span class="admin-task-dot pending"></span><div><strong>内容审核</strong><small>${adminData.contents.filter((item) => item.status === "待审核").length} 条内容等待处理</small></div><i class="ph ph-arrow-right"></i></button><button type="button" data-admin-screen="users"><span class="admin-task-dot danger"></span><div><strong>用户风险复核</strong><small>2 个账号需要进一步核验</small></div><i class="ph ph-arrow-right"></i></button><button type="button" data-admin-screen="orders"><span class="admin-task-dot success"></span><div><strong>结算对账</strong><small>今天 18:00 自动生成</small></div><i class="ph ph-arrow-right"></i></button></div></section></div><section class="admin-panel admin-activity-panel"><div class="admin-panel-heading"><div><span class="eyebrow">RECENT ACTIVITY</span><h2>最近动态</h2></div><button class="admin-text-button" type="button" data-admin-action="view-audit-log">查看操作日志 <i class="ph ph-arrow-right"></i></button></div><div class="admin-activity-list"><div><span class="admin-activity-icon"><i class="ph ph-check-circle"></i></span><p><strong>林间照相馆</strong> 的内容《城市黄昏摄影作品集》已提交审核</p><time>6 分钟前</time></div><div><span class="admin-activity-icon"><i class="ph ph-user-plus"></i></span><p>新创作者 <strong>Kite Studio</strong> 完成邮箱验证</p><time>18 分钟前</time></div><div><span class="admin-activity-icon"><i class="ph ph-credit-card"></i></span><p>平台完成一笔 <strong>${money(49)}</strong> 的订单结算</p><time>32 分钟前</time></div></div></section>`;
  }

  function renderContentReview() {
    const filters = [["all", "全部"], ["pending", "待审核"], ["approved", "已通过"], ["rejected", "已驳回"]];
    const query = adminData.search.toLowerCase();
    const rows = adminData.contents.filter((item) => {
      const matchFilter = adminData.contentFilter === "all" || (adminData.contentFilter === "pending" && item.status === "待审核") || (adminData.contentFilter === "approved" && item.status === "已通过") || (adminData.contentFilter === "rejected" && item.status === "已驳回");
      const matchQuery = !query || `${item.title} ${item.creator} ${item.id}`.toLowerCase().includes(query);
      return matchFilter && matchQuery;
    });
    return `<div class="admin-page-heading"><div><span class="eyebrow">CONTENT MODERATION</span><h1>内容审核</h1><p>审核创作者发布内容，处理风险标记与平台举报。</p></div><div class="admin-heading-actions"><button class="button button-outline" type="button" data-admin-action="export-content"><i class="ph ph-download-simple"></i> 导出审核记录</button></div></div><div class="admin-review-summary"><div><span>待审核</span><strong>${adminData.contents.filter((item) => item.status === "待审核").length}</strong></div><div><span>今日已通过</span><strong>24</strong></div><div><span>需复核风险</span><strong>2</strong></div><div><span>平均处理</span><strong>18<span> min</span></strong></div></div><section class="admin-panel admin-table-panel"><div class="admin-table-toolbar"><div class="admin-filter-list">${filters.map(([id, label]) => `<button class="admin-filter-chip ${adminData.contentFilter === id ? "is-active" : ""}" type="button" data-admin-filter="${id}">${label}</button>`).join("")}</div><form class="admin-search" id="admin-content-search"><i class="ph ph-magnifying-glass"></i><input name="query" value="${escapeHtml(adminData.search)}" placeholder="搜索内容、创作者或 ID" aria-label="搜索内容" /><button type="submit">搜索</button></form></div><div class="admin-table admin-content-table"><div class="admin-table-head"><span>内容</span><span>创作者</span><span>售价</span><span>风险</span><span>提交时间</span><span>状态</span><span>操作</span></div>${rows.length ? rows.map((item) => `<div class="admin-table-row"><div class="admin-content-name"><span class="admin-content-icon"><i class="ph ${iconForType(item.type)}"></i></span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.id)} · ${escapeHtml(item.type)}</small></div></div><span>${escapeHtml(item.creator)}</span><b>${money(item.price)}</b><span class="admin-status-badge ${statusClass(item.risk)}"><i class="ph ${item.risk === "低风险" ? "ph-check-circle" : "ph-warning"}"></i>${escapeHtml(item.risk)}</span><span>${escapeHtml(item.submitted)}</span><span class="admin-status-badge ${statusClass(item.status)}">${escapeHtml(item.status)}</span><div class="admin-row-actions">${item.status === "待审核" ? `<button type="button" data-admin-action="approve-content" data-content-id="${item.id}">通过</button><button class="is-danger" type="button" data-admin-action="reject-content" data-content-id="${item.id}">驳回</button>` : ""}<button type="button" data-admin-action="view-content" data-content-id="${item.id}">查看</button></div></div>`).join("") : `<div class="admin-empty"><i class="ph ph-folder-open"></i><strong>没有匹配的内容</strong><span>切换筛选条件或调整搜索关键词。</span></div>`}</div></section>`;
  }

  function renderUsers() {
    return `<div class="admin-page-heading"><div><span class="eyebrow">CREATOR MANAGEMENT</span><h1>用户管理</h1><p>管理创作者账号、内容规模和平台收入贡献。</p></div><div class="admin-heading-actions"><button class="button button-outline" type="button" data-admin-action="export-users"><i class="ph ph-download-simple"></i> 导出用户</button><button class="button button-primary" type="button" data-admin-action="invite-creator"><i class="ph ph-user-plus"></i> 邀请创作者</button></div></div><div class="admin-stat-grid admin-user-stats"><article class="admin-stat-card"><span>注册创作者</span><strong>1,284</strong><small><i class="ph ph-arrow-up-right"></i> 本月新增 86 位</small></article><article class="admin-stat-card"><span>已认证账号</span><strong>936</strong><small>认证率 72.9%</small></article><article class="admin-stat-card"><span>正常运营</span><strong>1,247</strong><small>占全部创作者 97.1%</small></article><article class="admin-stat-card"><span>限制中</span><strong>37</strong><small class="is-warning"><i class="ph ph-warning"></i> 需要持续关注</small></article></div><section class="admin-panel admin-table-panel"><div class="admin-panel-heading"><div><span class="eyebrow">CREATORS</span><h2>创作者列表</h2><p>账号状态和收入数据实时同步</p></div><form class="admin-search admin-search-compact" id="admin-user-search"><i class="ph ph-magnifying-glass"></i><input name="query" placeholder="搜索姓名或邮箱" aria-label="搜索创作者" /><button type="submit">搜索</button></form></div><div class="admin-table admin-user-table"><div class="admin-table-head"><span>创作者</span><span>内容数</span><span>累计收入</span><span>最近活跃</span><span>状态</span><span>操作</span></div>${adminData.users.map((user) => `<div class="admin-table-row"><div class="admin-user-name"><span class="admin-user-avatar">${escapeHtml(user.name.slice(0, 1))}</span><div><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.email)}</small></div></div><span>${user.contents} 条</span><b>${money(user.revenue)}</b><span>${escapeHtml(user.lastActive)}</span><span class="admin-status-badge ${statusClass(user.status)}">${escapeHtml(user.status)}</span><div class="admin-row-actions"><button type="button" data-admin-action="view-user" data-user-name="${escapeHtml(user.name)}">查看</button>${user.status === "正常" ? `<button class="is-danger" type="button" data-admin-action="suspend-user" data-user-name="${escapeHtml(user.name)}">限制</button>` : `<button type="button" data-admin-action="restore-user" data-user-name="${escapeHtml(user.name)}">恢复</button>`}</div></div>`).join("")}</div></section>`;
  }

  function renderOrders() {
    return `<div class="admin-page-heading"><div><span class="eyebrow">PAYMENTS & RISK</span><h1>交易与风控</h1><p>监控平台交易、结算状态和异常退款。</p></div><div class="admin-heading-actions"><button class="button button-outline" type="button" data-admin-action="export-orders"><i class="ph ph-download-simple"></i> 导出交易</button></div></div><div class="admin-stat-grid"><article class="admin-stat-card is-revenue"><span>今日交易额</span><strong>${money(18420.6)}</strong><small><i class="ph ph-arrow-up-right"></i> 共 486 笔支付</small></article><article class="admin-stat-card"><span>待结算金额</span><strong>${money(2408.6)}</strong><small>明日 10:00 自动结算</small></article><article class="admin-stat-card"><span>退款率</span><strong>1.8%</strong><small>低于平台预警线 3%</small></article><article class="admin-stat-card"><span>风控拦截</span><strong>12</strong><small class="is-warning"><i class="ph ph-shield-warning"></i> 今日已拦截</small></article></div><section class="admin-panel admin-table-panel"><div class="admin-panel-heading"><div><span class="eyebrow">RECENT TRANSACTIONS</span><h2>最近交易</h2><p>支付回调已完成签名验证</p></div><button class="admin-text-button" type="button" data-admin-action="view-risk-log">查看风控日志 <i class="ph ph-arrow-right"></i></button></div><div class="admin-table admin-order-table"><div class="admin-table-head"><span>订单号</span><span>买家</span><span>内容 / 创作者</span><span>金额</span><span>时间</span><span>状态</span></div>${adminData.orders.map((order) => `<div class="admin-table-row"><strong class="admin-order-id">${escapeHtml(order.id)}</strong><span>${escapeHtml(order.buyer)}</span><div class="admin-order-content"><strong>${escapeHtml(order.content)}</strong><small>${escapeHtml(order.creator)}</small></div><b>${money(order.amount)}</b><span>${escapeHtml(order.time)}</span><span class="admin-status-badge ${statusClass(order.status)}">${escapeHtml(order.status)}</span></div>`).join("")}</div></section>`;
  }

  function renderSettings() {
    const settings = [["reviewScan", "内容自动风险扫描", "新内容进入审核队列前自动识别敏感、侵权和违规风险。", "ph-scan"], ["callbackGuard", "支付回调签名验证", "拒绝伪造支付状态，保护买家授权和创作者收入。", "ph-shield-check"], ["maintenance", "维护模式", "开启后暂停新内容发布，已发布链接和买家访问不受影响。", "ph-wrench"]];
    return `<div class="admin-page-heading"><div><span class="eyebrow">PLATFORM SETTINGS</span><h1>系统设置</h1><p>配置平台级安全策略、审核流程与运营权限。</p></div><div class="admin-heading-actions"><button class="button button-primary" type="button" data-admin-action="save-settings"><i class="ph ph-check"></i> 保存设置</button></div></div><div class="admin-settings-grid"><section class="admin-panel"><div class="admin-panel-heading"><div><span class="eyebrow">SECURITY POLICY</span><h2>安全策略</h2><p>默认应用于全站内容与交易。</p></div><i class="ph ph-shield-check admin-panel-icon"></i></div><div class="admin-toggle-list">${settings.map(([key, label, description, icon]) => `<button class="admin-toggle-row" type="button" data-admin-action="toggle-setting" data-setting-key="${key}" aria-pressed="${adminData.settings[key]}"><span class="admin-toggle-icon"><i class="ph ${icon}"></i></span><span><strong>${label}</strong><small>${description}</small></span><span class="admin-toggle ${adminData.settings[key] ? "is-on" : ""}"><i></i></span></button>`).join("")}</div></section><section class="admin-panel"><div class="admin-panel-heading"><div><span class="eyebrow">ROLE & ACCESS</span><h2>管理员权限</h2><p>当前账号拥有全部平台管理权限。</p></div><i class="ph ph-key admin-panel-icon"></i></div><div class="admin-permission-list"><div><span><i class="ph ph-check-circle"></i> 内容审核与下架</span><b>已启用</b></div><div><span><i class="ph ph-check-circle"></i> 用户账号管理</span><b>已启用</b></div><div><span><i class="ph ph-check-circle"></i> 交易与结算查看</span><b>已启用</b></div><div><span><i class="ph ph-check-circle"></i> 系统策略配置</span><b>已启用</b></div></div></section></div><section class="admin-panel admin-log-panel"><div class="admin-panel-heading"><div><span class="eyebrow">AUDIT LOG</span><h2>最近操作日志</h2></div><button class="admin-text-button" type="button" data-admin-action="view-audit-log">查看全部 <i class="ph ph-arrow-right"></i></button></div><div class="admin-log-list"><div><span class="admin-log-time">今天 17:52</span><span>管理员通过了《摄影后期预设包》的内容审核</span><b>管理员</b></div><div><span class="admin-log-time">今天 17:31</span><span>系统自动拦截一笔异常支付请求</span><b>系统</b></div><div><span class="admin-log-time">今天 16:08</span><span>创作者“匿名创作者”账号被标记为限制中</span><b>管理员</b></div></div></section>`;
  }

  function renderAdminScreen() {
    const target = document.querySelector("#admin-main");
    if (!target) return;
    const views = { overview: renderOverview, content: renderContentReview, users: renderUsers, orders: renderOrders, settings: renderSettings };
    target.innerHTML = (views[adminScreen] || views.overview)();
    document.querySelectorAll("[data-admin-screen]").forEach((button) => button.classList.toggle("is-active", button.dataset.adminScreen === adminScreen));
  }

  function handleAdminSubmit(form) {
    if (form.id === "admin-login-form") {
      const data = new FormData(form);
      const email = String(data.get("email") || "").trim().toLowerCase();
      const password = String(data.get("password") || "");
      if (email !== "admin@lumenpass.com" || password !== "admin123") return renderAdminLogin("管理员邮箱或密码不正确");
      authenticated = true;
      renderAdminShell();
      return;
    }
    if (form.id === "admin-content-search") {
      adminData.search = String(new FormData(form).get("query") || "").trim();
      renderAdminScreen();
      return;
    }
    if (form.id === "admin-user-search") showAdminToast("用户搜索结果已更新");
  }

  function handleAdminAction(action, element) {
    const content = adminData.contents.find((item) => item.id === element.dataset.contentId);
    const user = adminData.users.find((item) => item.name === element.dataset.userName);
    if (action === "logout-admin") { authenticated = false; renderAdminLogin(); return; }
    if (action === "export-report" || action === "export-content" || action === "export-users" || action === "export-orders") { showAdminToast("报表已生成，正在准备下载"); return; }
    if (action === "approve-content" && content) { content.status = "已通过"; renderAdminScreen(); showAdminToast(`已通过《${content.title}》的审核`); return; }
    if (action === "reject-content" && content) { content.status = "已驳回"; renderAdminScreen(); showAdminToast(`已驳回《${content.title}》`); return; }
    if (action === "view-content" && content) { showAdminToast(`已打开《${content.title}》的审核详情`); return; }
    if (action === "suspend-user" && user) { user.status = "限制中"; renderAdminScreen(); showAdminToast(`已限制账号：${user.name}`); return; }
    if (action === "restore-user" && user) { user.status = "正常"; renderAdminScreen(); showAdminToast(`已恢复账号：${user.name}`); return; }
    if (action === "view-user" && user) { showAdminToast(`已打开 ${user.name} 的账号详情`); return; }
    if (action === "invite-creator") { showAdminToast("邀请链接已生成"); return; }
    if (action === "view-audit-log" || action === "view-risk-log") { adminScreen = "settings"; renderAdminScreen(); showAdminToast("已切换到操作日志"); return; }
    if (action === "toggle-setting") { const key = element.dataset.settingKey; if (key) adminData.settings[key] = !adminData.settings[key]; renderAdminScreen(); return; }
    if (action === "save-settings") { showAdminToast("平台设置已保存"); return; }
  }

  document.addEventListener("click", (event) => {
    const screenButton = event.target.closest("[data-admin-screen]");
    if (screenButton) { adminScreen = screenButton.dataset.adminScreen || "overview"; renderAdminScreen(); return; }
    const filterButton = event.target.closest("[data-admin-filter]");
    if (filterButton) { adminData.contentFilter = filterButton.dataset.adminFilter || "all"; renderAdminScreen(); return; }
    const actionButton = event.target.closest("[data-admin-action]");
    if (actionButton) { handleAdminAction(actionButton.dataset.adminAction, actionButton); return; }
  });
  document.addEventListener("submit", (event) => { if (event.target.matches("#admin-login-form, #admin-content-search, #admin-user-search")) { event.preventDefault(); handleAdminSubmit(event.target); } });
  renderAdminLogin();
})();
