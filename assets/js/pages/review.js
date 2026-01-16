// /assets/js/pages/review.js
// 주문 기반 리뷰 작성/수정

import { onAuthReady } from "../auth.js";
import { auth, db } from "../firebase-init.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

function qs(name) {
  const u = new URL(location.href);
  return (u.searchParams.get(name) || "").trim();
}

function setState(msg, kind = "") {
  const el = $("state");
  if (!el) return;
  el.className = "state " + (kind ? `state--${kind}` : "");
  el.textContent = msg || "";
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clampRating(v) {
  const n = parseInt(String(v || "5"), 10);
  if (!Number.isFinite(n)) return 5;
  return Math.max(1, Math.min(5, n));
}

async function loadOrder(orderId) {
  const snap = await getDoc(doc(db, "orders", orderId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

async function loadItem(itemId) {
  if (!itemId) return null;
  const snap = await getDoc(doc(db, "items", itemId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

async function loadReview(orderId) {
  const snap = await getDoc(doc(db, "reviews", orderId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

async function saveReview({ order, item, user }) {
  const orderId = order.id;
  const rating = clampRating($("rating")?.value);
  const text = String($("text")?.value || "").trim();

  const ref = doc(db, "reviews", orderId);
  const prev = await getReviewForCreateCheck(orderId);

  const payload = {
    orderId,
    itemId: order.itemId || "",
    itemTitle: item?.title || order.itemTitle || "",
    guideUid: order.ownerUid || "",
    authorUid: user.uid,
    authorName: user.displayName || user.email || "buyer",

    rating,
    text,

    visible: prev?.visible ?? true,
    guideReply: prev?.guideReply ?? "",
    adminReply: prev?.adminReply ?? "",

    updatedAt: serverTimestamp(),
  };

  if (!prev?.createdAt) {
    payload.createdAt = serverTimestamp();
  }

  await setDoc(ref, payload, { merge: true });
}

async function getReviewForCreateCheck(orderId) {
  try {
    return await loadReview(orderId);
  } catch {
    return null;
  }
}

onAuthReady(async () => {
  const orderId = qs("order");
  if (!orderId) {
    setState("order 파라미터가 없습니다. 예) /review.html?order=주문ID", "bad");
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    setState("로그인이 필요합니다.", "bad");
    return;
  }

  setState("주문 확인 중...");

  try {
    const order = await loadOrder(orderId);
    if (!order) {
      setState("주문을 찾을 수 없습니다.", "bad");
      return;
    }

    if ((order.buyerUid || "") !== user.uid) {
      setState("이 주문에 대한 리뷰를 작성할 권한이 없습니다.", "bad");
      return;
    }

    const item = await loadItem(order.itemId);
    const review = await loadReview(orderId);

    // UI 채우기
    $("box").style.display = "";
    $("title").innerHTML = esc(item?.title || order.itemTitle || "(상품)");
    $("orderId").textContent = orderId;
    $("orderStatus").textContent = String(order.status || "pending");

    if (review) {
      $("rating").value = String(clampRating(review.rating));
      $("text").value = String(review.text || "");
    }

    const btnItem = $("btnItem");
    if (btnItem) {
      const href = order.itemId ? `/item.html?id=${encodeURIComponent(order.itemId)}` : "#";
      btnItem.setAttribute("href", href);
    }

    setState("");

    $("btnSave")?.addEventListener("click", async () => {
      try {
        $("btnSave").disabled = true;
        setState("저장 중...");
        await saveReview({ order: { id: orderId, ...order }, item, user });
        setState("저장했습니다.");
        setTimeout(() => setState(""), 1200);
      } catch (e) {
        console.error(e);
        setState(e?.message || String(e), "bad");
      } finally {
        $("btnSave").disabled = false;
      }
    });
  } catch (e) {
    console.error(e);
    setState("권한 또는 네트워크 문제로 불러오지 못했습니다.", "bad");
  }
});
