// /assets/js/pages/guide_orders.js
import { onAuthReady } from "../auth.js";
import { db } from "/assets/js/firebase-init.js";
import { isGuide, isAdmin } from "../roles.js";

import {
  collection,
  query,
  where,
  orderBy,
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

function tsSeconds(v) {
  if (!v) return 0;
  if (typeof v === "object" && typeof v.seconds === "number") return v.seconds;
  return 0;
}

function fmtDT(ts) {
  const s = tsSeconds(ts);
  if (!s) return "";
  const d = new Date(s * 1000);
  return d.toISOString().replace("T", " ").slice(0, 16);
}

function rowHTML(o) {
  const created = fmtDT(o.createdAt);
  const status = o.status || "-";
  const pay = o.payment || "-";
  const title = o.itemTitle || "(상품)";
  const date = o.date || "-";

  return `
    <div class="row">
      <div class="top">
        <h3 class="title">${esc(title)}</h3>
        <div class="meta">
          <span class="pill">${esc(status)}</span>
          <span class="pill">${esc(pay)}</span>
          ${created ? `<span>${esc(created)}</span>` : ""}
        </div>
      </div>

      <div class="kv"><div class="k">예약일</div><div class="v">${esc(date)}</div></div>
      <div class="kv"><div class="k">인원</div><div class="v">${esc(o.people)}</div></div>
      <div class="kv"><div class="k">구매자</div><div class="v">${esc(o.buyerName || o.buyerUid || "")}</div></div>
      <div class="kv"><div class="k">연락처</div><div class="v">${esc(o.contact || "")}</div></div>
      <div class="kv"><div class="k">메모</div><div class="v">${esc(o.memo || "")}</div></div>

      <div class="actions">
        <a class="linkbtn" href="/item.html?id=${encodeURIComponent(o.itemId)}" target="_blank" rel="noopener">상품 보기</a>
      </div>
    </div>
  `;
}

async function loadGuideOrders(uid) {
  const state = $("#ordersState");
  const list = $("#ordersList");

  state.textContent = "불러오는 중...";
  list.innerHTML = "";

  const q = query(
    collection(db, "orders"),
    where("ownerUid", "==", uid),
    orderBy("createdAt", "desc"),
    limit(200)
  );

  const snap = await getDocs(q);
  const arr = [];
  snap.forEach((d) => arr.push({ _id: d.id, ...d.data() }));

  state.textContent = "";

  if (!arr.length) {
    list.innerHTML = `<div class="empty">주문이 없습니다.</div>`;
    return;
  }

  list.innerHTML = arr.map(rowHTML).join("");
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
