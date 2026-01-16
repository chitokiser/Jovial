// /assets/js/pages/guide_orders.js
// 가이드 주문관리
// - admin 결제확인(confirmed)된 주문만 guideOrders/{guideUid}/orders 에 미러링됩니다.
// - 가이드는 수정/삭제할 수 없고 조회만 합니다.

import { onAuthReady } from "../auth.js";
import { db } from "/assets/js/firebase-init.js";
import { isGuide, isAdmin } from "../roles.js";

import {
  collection,
  query,
  limit,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const $ = (s) => document.querySelector(s);

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toMs(v) {
  if (!v) return 0;
  if (typeof v === "object" && typeof v.seconds === "number") return v.seconds * 1000;
  if (typeof v === "object" && typeof v.toDate === "function") return v.toDate().getTime();
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : 0;
}

function fmtDT(ts) {
  const ms = toMs(ts);
  if (!ms) return "";
  const d = new Date(ms);
  return d.toISOString().replace("T", " ").slice(0, 16);
}

function statusLabel(s) {
  const v = String(s || "").toLowerCase();
  if (v === "confirmed") return "결제확인 완료";
  if (v === "settled") return "정산 완료";
  if (v === "paid") return "결제확인 대기";
  return v || "-";
}

function rowHTML(o) {
  const created = fmtDT(o.createdAt);
  const confirmedAt = fmtDT(o.confirmedAt);
  const status = statusLabel(o.status);
  const title = o.itemTitle || "(상품)";
  const amount = (o.amount != null && o.amount !== "") ? String(o.amount) : "";
  const ym = o.settlementMonth || "";

  return `
    <div class="row">
      <div class="top">
        <h3 class="title">${esc(title)}</h3>
        <div class="meta">
          <span class="pill">${esc(status)}</span>
          ${created ? `<span>${esc(created)}</span>` : ""}
        </div>
      </div>

      <div class="kv"><div class="k">주문ID</div><div class="v">${esc(o.orderId || "")}</div></div>
      <div class="kv"><div class="k">금액</div><div class="v">${esc(amount)}</div></div>
      <div class="kv"><div class="k">정산월</div><div class="v">${esc(ym)}</div></div>
      <div class="kv"><div class="k">확인시각</div><div class="v">${esc(confirmedAt || "-")}</div></div>
      <div class="kv"><div class="k">구매자</div><div class="v">${esc(o.buyerUid || "")}</div></div>

      <div class="actions">
        <a class="linkbtn" href="/item.html?id=${encodeURIComponent(o.itemId || "")}" target="_blank" rel="noopener">상품 보기</a>
      </div>
    </div>
  `;
}

async function loadGuideOrders(guideUid) {
  const state = $("#ordersState");
  const list = $("#ordersList");

  state.textContent = "불러오는 중...";
  list.innerHTML = "";

  const q = query(
    collection(db, "guideOrders", guideUid, "orders"),
    limit(500)
  );

  const snap = await getDocs(q);
  const arr = [];
  snap.forEach((d) => {
    const o = d.data() || {};
    arr.push({ _id: d.id, ...o, _ms: toMs(o.confirmedAt) || toMs(o.createdAt) });
  });

  arr.sort((a, b) => (b._ms || 0) - (a._ms || 0));
  const rows = arr.slice(0, 200);

  state.textContent = "";

  if (!rows.length) {
    list.innerHTML = `<div class="empty">주문이 없습니다.</div>`;
    return;
  }

  list.innerHTML = rows.map(rowHTML).join("");
}

onAuthReady(async ({ user, profile }) => {
  if (!user) {
    $("#ordersState").textContent = "로그인 필요";
    return;
  }
  if (!(isGuide(profile) || isAdmin(profile))) {
    $("#ordersState").textContent = "가이드/관리자만 접근 가능합니다.";
    return;
  }

  $("#btnReload")?.addEventListener("click", () => loadGuideOrders(user.uid));
  await loadGuideOrders(user.uid);
});
