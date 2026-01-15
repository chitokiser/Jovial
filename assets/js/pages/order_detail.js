// /assets/js/pages/order_detail.js
// 주문 상세 + 결제/증빙 제출
// - 구매자 또는 관리자만 조회 가능
// - 구매자는 결제증빙 관련 필드만 업데이트(권한 충돌 방지)

import { onAuthReady } from "../auth.js";
import { db } from "/assets/js/firebase-init.js";

import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

function qs(name) {
  const u = new URL(location.href);
  return u.searchParams.get(name) || "";
}

function setMsg(t) {
  const el = $("msg");
  if (el) el.textContent = String(t || "");
}

function showProof(method) {
  const m = String(method || "card").toLowerCase();
  const card = $("proofCard");
  const fiat = $("proofFiat");
  const hex = $("proofUsdt"); // 기존 ID 유지: UI 텍스트는 HEX로 변경

  if (card) card.style.display = m === "card" ? "block" : "none";
  if (fiat) fiat.style.display = m === "fiat" ? "block" : "none";
  if (hex) hex.style.display = (m === "hex" || m === "usdt") ? "block" : "none";
}

function fill(elId, v) {
  const el = $(elId);
  if (!el) return;
  const val = v ?? "";
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") {
    el.value = String(val);
  } else {
    el.textContent = String(val);
  }
}

function getProofFromUI() {
  return {
    card: {
      approvalNo: ($("cardApprovalNo")?.value || "").trim(),
      paidAt: ($("cardPaidAt")?.value || "").trim(),
      amount: ($("cardAmount")?.value || "").trim(),
      currency: ($("cardCurrency")?.value || "").trim(),
    },
    fiat: {
      depositor: ($("fiatDepositor")?.value || "").trim(),
      bank: ($("fiatBank")?.value || "").trim(),
      account: ($("fiatAccount")?.value || "").trim(),
      amount: ($("fiatAmount")?.value || "").trim(),
      currency: ($("fiatCurrency")?.value || "").trim(),
    },
    hex: {
      txHash: ($("usdtTxHash")?.value || "").trim(),
      from: ($("usdtFrom")?.value || "").trim(),
      amount: ($("usdtAmount")?.value || "").trim(),
      currency: ($("usdtCurrency")?.value || "HEX").trim(),
    },
  };
}

function applyProofToUI(o) {
  // 신형: o.proof.{card|fiat|hex}
  const p = o?.proof || {};
  const pc = p.card || {};
  const pf = p.fiat || {};
  const ph = p.hex || p.usdt || {};

  // 구형(레거시) 필드도 가능한 경우 채움(읽기만)
  const legacyCard = {
    approvalNo: o?.cardApprovalNo,
    paidAt: o?.cardPaidAt,
    amount: o?.cardAmount,
    currency: o?.cardCurrency,
  };
  const legacyFiat = {
    depositor: o?.paymentDepositor,
    bank: o?.paymentBank,
    account: o?.paymentAccount,
    amount: o?.paymentAmount,
    currency: o?.paymentCurrency,
  };
  const legacyHex = {
    txHash: o?.paymentTxHash,
    from: o?.paymentFrom,
    amount: o?.paymentAmount,
    currency: o?.paymentCurrency,
  };

  fill("cardApprovalNo", pc.approvalNo ?? legacyCard.approvalNo ?? "");
  fill("cardPaidAt", pc.paidAt ?? legacyCard.paidAt ?? "");
  fill("cardAmount", pc.amount ?? legacyCard.amount ?? "");
  fill("cardCurrency", pc.currency ?? legacyCard.currency ?? "");

  fill("fiatDepositor", pf.depositor ?? legacyFiat.depositor ?? "");
  fill("fiatBank", pf.bank ?? legacyFiat.bank ?? "");
  fill("fiatAccount", pf.account ?? legacyFiat.account ?? "");
  fill("fiatAmount", pf.amount ?? legacyFiat.amount ?? "");
  fill("fiatCurrency", pf.currency ?? legacyFiat.currency ?? "");

  fill("usdtTxHash", ph.txHash ?? legacyHex.txHash ?? "");
  fill("usdtFrom", ph.from ?? legacyHex.from ?? "");
  fill("usdtAmount", ph.amount ?? legacyHex.amount ?? "");
  fill("usdtCurrency", ph.currency ?? legacyHex.currency ?? "HEX");
}

onAuthReady(async ({ user, profile }) => {
  const id = qs("id");
  if (!id) {
    setMsg("주문 id가 없습니다.");
    return;
  }

  if (!user) {
    setMsg("로그인 후 확인할 수 있습니다.");
    return;
  }

  setMsg("주문을 불러오는 중...");

  try {
    const ref = doc(db, "orders", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      setMsg("주문을 찾을 수 없습니다.");
      return;
    }

    const o = { _id: snap.id, ...snap.data() };

    // 권한: 구매자 또는 관리자만
    const buyerUid = o.buyerUid || "";
    const isAdmin =
      profile?.isAdmin === true ||
      profile?.role === "admin" ||
      (Array.isArray(profile?.roles) && profile.roles.includes("admin"));

    if (!isAdmin && buyerUid && buyerUid !== user.uid) {
      setMsg("이 주문을 볼 권한이 없습니다.");
      return;
    }

    setMsg("");

    // 상단/요약
    fill("orderNo", o._id);
    fill("productTitle", o.itemTitle || "(상품)");
    fill("optDate", o.date || "");
    fill("optAdults", String(o.adults ?? ""));
    fill("optChildren", String(o.children ?? ""));
    fill("payMethod", o.payment || o.payMethod || "card");
    fill("amount", o.price ? String(o.price) : (o.amount || ""));
    fill("status", o.status || "pending");
    fill("memo", o.memo || "");
    fill("adminNote", o.adminNote || "");
    fill("meta", o.updatedAt ? "updated" : "");

    showProof(o.payment || o.payMethod || "card");
    applyProofToUI(o);

    // 버튼: 상품으로
    const btnGo = $("btnGoProduct");
    if (btnGo) {
      btnGo.addEventListener("click", (e) => {
        e.preventDefault();
        const itemId = o.itemId || "";
        if (!itemId) return;
        location.href = `./item.html?id=${encodeURIComponent(itemId)}`;
      });
    }

    // 저장(증빙 제출)
    const btnSave = $("btnSave");
    if (btnSave) {
      btnSave.addEventListener("click", async () => {
        try {
          btnSave.disabled = true;
          setMsg("저장 중...");

          const proof = getProofFromUI();

          // 구매자 업데이트는 "결제증빙 관련 필드만" (rules 충돌 방지)
          const patch = {
            proof,
            paymentStatus: "submitted",
            payProofUpdatedAt: serverTimestamp(),
          };

          await updateDoc(ref, patch);

          setMsg("저장되었습니다. (결제증빙 제출)");
          btnSave.disabled = false;
        } catch (e) {
          console.error(e);
          setMsg(e?.message || String(e));
          btnSave.disabled = false;
        }
      });
    }
  } catch (e) {
    console.error(e);
    setMsg(e?.message || String(e));
  }
});
