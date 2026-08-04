const STORAGE_KEY = "lumen-pass-demo-v1";
const ASSET_ROOT = window.location.protocol === "file:" ? "" : `${window.location.origin}/`;

const seedState = {
  screen: "content",
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
let createMode = state.mode;

function $(selector, scope = document) { return scope.querySelector(selector); }
function $$(selector, scope = document) { return [...scope.querySelectorAll(selector)]; }
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    const nextState = saved ? { ...structuredClone(seedState), ...saved } : structuredClone(seedState);
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
  const number = Number(value);
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
}

function renderContentLibrary() {
  const target = $("#content-library");
  if (!target) return;
  const contents = Array.isArray(state.contents) ? state.contents : [];
  target.innerHTML = contents.map((content) => {
    const mode = modeLabels[content.mode] || modeLabels.image;
    const icon = contentModeIcons[content.mode] || contentModeIcons.image;
    return '<article class="content-library-row"><div class="content-library-main"><span class="content-library-icon"><i class="ph ' + icon + '"></i></span><div><strong>' + escapeHtml(content.title) + '</strong><span>' + escapeHtml(content.id) + ' · 更新于 ' + escapeHtml(content.updated || "刚刚") + '</span></div></div><span class="content-library-mode"><i class="ph ' + icon + '"></i>' + escapeHtml(mode.label) + '</span><strong class="content-library-price">¥ ' + escapeHtml(formatMoney(content.price)) + '</strong><span class="content-library-status"><i class="ph ph-check-circle"></i> 已发布</span><div class="content-library-actions"><button type="button" data-action="view-content" data-content-id="' + escapeHtml(content.id) + '">编辑</button><button type="button" data-action="open-public-link" data-content-id="' + escapeHtml(content.id) + '">打开</button><button type="button" data-action="copy-content-link" data-content-id="' + escapeHtml(content.id) + '">复制链接</button></div></article>';
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
  const paymentHint = state.mode === "sensitive" ? "支付成功后才会显示密码文字" : state.mode === "link" ? "支付成功后才会显示文字或打开网址" : "支付后立即解锁完整内容";
  const mediaAsset = paid && !expired ? assetUrl("assets/unlocked-preview.png") : assetUrl("assets/locked-preview.png");
  const mediaAlt = paid && !expired ? "已解锁的高清内容" : "受保护的内容预览";
  const media = `<div class="visitor-media ${paid ? "is-unlocked" : ""} ${expired ? "is-expired" : ""}"><img src="${mediaAsset}" alt="${mediaAlt}" />${modeMediaContent(viewState, modal)}</div>`;
  const paidNote = paid && state.mode === "sensitive" ? "授权有效，内容仅在本次安全会话中展示。" : state.note;
  target.innerHTML = `<div class="visitor-preview-inner ${modal ? "modal-preview-inner" : ""}">
    <div class="visitor-topline"><span>${modal ? "Lumen Pass 安全内容页" : "买家打开后将看到的页面"}</span><button class="mini-action" type="button" data-action="report-content"><i class="ph ph-flag"></i> 举报</button></div>
    ${media}
    <div class="visitor-copy"><span class="creator-label">创作者寄语</span><h2 id="visitor-modal-title">${escapeHtml(displayTitle)}</h2><p>${escapeHtml(paidNote)}</p><div class="visitor-price">¥ ${formatMoney(state.price)}</div>${paid ? `${timeHint}<button class="visitor-action ${state.mode === "link" ? "" : "is-disabled"}" type="button" data-action="${buttonAction}" ${buttonAction === "noop" ? "disabled" : ""}><i class="ph ${actionIcon}"></i> ${action}</button>` : `<button class="visitor-action ${processing ? "is-processing" : ""}" type="button" data-action="${buttonAction}"><i class="ph ${actionIcon}"></i> ${action}</button>`}<div class="secure-hint"><i class="ph ph-shield-check"></i><span>${escapeHtml(paymentHint)} · ${escapeHtml(getExpiryLabel())}</span></div>${!paid && !processing ? `<div class="qr-pay-row"><img src="${qrUrl()}" alt="支付二维码" /><div><strong>使用微信扫一扫支付</strong><span>打开扫一扫，识别二维码</span></div></div>` : ""}${processing && modal ? `<button class="simulate-failure" type="button" data-action="simulate-failure">模拟支付失败</button>` : ""}</div>
    ${modeMediaContent(viewState, modal).includes("unlock-content") ? "" : ""}
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
  $("#order-total").textContent = String(120 + state.orders.length + 3);
  $("#order-table").innerHTML = state.orders.map((order) => `<div class="order-row"><div class="order-customer"><span class="order-avatar">${escapeHtml(order.initial)}</span><div><strong>${escapeHtml(order.customer)}</strong><span>${escapeHtml(order.id)}</span></div></div><span>${escapeHtml(order.content)}</span><b>¥ ${escapeHtml(order.amount)}</b><span>${escapeHtml(order.time)}</span><span class="status-badge ${order.status === "paid" ? "success" : "pending"}"><i class="ph ${order.status === "paid" ? "ph-check-circle" : "ph-hourglass-medium"}"></i>${order.status === "paid" ? "已支付" : "处理中"}</span></div>`).join("");
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
  $("[name=linkContent]", linkField).required = isLink;
  $("[name=sensitiveText]", sensitiveField).required = isSensitive;
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

function copyText(text, successMessage) {
  const fallback = () => showToast(successMessage);
  if (!navigator.clipboard) return fallback();
  navigator.clipboard.writeText(text).then(fallback).catch(fallback);
}

function handleAction(action, element) {
  if (action === "toggle-site-menu") {
    const header = $(".site-header");
    const isOpen = header?.classList.toggle("is-nav-open") ?? false;
    element.setAttribute("aria-expanded", String(isOpen));
    return;
  }
  if (action === "open-visitor") return openModal("visitor-modal");
  if (action === "open-create") {
    createMode = state.mode;
    $("#create-form [name=title]").value = state.title;
    $("#create-form [name=price]").value = formatMoney(state.price);
    $("#create-form [name=rule]").value = state.rule;
    $("#create-form [name=note]").value = state.note;
    $("#create-form [name=linkContent]").value = state.linkContent || state.textContent || "";
    $("#create-form [name=sensitiveText]").value = state.sensitiveText || "";
    $$("[data-create-mode]").forEach((button) => button.classList.toggle("is-selected", button.dataset.createMode === createMode));
    updateCreateFields();
    return openModal("create-modal");
  }
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
  if (action === "view-content") {
    const content = findContentById(element.dataset.contentId);
    if (!content) return showToast("内容不存在");
    applyContentRecord(content);
    saveState();
    renderPublicPreview();
    renderContentLibrary();
    showToast("已切换到：" + content.title);
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
  if (action === "open-content") { const url = safeHttpUrl(state.linkContent); if (url) window.open(url, "_blank", "noopener,noreferrer"); else showToast("链接格式不安全，已阻止打开"); return; }
  if (["open-guide", "open-account", "show-security", "open-cover", "edit-note", "open-advanced", "report-content", "share-wechat", "share-moments", "share-weibo"].includes(action)) { showToast({ "open-guide": "新手指南：从创建内容到支付回调，四步即可发布", "open-account": "当前工作区：夜航者", "show-security": "安全策略已启用：加密存储、签名回调、授权过期", "open-cover": "封面图片已接入安全存储", "edit-note": "创作者寄语已在预览中同步", "open-advanced": "高级选项将在正式接入支付后开放", "report-content": "感谢反馈，我们会在 24 小时内处理", "share-wechat": "微信分享卡片已准备好", "share-moments": "朋友圈分享卡片已准备好", "share-weibo": "微博分享链接已准备好" }[action]); return; }
  if (action === "withdraw") { showToast("提现申请已创建，Mock Provider 将在下一结算日处理"); return; }
  if (action === "edit-provider") { showToast("Mock Payment Provider 已连接，支持替换为真实支付服务"); return; }
  if (action === "export-orders") { copyText("Lumen Pass 订单导出：128 笔，已支付 127 笔，处理中 1 笔", "订单摘要已复制"); return; }
  if (action === "save-settings") { showToast("工作区设置已保存"); return; }
  if (action === "toggle-security") { element.querySelector(".toggle")?.classList.toggle("is-on"); showToast("安全策略已更新"); return; }
}

function handleCreateSubmit(form) {
  const data = new FormData(form);
  state.mode = createMode;
  state.title = String(data.get("title") || modeLabels[createMode].title).trim();
  state.price = formatMoney(data.get("price"));
  state.rule = String(data.get("rule") || "window");
  state.note = String(data.get("note") || "").trim();
  if (createMode === "link") {
    const linkOrText = String(data.get("linkContent") || "").trim();
    if (safeHttpUrl(linkOrText)) {
      state.linkContent = linkOrText;
      state.textContent = "";
    } else {
      state.linkContent = "";
      state.textContent = linkOrText;
    }
  }
  if (createMode === "sensitive") state.sensitiveText = String(data.get("sensitiveText") || "").trim();
  state.link = publicLinkFor(Math.random().toString(36).slice(2, 8));
  state.published = true;
  syncCurrentContentRecord();
  saveState();
  closeModals();
  renderPublicPreview();
  renderContentLibrary();
  showToast("安全链接已生成，可继续调整访问设置");
}

document.addEventListener("click", (event) => {
  const screenButton = event.target.closest("[data-screen]");
  if (screenButton) { switchScreen(screenButton.dataset.screen); return; }
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
  if (event.target.matches("#price-input")) { state.price = formatMoney(event.target.value); syncCurrentContentRecord(); saveState(); renderPublicPreview(); renderContentLibrary(); }
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
  switchScreen(state.screen || "content");
}
