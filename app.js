const STORAGE_KEY = "lumen-pass-demo-v1";
const ASSET_ROOT = window.location.protocol === "file:" ? "" : `${window.location.origin}/`;

const seedState = {
  screen: "content",
  orderFilter: "all",
  analyticsPeriod: "30",
  mode: "image",
  rule: "window",
  title: "光的形状",
  note: "感谢你的支持，这份内容耗费了很多心血。希望它能为你带来启发与价值。",
  price: "18.00",
  link: "https://lumenpass.com/p/7x9kL2",
  linkContent: "https://example.com/creator-brief",
  textContent: "城市黄昏摄影作品集\n\n感谢你的支持，愿你在每一次按下快门时，都能看见自己的答案。",
  sensitiveText: "LUMEN-2026\n授权码：N8QF-72KX-PA4M\n有效期：支付后 2 小时",
  published: true,
  contents: [],
  profile: { displayName: "夜航者", email: "hello@lumenpass.com", bio: "记录光线、城市与被认真对待的内容。" },
  security: { callbackSignature: true, sensitiveCopy: true, scanUploads: true },
  payouts: [
    { date: "2026 年 08 月 01 日", amount: "1,860.00", status: "已到账", method: "微信支付" },
    { date: "2026 年 07 月 18 日", amount: "2,140.60", status: "已到账", method: "微信支付" },
  ],
  orders: [
    { id: "LP-240803-0012", customer: "晚风与鲸", content: "光的形状 · 图片", amount: "9.90", time: "2 分钟前", status: "paid", initial: "晚" },
    { id: "LP-240803-0011", customer: "山止川行", content: "私享文章 · 网址", amount: "19.90", time: "18 分钟前", status: "paid", initial: "山" },
    { id: "LP-240803-0010", customer: "Echo", content: "航拍合集 · 密码文字", amount: "29.90", time: "1 小时前", status: "paid", initial: "E" },
    { id: "LP-240803-0009", customer: "北岛信物", content: "光的形状 · 图片", amount: "9.90", time: "2 小时前", status: "paid", initial: "北" },
    { id: "LP-240803-0008", customer: "三时四刻", content: "私享文章 · 文字", amount: "19.90", time: "3 小时前", status: "pending", initial: "三" },
  ],
};

const modeLabels = {
  image: { label: "图片", title: "光的形状", description: "支付后查看完整高清图片" },
  dual: { label: "双图", title: "城市黄昏摄影作品集", description: "支付前后展示不同图片" },
  link: { label: "网址 / 文字", title: "创作者私享文章", description: "支付后打开网址或显示普通文字" },
  sensitive: { label: "密码文字", title: "摄影师通行码", description: "支付后查看密码、提取码或授权文字" },
};

const PUBLIC_CONTENT_ID = getPublicContentId();
let state = loadState();
if (PUBLIC_CONTENT_ID) {
  const sharedContent = state.contents?.find((content) => content.id === PUBLIC_CONTENT_ID);
  if (sharedContent) {
    state = { ...state, ...sharedContent, link: publicLinkFor(PUBLIC_CONTENT_ID) };
  } else if (getPublicLinkId(state.link) !== PUBLIC_CONTENT_ID) {
    state = structuredClone(seedState);
    state.link = publicLinkFor(PUBLIC_CONTENT_ID);
  }
}
let visitorState = "unpaid";
let visitorTimer = null;
let toastTimer = null;
let copyFallbackTimer = null;
let createMode = state.mode;
let editingContentId = null;

function $(selector, scope = document) { return scope.querySelector(selector); }
function $$(selector, scope = document) { return [...scope.querySelectorAll(selector)]; }
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    const nextState = saved ? { ...structuredClone(seedState), ...saved } : structuredClone(seedState);
    nextState.profile = { ...seedState.profile, ...(saved?.profile || {}) };
    nextState.security = { ...seedState.security, ...(saved?.security || {}) };
    nextState.payouts = Array.isArray(saved?.payouts) ? saved.payouts : structuredClone(seedState.payouts);
    nextState.link = publicLinkFor(getPublicLinkId(nextState.link) || "7x9kL2");
    return nextState;
  } catch (error) {
    const nextState = structuredClone(seedState);
    nextState.link = publicLinkFor("7x9kL2");
    return nextState;
  }
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (error) { /* local demo can continue without persistence */ }
}

function formatMoney(value) {
  const number = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(number) ? number.toFixed(2) : "18.00";
}

function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch (error) {
    return "";
  }
}

