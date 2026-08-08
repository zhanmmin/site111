import assert from "node:assert/strict";

const baseUrl = String(process.env.SMOKE_BASE_URL || "http://127.0.0.1:8787").replace(/\/$/, "");
const creatorEmail = process.env.SMOKE_CREATOR_EMAIL || "hello@lumenpass.com";
const creatorPassword = process.env.SMOKE_CREATOR_PASSWORD || "creator123";
const adminEmail = process.env.SMOKE_ADMIN_EMAIL || "admin@lumenpass.com";
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD || "admin123";
let checks = 0;

async function request(path, { token = "", method = "GET", body, expected = 200, binary = false } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  assert.equal(response.status, expected, `${method} ${path} expected ${expected}, received ${response.status}`);
  checks += 1;
  if (binary) return { response, body: Buffer.from(await response.arrayBuffer()) };
  const contentType = response.headers.get("content-type") || "";
  return { response, body: contentType.includes("application/json") ? await response.json() : await response.text() };
}

async function main() {
  const health = await request("/api/health");
  assert.equal(health.body.database, "up");

  await request("/api/creator/me", { expected: 401 });
  await request("/api/admin/overview", { expected: 401 });
  await request("/api/public/contents/missing-content/report", { method: "POST", body: { reason: "QA" }, expected: 404 });

  const creatorLogin = await request("/api/creator/auth/login", { method: "POST", body: { email: creatorEmail, password: creatorPassword } });
  const creatorToken = creatorLogin.body.token;
  assert.ok(creatorToken);
  const adminLogin = await request("/api/admin/auth/login", { method: "POST", body: { email: adminEmail, password: adminPassword } });
  const adminToken = adminLogin.body.token;
  assert.ok(adminToken);

  for (const path of ["/api/creator/me", "/api/creator/contents", "/api/creator/orders", "/api/creator/payouts", "/api/creator/settings", "/api/creator/analytics"]) {
    await request(path, { token: creatorToken });
  }
  for (const path of ["/api/admin/overview", "/api/admin/contents", "/api/admin/users", "/api/admin/orders", "/api/admin/settings", "/api/admin/audit-logs"]) {
    await request(path, { token: adminToken });
  }
  await request("/api/admin/overview", { token: creatorToken, expected: 403 });
  await request("/api/creator/me", { token: adminToken, expected: 403 });

  await request("/api/creator/contents", { token: creatorToken, method: "POST", body: { mode: "link", title: "无交付内容", price: 10, linkContent: "" }, expected: 400 });
  await request("/api/creator/contents", { token: creatorToken, method: "POST", body: { mode: "link", title: "超价内容", price: 10000, textContent: "test" }, expected: 400 });
  await request("/api/creator/contents", { token: creatorToken, method: "POST", body: { mode: "image", title: "不安全图片", price: 10, images: { primary: { data: `data:image/svg+xml;base64,${Buffer.from("<svg/>").toString("base64")}` } } }, expected: 400 });
  if (process.env.SMOKE_LARGE_IMAGE === "1") {
    const largeImage = Buffer.alloc(3 * 1024 * 1024, 1);
    const smallPreview = Buffer.alloc(64 * 1024, 2);
    await request("/api/creator/contents", {
      token: creatorToken,
      method: "POST",
      body: {
        mode: "image",
        title: "大图分块写入回归",
        price: 10,
        images: { primary: { data: `data:image/jpeg;base64,${largeImage.toString("base64")}`, preview: `data:image/jpeg;base64,${smallPreview.toString("base64")}` } },
      },
      expected: 201,
    });
  }

  const publicCases = [
    ["PC-240805-0101", "春日花园", "image"],
    ["PC-240805-0103", "摄影后期预设包", "link"],
    ["PC-240805-0105", "夏日人像双图", "dual"],
    ["PC-240805-0106", "旅行路线与地图", "link"],
  ];
  for (const [id, title, mode] of publicCases) {
    const result = await request(`/api/public/contents/${id}`);
    assert.equal(result.body.title, title);
    assert.equal(result.body.mode, mode);
    assert.equal(Object.hasOwn(result.body, "sensitiveText"), false);
    if (["image", "dual"].includes(mode)) assert.ok(result.body.previewImages.primary?.previewData);
  }

  const timedCheckout = await request("/api/public/contents/PC-240805-0106/checkout", { method: "POST", body: { buyerName: "QA two-hours" }, expected: 201 });
  const timedAccess = await request(`/api/public/access/${encodeURIComponent(timedCheckout.body.accessToken)}`);
  assert.ok(timedAccess.body.textContent || timedAccess.body.linkContent);
  const remainingMs = new Date(timedAccess.body.expiresAt).getTime() - Date.now();
  assert.ok(remainingMs > 110 * 60 * 1000 && remainingMs <= 2 * 60 * 60 * 1000 + 5000);
  await request(`/api/public/access/${encodeURIComponent(timedCheckout.body.accessToken)}`);

  const imageCheckout = await request("/api/public/contents/PC-240805-0101/checkout", { method: "POST", body: { buyerName: "QA image" }, expected: 201 });
  const imageAccess = await request(`/api/public/access/${encodeURIComponent(imageCheckout.body.accessToken)}`);
  assert.ok(imageAccess.body.images.primary?.originalData);
  const imageDownload = await request(`/api/public/access/${encodeURIComponent(imageCheckout.body.accessToken)}/download/primary`, { binary: true });
  assert.equal(imageDownload.response.headers.get("content-type"), "image/png");
  assert.match(imageDownload.response.headers.get("content-disposition") || "", /\.png"$/);
  assert.ok(imageDownload.body.length > 0);

  const onceId = "PC-240805-0108";
  await request(`/api/admin/contents/${onceId}/status`, { token: adminToken, method: "PATCH", body: { status: "approved" } });
  try {
    const onceCheckout = await request(`/api/public/contents/${onceId}/checkout`, { method: "POST", body: { buyerName: "QA once" }, expected: 201 });
    const onceAccess = await request(`/api/public/access/${encodeURIComponent(onceCheckout.body.accessToken)}`);
    assert.ok(onceAccess.body.sensitiveText);
    await request(`/api/public/access/${encodeURIComponent(onceCheckout.body.accessToken)}`, { expected: 410 });
  } finally {
    await request(`/api/admin/contents/${onceId}/status`, { token: adminToken, method: "PATCH", body: { status: "pending" } });
  }

  const creatorAnalytics = await request("/api/creator/analytics", { token: creatorToken });
  const adminUsers = await request("/api/admin/users", { token: adminToken });
  const creatorUser = adminUsers.body.items.find((item) => item.email === creatorEmail);
  assert.ok(creatorUser);
  assert.equal(creatorUser.revenue, creatorAnalytics.body.revenue, "admin revenue must not multiply across content joins");

  console.log(`Lumen Pass smoke test passed: ${checks} HTTP checks`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
