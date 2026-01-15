// /assets/js/pages/orders.js
import { onAuthReady } from "../auth.js";
import { db } from "/assets/js/firebase-init.js";

import {
  collection,
  query,
  where,
  limit,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setMsg(t) {
  const el = $("msg");
  if (el) el.textContent = String(t || "");
}

function renderList(rows) {
  const box = $("orderList");
  if (!box) return;

  if (!rows.length) {
    box.innerHTML = `<div class="empty">주문 내역이 없습니다.</div>`;
    return;
  }

  box.innerHTML = rows.map((o) => {
    const id = o._id;
    const title = esc(o.itemTitle || "(상품)");
    const status = esc(o.status || "pending");
    const payment = esc(o.payment || o.payMethod || "card");
    const amount = esc(o.price ?? o.amount ?? "");
    const date = esc(o.date || "");
    return `
      <a class="order-card" href="./order_detail.html?id=${encodeURIComponent(id)}">
        <div class="order-card__title">${title}</div>
        <div class="order-card__meta">
          <span>상태: ${status}</span>
          <span>결제: ${payment}</span>
          <span>금액: ${amount}</span>
          <span>${date}</span>
        </div>
        <div class="order-card__id">${esc(id)}</div>
      </a>
    `;
  }).join("");
}

onAuthReady(async ({ user, profile }) => {
  if (!user) {
    setMsg("로그인 후 확인할 수 있습니다.");
    renderList([]);
    return;
  }

  setMsg("주문 내역을 불러오는 중...");

  try {
    const isAdmin =
      profile?.isAdmin === true ||
      profile?.role === "admin" ||
      (Array.isArray(profile?.roles) && profile.roles.includes("admin"));

    const col = collection(db, "orders");

    // 사용자: 내 주문만 (rules의 list 조건과 정확히 일치)
    // 관리자: 전체를 보려면 admin 페이지에서 별도 구현 권장.
    // 여기서는 관리자도 "내 주문" 개념을 유지해 buyerUid==uid로 동일하게 가져옵니다.
    const q = query(
      col,
      where("buyerUid", "==", user.uid),
      limit(50)
    );

    const snap = await getDocs(q);
    const rows = [];
    snap.forEach((d) => rows.push({ _id: d.id, ...d.data() }));

    // 정렬은 클라에서(인덱스/규칙 단순화)
    rows.sort((a, b) => {
      const ta = a.payProofUpdatedAt?.seconds || a.updatedAt?.seconds || a.createdAt?.seconds || 0;
      const tb = b.payProofUpdatedAt?.seconds || b.updatedAt?.seconds || b.createdAt?.seconds || 0;
      return tb - ta;
    });

    setMsg("");
    renderList(rows);
  } catch (e) {
    console.error(e);
    setMsg(e?.message || String(e));
    renderList([]);
  }
});