function getPublicContentId(location = window.location) {
  const pathMatch = String(location.pathname || "").match(/^\/p\/([^/]+)\/?$/i);
  if (pathMatch) return decodeURIComponent(pathMatch[1]);
  return new URLSearchParams(location.search || "").get("p")?.trim() || "";
}

function getPublicLinkId(value) {
  const match = String(value || "").match(/\/p\/([^/?#]+)/i);
  return match ? decodeURIComponent(match[1]) : "";
}

function publicLinkFor(id) {
  const encodedId = encodeURIComponent(String(id || "7x9kL2").trim());
  if (window.location.protocol === "file:") return `./?p=${encodedId}`;
  return `${window.location.origin}/p/${encodedId}`;
}

const contentModeIcons = { image: "ph-image", dual: "ph-images", link: "ph-link", sensitive: "ph-key" };

function syncCurrentContentRecord() {
  if (!Array.isArray(state.contents)) state.contents = [];
  const id = getPublicLinkId(state.link) || "7x9kL2";
  const existing = state.contents.find((content) => content.id === id);
  const record = {
    id,
    title: state.title,
    mode: state.mode,
    price: formatMoney(state.price),
    rule: state.rule,
    note: state.note,
    link: publicLinkFor(id),
    linkContent: state.linkContent || "",
    textContent: state.textContent || "",
    sensitiveText: state.sensitiveText || "",
    status: "published",
    updated: "刚刚",
    views: existing?.views || 0,
    sales: existing?.sales || 0,
  };
  if (existing) Object.assign(existing, record);
  else state.contents.unshift(record);
  state.link = record.link;
}

function findContentById(id) {
  return state.contents?.find((content) => content.id === id);
}

function applyContentRecord(content) {
  if (!content) return;
  state.mode = content.mode;
  state.title = content.title;
  state.price = formatMoney(content.price);
  state.rule = content.rule || "window";
  state.note = content.note || "";
  state.link = publicLinkFor(content.id);
  state.linkContent = content.linkContent || "";
  state.textContent = content.textContent || "";
  state.sensitiveText = content.sensitiveText || "";
  state.published = content.status !== "draft";
}

function renderContentLibrary() {
  const target = $("#content-library");
  if (!target) return;
  const contents = Array.isArray(state.contents) ? state.contents : [];
  if (!contents.length) {
    target.innerHTML = '<div class="content-library-empty"><i class="ph ph-folder-open"></i><strong>还没有已发布内容</strong><span>创建第一条内容后，公开链接和状态会显示在这里。</span><button class="button button-outline" type="button" data-action="open-create">新建内容</button></div>';
    return;
  }
  target.innerHTML = contents.map((content) => {
    const mode = modeLabels[content.mode] || modeLabels.image;
    const icon = contentModeIcons[content.mode] || contentModeIcons.image;
    return '<article class="content-library-row"><div class="content-library-main"><span class="content-library-icon"><i class="ph ' + icon + '"></i></span><div><strong>' + escapeHtml(content.title) + '</strong><span>' + escapeHtml(content.id) + ' · 更新于 ' + escapeHtml(content.updated || "刚刚") + '</span></div></div><span class="content-library-mode"><i class="ph ' + icon + '"></i>' + escapeHtml(mode.label) + '</span><strong class="content-library-price">¥ ' + escapeHtml(formatMoney(content.price)) + '<small>' + escapeHtml(String(content.sales || 0)) + ' 次支付</small></strong><span class="content-library-status"><i class="ph ph-check-circle"></i> 已发布</span><div class="content-library-actions"><button type="button" data-action="edit-content" data-content-id="' + escapeHtml(content.id) + '">编辑</button><button type="button" data-action="open-public-link" data-content-id="' + escapeHtml(content.id) + '">打开</button><button type="button" data-action="copy-content-link" data-content-id="' + escapeHtml(content.id) + '">复制链接</button></div></article>';
  }).join("");
}

function assetUrl(path) {
  const normalizedPath = String(path).replace(/^\/+/, "");
  return `${ASSET_ROOT}${normalizedPath}`;
}

function qrUrl() {
  return assetUrl("assets/qr-public.png");
}

function getRuleLabel(rule = state.rule) {
  return { window: "支付后可查看", once: "仅查看一次", "two-hours": "2 小时有效" }[rule] || "支付后可查看";
}

function getExpiryLabel() {
  if (state.rule === "once") return "查看一次后失效";
  if (state.rule === "two-hours") return "支付后 2 小时有效";
  return "授权有效期 2 小时";
}

function modeMediaContent(viewState, compact = false) {
  const paid = viewState === "paid";
  const expired = viewState === "expired";
  const text = state.mode === "sensitive" ? "已加密的敏感内容" : state.mode === "link" ? "支付后查看完整内容" : "支付后查看完整图片";
  const icon = state.mode === "sensitive" ? "ph-key" : state.mode === "link" ? "ph-link" : "ph-lock-key";
  if (paid && !expired && state.mode === "sensitive") {
    return `<div class="unlock-content is-visible"><div class="unlock-meta"><span><i class="ph ph-shield-check"></i> 安全授权内容</span><button class="copy-button" type="button" data-action="copy-sensitive"><i class="ph ph-copy"></i> 一键复制</button></div><pre>${escapeHtml(state.sensitiveText)}</pre></div>`;
  }
  if (paid && !expired && state.mode === "link") {
    const link = safeHttpUrl(state.linkContent);
    if (link) return `<div class="unlock-content is-visible"><div class="unlock-meta"><span><i class="ph ph-check-circle"></i> 已解锁普通内容</span><button class="copy-button" type="button" data-action="open-content"><i class="ph ph-arrow-up-right"></i> 安全打开</button></div><a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link)}</a></div>`;
    return `<div class="unlock-content is-visible"><div class="unlock-meta"><span><i class="ph ph-check-circle"></i> 已解锁普通文字</span><button class="copy-button" type="button" data-action="copy-text-content"><i class="ph ph-copy"></i> 一键复制</button></div><pre>${escapeHtml(state.textContent || "文字内容已解锁")}</pre></div>`;
  }
  if (paid && !expired && state.mode === "dual") {
    return `<div class="unlock-content is-visible"><div class="unlock-meta"><span><i class="ph ph-images"></i> 支付后图片</span><span>高清版本已授权</span></div><p class="unlock-message">第二张图片已解锁，可在授权有效期内查看。</p></div>`;
  }
  if (paid && !expired) {
    return `<div class="unlock-content is-visible"><div class="unlock-meta"><span><i class="ph ph-image"></i> 高清原图已解锁</span><span>安全授权中</span></div><p class="unlock-message">原始内容已准备好，当前页面仅展示本地演示状态。</p></div>`;
  }
  if (expired) return `<div class="expired-panel"><i class="ph ph-clock-countdown"></i><strong>授权已过期</strong><span>重新支付后可再次查看内容</span></div>`;
  return `<div class="lock-center ${compact ? "compact" : ""}"><i class="ph ${icon}"></i><strong>${escapeHtml(expired ? "授权已过期" : "未解锁")}</strong><span>${escapeHtml(text)}</span></div>`;
}

function renderPreviewCard(target, viewState = "unpaid", modal = false) {
  const paid = viewState === "paid";
  const expired = viewState === "expired";
  const processing = viewState === "processing";
  const current = modeLabels[state.mode] || modeLabels.image;
  const displayTitle = state.mode === "image" ? state.title : current.title;
  const hasLink = Boolean(safeHttpUrl(state.linkContent));
  const action = paid ? (state.mode === "link" && hasLink ? "安全打开网址" : "内容已解锁") : expired ? "重新支付查看" : processing ? "正在确认支付" : "立即支付查看";
  const actionIcon = paid ? (state.mode === "link" && hasLink ? "ph-arrow-up-right" : "ph-check") : processing ? "ph-spinner-gap" : "ph-credit-card";
  const buttonAction = paid && state.mode === "link" && hasLink ? "open-content" : paid ? "noop" : expired ? "simulate-payment" : "simulate-payment";
  const statusLabel = paid ? "已解锁状态" : expired ? "授权已过期" : processing ? "支付处理中" : "未解锁状态";
  const timeHint = paid ? `<span class="authorization-time"><i class="ph ph-timer"></i> ${getRemainingTime()}</span>` : "";
  const paymentHint = paid
    ? (state.mode === "sensitive" ? "授权文字已显示，仅当前安全会话可见" : state.mode === "link" ? "内容已解锁，可安全打开网址" : "内容已解锁，可在授权有效期内查看")
    : state.mode === "sensitive" ? "支付成功后才会显示密码文字" : state.mode === "link" ? "支付成功后才会显示文字或打开网址" : "支付后立即解锁完整内容";
  const mediaAsset = paid && !expired ? assetUrl("assets/unlocked-preview.png") : assetUrl("assets/locked-preview.png");
  const mediaAlt = paid && !expired ? "已解锁的高清内容" : "受保护的内容预览";
  const mediaOverlay = paid && !expired ? "" : modeMediaContent(viewState, modal);
  const unlockedContent = paid && !expired ? modeMediaContent(viewState, modal) : "";
  const media = `<div class="visitor-media ${paid ? "is-unlocked" : ""} ${expired ? "is-expired" : ""}"><img src="${mediaAsset}" alt="${mediaAlt}" />${mediaOverlay}</div>`;
  const paidNote = paid && state.mode === "sensitive" ? "授权有效，内容仅在本次安全会话中展示。" : state.note;
  target.innerHTML = `<div class="visitor-preview-inner ${modal ? "modal-preview-inner" : ""}">
    <div class="visitor-topline"><span>${modal ? "Lumen Pass 安全内容页" : "买家打开后将看到的页面"}</span><button class="mini-action" type="button" data-action="report-content"><i class="ph ph-flag"></i> 举报</button></div>
    ${media}
    ${unlockedContent}
    <div class="visitor-copy"><span class="creator-label">创作者寄语</span><h2 id="visitor-modal-title">${escapeHtml(displayTitle)}</h2><p>${escapeHtml(paidNote)}</p><div class="visitor-price">¥ ${formatMoney(state.price)}</div>${paid ? `${timeHint}<button class="visitor-action ${state.mode === "link" ? "" : "is-disabled"}" type="button" data-action="${buttonAction}" ${buttonAction === "noop" ? "disabled" : ""}><i class="ph ${actionIcon}"></i> ${action}</button>` : `<button class="visitor-action ${processing ? "is-processing" : ""}" type="button" data-action="${buttonAction}"><i class="ph ${actionIcon}"></i> ${action}</button>`}<div class="secure-hint"><i class="ph ph-shield-check"></i><span>${escapeHtml(paymentHint)} · ${escapeHtml(getExpiryLabel())}</span></div>${!paid && !processing ? `<div class="qr-pay-row"><img src="${qrUrl()}" alt="支付二维码" /><div><strong>使用微信扫一扫支付</strong><span>打开扫一扫，识别二维码</span></div></div>` : ""}${processing && modal ? `<button class="simulate-failure" type="button" data-action="simulate-failure">模拟支付失败</button>` : ""}</div>
    <div class="access-steps"><div class="access-step ${viewState === "unpaid" || viewState === "processing" ? "is-current" : ""}"><span class="step-dot"><i class="ph ph-credit-card"></i></span><span>待支付</span><small>等待买家付款</small></div><div class="access-step ${viewState === "processing" ? "is-current" : ""}"><span class="step-dot"><i class="ph ph-receipt"></i></span><span>已支付</span><small>支付成功</small></div><div class="access-step ${paid ? "is-current" : ""}"><span class="step-dot"><i class="ph ph-lock-open"></i></span><span>可查看</span><small>开始查看内容</small></div><div class="access-step ${expired ? "is-current" : ""}"><span class="step-dot"><i class="ph ph-check"></i></span><span>${expired ? "已过期" : "访问完成"}</span><small>${expired ? "重新支付" : "阅读或访问结束"}</small></div></div>
    ${paid && state.rule === "once" ? `<div class="once-note"><i class="ph ph-eye-slash"></i> 这是一次性授权，关闭页面后将无法再次查看。</div>` : ""}
  </div>`;
}

function renderPublicPreview() {
  renderPreviewCard($("#public-preview"), "unpaid");
  $$(".mode-button").forEach((button) => button.classList.toggle("is-active", button.dataset.mode === state.mode));
  $$(".rule-option").forEach((button) => button.classList.toggle("is-selected", button.dataset.rule === state.rule));
  $("#price-input").value = formatMoney(state.price);
  $("#public-link").value = state.link;
}

function renderPublicRoutePage() {
  const homeLink = window.location.protocol === "file:" ? "./index.html" : `${window.location.origin}/admin`;
  document.body.className = "public-route-body";
  document.body.innerHTML = '<div class="public-route-shell"><header class="public-route-header"><a class="public-route-brand" href="' + escapeHtml(homeLink) + '"><span class="brand-symbol"><i class="ph ph-sparkle"></i></span><span>Lumen Pass</span></a><span class="public-route-status"><i class="ph ph-shield-check"></i> SECURE CONTENT</span></header><main class="public-route-main"><div class="public-route-intro"><span class="eyebrow">PUBLIC CONTENT</span><h1>付费内容</h1><p>完成支付后，即可在当前页面查看创作者授权的完整内容。</p></div><section class="public-route-card" aria-label="付费内容"><div class="public-preview public-route-preview" id="public-route-preview"></div></section><p class="public-route-footnote"><i class="ph ph-lock-key"></i> 本页面由 Lumen Pass 提供安全访问，授权仅对当前内容生效。</p></main></div><div class="toast" id="toast" role="status" aria-live="polite"></div>';
  renderPreviewCard($("#public-route-preview"), visitorState, true);
}

function renderVisitorPage() {
  if (visitorState === "paid" && state.authExpiresAt && Date.now() >= state.authExpiresAt) visitorState = "expired";
  if (PUBLIC_CONTENT_ID) return renderPublicRoutePage();
  renderPreviewCard($("#visitor-page"), visitorState, true);
}

function renderOrders() {
  const filter = state.orderFilter || "all";
  const filteredOrders = filter === "all" ? state.orders : state.orders.filter((order) => order.status === filter);
  $("#order-total").textContent = String(120 + state.orders.length + 3);
  $("#order-table").innerHTML = filteredOrders.length ? filteredOrders.map((order) => `<div class="order-row"><div class="order-customer"><span class="order-avatar">${escapeHtml(order.initial)}</span><div><strong>${escapeHtml(order.customer)}</strong><span>${escapeHtml(order.id)}</span></div></div><span>${escapeHtml(order.content)}</span><b>¥ ${escapeHtml(order.amount)}</b><span>${escapeHtml(order.time)}</span><span class="status-badge ${order.status === "paid" ? "success" : "pending"}"><i class="ph ${order.status === "paid" ? "ph-check-circle" : "ph-hourglass-medium"}></i>${order.status === "paid" ? "已支付" : "处理中"}</span></div>`).join("") : `<div class="table-empty"><i class="ph ph-receipt"></i><strong>没有${filter === "paid" ? "已支付" : "处理中"}订单</strong><span>切换筛选条件后可查看其他交易。</span></div>`;
  $$("[data-order-filter]").forEach((button) => { const active = button.dataset.orderFilter === filter; button.classList.toggle("is-active", active); button.setAttribute("aria-pressed", String(active)); });
}

function getAnalyticsPeriodLabel(period = state.analyticsPeriod) {
  return { "7": "最近 7 天", "30": "最近 30 天", "90": "最近 90 天" }[period] || "最近 30 天";
}

function renderAnalyticsPeriod() {
  const target = $("#analytics-period-label");
  if (target) target.textContent = getAnalyticsPeriodLabel();
  const chart = $("#analytics-chart");
  if (chart) chart.setAttribute("aria-label", getAnalyticsPeriodLabel() + "收入趋势");
}

function renderPayoutHistory() {
  const target = $("#payout-history");
  if (!target) return;
  const payouts = Array.isArray(state.payouts) ? state.payouts : [];
  target.innerHTML = payouts.length ? payouts.map((payout) => `<div class="payout-history-row"><div><strong>${escapeHtml(payout.date)}</strong><span>${escapeHtml(payout.method)}</span></div><b>¥ ${escapeHtml(formatMoney(payout.amount))}</b><span class="status-badge ${payout.status === "已到账" ? "success" : "pending"}"><i class="ph ${payout.status === "已到账" ? "ph-check-circle" : "ph-hourglass-medium"}"></i> ${escapeHtml(payout.status)}</span></div>`).join("") : '<div class="table-empty"><i class="ph ph-wallet"></i><strong>还没有结算记录</strong><span>完成首次提现后，记录会显示在这里。</span></div>';
}

function renderSettings() {
  const profile = state.profile || seedState.profile;
  $("#profile-name").value = profile.displayName || "";
  $("#profile-email").value = profile.email || "";
  $("#profile-bio").value = profile.bio || "";
  const security = state.security || seedState.security;
  $$("[data-security]").forEach((button) => {
    const enabled = Boolean(security[button.dataset.security]);
    button.setAttribute("aria-pressed", String(enabled));
    button.querySelector(".toggle")?.classList.toggle("is-on", enabled);
  });
}

function switchScreen(screen) {
  state.screen = screen;
  saveState();
  $$("[data-screen-view]").forEach((view) => view.classList.toggle("is-active", view.dataset.screenView === screen));
  $$('[data-screen]').forEach((button) => button.classList.toggle("is-active", button.dataset.screen === screen));
  const titles = { content: "预览与分享", orders: "订单", analytics: "数据", payout: "收款", settings: "设置" };
  $("#breadcrumb-title").textContent = titles[screen] || "预览与分享";
  const header = $(".site-header");
  const menuButton = $(".header-menu-button");
  header?.classList.remove("is-nav-open");
  menuButton?.setAttribute("aria-expanded", "false");
  if (screen === "orders") renderOrders();
  if (screen === "analytics") renderAnalyticsPeriod();
  if (screen === "payout") renderPayoutHistory();
  if (screen === "settings") renderSettings();
}

function openModal(id) {
  const modal = $(`#${id}`);
  if (modal) modal.hidden = false;
  if (id === "visitor-modal") {
    visitorState = "unpaid";
    state.authExpiresAt = null;
    renderVisitorPage();
  }
}

function updateCreateFields() {
  const contentFields = $("#create-content-fields");
  const linkField = $("#create-link-field");
  const sensitiveField = $("#create-sensitive-field");
  if (!contentFields || !linkField || !sensitiveField) return;
  const isLink = createMode === "link";
  const isSensitive = createMode === "sensitive";
  contentFields.hidden = !isLink && !isSensitive;
  linkField.hidden = !isLink;
  sensitiveField.hidden = !isSensitive;
}

function setCreateFormError(message = "") {
  const target = $("#create-form-error");
  if (!target) return;
  target.textContent = message;
  target.hidden = !message;
}

function openCreateForm(content = null) {
  editingContentId = content?.id || null;
  createMode = content?.mode || state.mode;
  $("#create-title").textContent = editingContentId ? "编辑付费内容" : "创建一条付费内容";
  $("#create-submit-label").innerHTML = '<i class="ph ' + (editingContentId ? "ph-check" : "ph-sparkle") + '"></i> ' + (editingContentId ? "保存内容" : "生成安全链接");
  $("#create-form [name=title]").value = content?.title || modeLabels[createMode].title;
  $("#create-form [name=price]").value = formatMoney(content?.price || state.price);
  $("#create-form [name=rule]").value = content?.rule || state.rule;
  $("#create-form [name=note]").value = content?.note || seedState.note;
  $("#create-form [name=linkContent]").value = content?.linkContent || content?.textContent || "";
  $("#create-form [name=sensitiveText]").value = content?.sensitiveText || "";
  setCreateFormError("");
  $$('[data-create-mode]').forEach((button) => button.classList.toggle("is-selected", button.dataset.createMode === createMode));
  updateCreateFields();
  openModal("create-modal");
}

function closeModals() {
  $$(".modal-backdrop").forEach((modal) => { modal.hidden = true; });
  window.clearTimeout(visitorTimer);
  visitorTimer = null;
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2400);
}

function getRemainingTime() {
  if (!state.authExpiresAt) return "授权有效期 2 小时";
  const remaining = Math.max(0, state.authExpiresAt - Date.now());
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  return `${hours} 小时 ${String(minutes).padStart(2, "0")} 分钟内有效`;
}

function startMockPayment() {
  if (visitorState === "paid") return;
  visitorState = "processing";
  renderVisitorPage();
  visitorTimer = window.setTimeout(() => {
    visitorState = "paid";
    state.authExpiresAt = Date.now() + 2 * 60 * 60 * 1000;
    state.orders.unshift({ id: `LP-240803-00${13 + state.orders.length}`, customer: "当前访客", content: `${modeLabels[state.mode].title} · ${modeLabels[state.mode].label}`, amount: formatMoney(state.price), time: "刚刚", status: "paid", initial: "访" });
    saveState();
    renderVisitorPage();
    showToast("支付成功，访问授权已创建");
  }, 1500);
}

function fallbackCopyText(text) {
  const textarea = document.createElement("textarea");
  textarea.value = String(text ?? "");
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  let copied = false;
  try { copied = document.execCommand("copy"); } catch (error) { copied = false; }
  textarea.remove();
  return copied;
}

function showCopyFallback(value) {
  let input = $("#copy-fallback-input");
  if (!input) {
    input = document.createElement("input");
    input.id = "copy-fallback-input";
    input.className = "copy-fallback-input";
    input.type = "text";
    input.readOnly = true;
    input.setAttribute("aria-label", "待手动复制的内容");
    document.body.appendChild(input);
  }
  input.value = value;
  input.hidden = false;
  input.focus();
  input.select();
  input.setSelectionRange(0, input.value.length);
  window.clearTimeout(copyFallbackTimer);
  copyFallbackTimer = window.setTimeout(() => { input.remove(); }, 8000);
  showToast("浏览器不允许自动复制，请按 ⌘C / Ctrl+C 完成");
}

function copyText(text, successMessage) {
  const value = String(text ?? "");
  if (!value) { showToast("没有可复制的内容"); return; }
  const showResult = (copied) => copied ? showToast(successMessage) : showCopyFallback(value);
  if (window.location.protocol === "https:" && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(value).then(() => showResult(true)).catch(() => showResult(fallbackCopyText(value)));
    return;
  }
  if (window.location.protocol === "https:") {
    showResult(fallbackCopyText(value));
    return;
  }
  showCopyFallback(value);
}

function handleAction(action, element) {
  if (action === "toggle-site-menu") {
    const header = $(".site-header");
    const isOpen = header?.classList.toggle("is-nav-open") ?? false;
    element.setAttribute("aria-expanded", String(isOpen));
    return;
  }
  if (action === "open-visitor") return openModal("visitor-modal");
  if (action === "open-create") return openCreateForm();
  if (action === "close-modal") return closeModals();
  if (action === "simulate-payment") return startMockPayment();
  if (action === "simulate-failure") { visitorState = "failed"; renderVisitorPage(); showToast("支付未完成，请重新发起支付"); return; }
  if (action === "copy-link") return copyText(state.link, "公开链接已复制");
  if (action === "copy-text-content") return copyText(state.textContent, "文字内容已复制");
  if (action === "copy-sensitive") return copyText(state.sensitiveText, "敏感文字已复制");
  if (action === "copy-content-link") {
    const content = findContentById(element.dataset.contentId);
    return content ? copyText(publicLinkFor(content.id), "公开链接已复制") : showToast("内容链接不存在");
  }
  if (action === "edit-content") {
    const content = findContentById(element.dataset.contentId);
    if (!content) return showToast("内容不存在");
    applyContentRecord(content);
    saveState();
    renderPublicPreview();
    renderContentLibrary();
    openCreateForm(content);
    return;
  }
  if (action === "open-public-link") {
    const content = findContentById(element.dataset.contentId);
    if (!content) return showToast("内容不存在");
    applyContentRecord(content);
    saveState();
    window.open(publicLinkFor(content.id), "_blank", "noopener,noreferrer");
    return;
  }
  if (action === "publish") { state.published = true; syncCurrentContentRecord(); saveState(); renderContentLibrary(); showToast("已发布更新，公开链接保持不变"); return; }
  if (action === "cycle-analytics-period") {
    const periods = ["7", "30", "90"];
    const nextPeriod = periods[(periods.indexOf(state.analyticsPeriod || "30") + 1) % periods.length];
    state.analyticsPeriod = nextPeriod;
    saveState();
    renderAnalyticsPeriod();
    showToast("数据范围已切换为：" + getAnalyticsPeriodLabel());
    return;
  }
  if (action === "open-content") { const url = safeHttpUrl(state.linkContent); if (url) window.open(url, "_blank", "noopener,noreferrer"); else showToast("链接格式不安全，已阻止打开"); return; }
  if (["open-guide", "open-account", "show-security", "open-cover", "edit-note", "open-advanced", "report-content", "share-wechat", "share-moments", "share-weibo"].includes(action)) { showToast({ "open-guide": "新手指南：从创建内容到支付回调，四步即可发布", "open-account": "当前工作区：夜航者", "show-security": "安全策略已启用：加密存储、签名回调、授权过期", "open-cover": "封面图片已接入安全存储", "edit-note": "创作者寄语已在预览中同步", "open-advanced": "高级选项将在正式接入支付后开放", "report-content": "感谢反馈，我们会在 24 小时内处理", "share-wechat": "微信分享卡片已准备好", "share-moments": "朋友圈分享卡片已准备好", "share-weibo": "微博分享链接已准备好" }[action]); return; }
  if (action === "withdraw") { state.payouts.unshift({ date: "刚刚", amount: "2,408.60", status: "处理中", method: "微信支付" }); saveState(); renderPayoutHistory(); showToast("提现申请已创建，正在等待结算"); return; }
  if (action === "edit-provider") { showToast("Mock Payment Provider 已连接，支持替换为真实支付服务"); return; }
  if (action === "export-orders") { copyText("Lumen Pass 订单导出：" + state.orders.length + " 笔，已支付 " + state.orders.filter((order) => order.status === "paid").length + " 笔，处理中 " + state.orders.filter((order) => order.status === "pending").length + " 笔", "订单摘要已复制"); return; }
  if (action === "export-payouts") { const payoutTotal = state.payouts.reduce((total, payout) => total + (Number(String(payout.amount).replace(/,/g, "")) || 0), 0); copyText("Lumen Pass 结算记录：" + state.payouts.length + " 笔，合计 ¥" + formatMoney(payoutTotal), "结算摘要已复制"); return; }
  if (action === "save-settings") {
    state.profile = {
      displayName: $("#profile-name").value.trim(),
      email: $("#profile-email").value.trim(),
      bio: $("#profile-bio").value.trim(),
    };
    saveState();
    showToast("工作区设置已保存");
    return;
  }
  if (action === "toggle-security") {
    const key = element.dataset.security;
    if (key) {
      state.security[key] = !state.security[key];
      saveState();
      renderSettings();
      showToast("安全策略已更新");
    }
    return;
  }
}

function handleCreateSubmit(form) {
  const data = new FormData(form);
  const title = String(data.get("title") || "").trim();
  const rawPrice = String(data.get("price") || "").trim();
  const numericPrice = Number(rawPrice);
  const linkOrText = String(data.get("linkContent") || "").trim();
  const sensitiveText = String(data.get("sensitiveText") || "").trim();
  if (!title) return setCreateFormError("请填写内容标题");
  if (!Number.isFinite(numericPrice) || numericPrice <= 0) return setCreateFormError("价格需要大于 0 元");
  if (createMode === "link" && !linkOrText) return setCreateFormError("请填写要展示的网址或普通文字");
  if (createMode === "sensitive" && !sensitiveText) return setCreateFormError("请填写支付后展示的密码或授权文字");
  setCreateFormError("");
  const wasEditing = Boolean(editingContentId);
  state.mode = createMode;
  state.title = title;
  state.price = formatMoney(numericPrice);
  state.rule = String(data.get("rule") || "window");
  state.note = String(data.get("note") || "").trim();
  if (createMode === "link") {
    if (safeHttpUrl(linkOrText)) {
      state.linkContent = linkOrText;
      state.textContent = "";
    } else {
      state.linkContent = "";
      state.textContent = linkOrText;
    }
  }
  if (createMode !== "link") { state.linkContent = ""; state.textContent = ""; }
  if (createMode === "sensitive") state.sensitiveText = sensitiveText;
  if (createMode !== "sensitive") state.sensitiveText = "";
  state.link = wasEditing ? publicLinkFor(editingContentId) : publicLinkFor(Math.random().toString(36).slice(2, 8));
  state.published = true;
  syncCurrentContentRecord();
  editingContentId = null;
  saveState();
  closeModals();
  renderPublicPreview();
  renderContentLibrary();
  showToast(wasEditing ? "内容已保存，公开链接保持不变" : "安全链接已生成，可继续调整访问设置");
}

document.addEventListener("click", (event) => {
  const screenButton = event.target.closest("[data-screen]");
  if (screenButton) { switchScreen(screenButton.dataset.screen); return; }
  const orderFilterButton = event.target.closest("[data-order-filter]");
  if (orderFilterButton) {
    state.orderFilter = orderFilterButton.dataset.orderFilter;
    saveState();
    renderOrders();
    return;
  }
  const modeButton = event.target.closest("[data-mode]");
  if (modeButton) { state.mode = modeButton.dataset.mode; state.title = modeLabels[state.mode].title; syncCurrentContentRecord(); saveState(); renderPublicPreview(); renderContentLibrary(); return; }
  const ruleButton = event.target.closest("[data-rule]");
  if (ruleButton) { state.rule = ruleButton.dataset.rule; syncCurrentContentRecord(); saveState(); renderPublicPreview(); renderContentLibrary(); showToast(`访问规则已切换为：${getRuleLabel()}`); return; }
  const createModeButton = event.target.closest("[data-create-mode]");
  if (createModeButton) { createMode = createModeButton.dataset.createMode; $$("[data-create-mode]").forEach((button) => button.classList.toggle("is-selected", button === createModeButton)); updateCreateFields(); return; }
  const actionButton = event.target.closest("[data-action]");
  if (actionButton) { handleAction(actionButton.dataset.action, actionButton); return; }
  if (event.target.classList.contains("modal-backdrop")) closeModals();
});

document.addEventListener("change", (event) => {
  if (event.target.matches("#price-input")) {
    const nextPrice = Number(event.target.value);
    if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
      event.target.value = formatMoney(state.price);
      showToast("价格需要大于 0 元");
      return;
    }
    state.price = formatMoney(nextPrice);
    syncCurrentContentRecord();
    saveState();
    renderPublicPreview();
    renderContentLibrary();
  }
});

$("#create-form")?.addEventListener("submit", (event) => { event.preventDefault(); handleCreateSubmit(event.currentTarget); });
window.setInterval(() => {
  if (PUBLIC_CONTENT_ID) {
    if (visitorState === "paid") renderVisitorPage();
    return;
  }
  const visitorModal = $("#visitor-modal");
  if (visitorModal && !visitorModal.hidden && visitorState === "paid") renderVisitorPage();
}, 30000);

if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {});
  });
}

if (PUBLIC_CONTENT_ID) {
  renderPublicRoutePage();
} else {
  syncCurrentContentRecord();
  saveState();
  renderPublicPreview();
  renderContentLibrary();
  renderOrders();
  renderAnalyticsPeriod();
  renderPayoutHistory();
  renderSettings();
  switchScreen(state.screen || "content");
}
