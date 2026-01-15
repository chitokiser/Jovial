// /assets/js/pages/item.js
import { onAuthReady } from "../auth.js";
import { auth, db } from "/assets/js/firebase-init.js";

import { isAdmin } from "../roles.js";

import {
  doc,
  getDoc,
  collection,
  query,
  getDocs,
  serverTimestamp,
  setDoc,
  addDoc,
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

function safeText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text ?? "";
}

function setState(t) {
  const el = $("#itemState");
  if (el) el.textContent = t || "";
}

function showBox(show) {
  const box = $("#itemBox");
  if (!box) return;
  box.classList.toggle("hide", !show);
}

function showBlock(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  if (text) {
    el.style.display = "block";
    el.textContent = text;
  } else {
    el.style.display = "none";
    el.textContent = "";
  }
}

function toTextCategory(v) {
  const map = {
    tour_city: "시내 투어 / 시티워크",
    tour_nature: "자연 / 근교 투어",
    tour_island: "섬 / 호핑 / 해양투어",
    tour_night: "야간 / 야시장 / 야경 투어",
    activity_water: "워터 액티비티",
    activity_adventure: "어드벤처",
    spa_massage: "스파 / 마사지",
    beauty_wellness: "웰니스",
    food_restaurant: "맛집 / 레스토랑 예약",
    food_class: "쿠킹 클래스 / 로컬 푸드",
    show_event: "공연 / 이벤트",
    photo_video: "스냅사진 / 영상",
    transport_pickup: "픽업 / 차량",
    ticket_pass: "입장권 / 패스",
    cruise_boat: "크루즈 / 보트",
    stay_homestay: "홈스테이",
    stay_guesthouse: "게스트하우스",
    stay_hostel: "호스텔",
    stay_sharedhouse: "쉐어하우스 / 장기체류",
    stay_villa: "풀빌라 / 단독 숙소",
    party_local: "로컬 파티",
    party_home: "홈 파티",
    party_club: "클럽 / DJ 파티",
    party_networking: "네트워킹 모임",
  };
  return map[v] || v || "-";
}

function getIdFromQuery() {
  const id = new URLSearchParams(location.search).get("id");
  return id ? id.trim() : "";
}

function renderItem({ id, data, viewerUid, viewerIsAdmin }) {
  const title = data.title || "(제목 없음)";
  const status = data.status || "-";
  const ownerUid = data.ownerUid || "-";
  const category = toTextCategory(data.category);
  const price = Number.isFinite(data.price) ? data.price : 0;
  const location = data.location || "-";
  const desc = data.desc || "";
  const images = Array.isArray(data.images) ? data.images : [];
  const rejectedReason = data.rejectedReason || "";

  const isOwner = viewerUid && ownerUid === viewerUid;

  safeText("itTitle", title);
  safeText("itStatus", status);
  safeText("itCategory", category);
  safeText("itPrice", String(price));
  safeText("itLocation", location);
  safeText("itDesc", desc || "(설명 없음)");

  const meta = $("#itMeta");
  if (meta) {
    meta.innerHTML = `
      <span class="pill">${esc(status)}</span>
      <span class="mono">id: ${esc(id)}</span>
      ${(viewerIsAdmin || isOwner) ? `<span class="mono">ownerUid: ${esc(ownerUid)}</span>` : ""}
    `;
  }

  if (status === "rejected" && rejectedReason) {
    showBlock("itReject", "거절 사유: " + rejectedReason);
  } else {
    showBlock("itReject", "");
  }

  const okStatuses = new Set(["draft", "pending", "published", "rejected"]);
  if (!okStatuses.has(status)) {
    showBlock("itWarn", `경고: status="${status}" (표준: draft/pending/published/rejected)`);
  } else {
    showBlock("itWarn", "");
  }

  const imgWrap = $("#itImages");
  if (imgWrap) {
    if (!images.length) {
      imgWrap.innerHTML = `<div class="empty">이미지가 없습니다.</div>`;
    } else {
      imgWrap.innerHTML = images
        .slice(0, 12)
        .map((u) => {
          const url = String(u || "").trim();
          if (!url) return "";
          return `
            <a class="img" href="${esc(url)}" target="_blank" rel="noopener">
              <img src="${esc(url)}" alt="image" loading="lazy" />
            </a>
          `;
        })
        .join("");
    }
  }

  return { ownerUid, status, title, price };
}

function tsSeconds(v) {
  if (!v) return 0;
  if (typeof v === "object" && typeof v.seconds === "number") return v.seconds;
  return 0;
}

function fmtDate(ts) {
  const s = tsSeconds(ts);
  if (!s) return "";
  const d = new Date(s * 1000);
  return d.toISOString().slice(0, 10);
}

function starText(n) {
  const k = Math.max(1, Math.min(5, Number(n) || 0));
  return "★★★★★☆☆☆☆☆".slice(0, k) + "☆☆☆☆☆".slice(0, 5 - k);
}

async function loadReviews(itemId) {
  const q = query(collection(db, "items", itemId, "reviews"));
  const snap = await getDocs(q);

  const out = [];
  snap.forEach((d) => out.push({ _id: d.id, ...d.data() }));

  out.sort((a, b) => {
    const at = tsSeconds(a.createdAt) || tsSeconds(a.updatedAt);
    const bt = tsSeconds(b.createdAt) || tsSeconds(b.updatedAt);
    return bt - at;
  });

  return out;
}

function renderReviews(list) {
  const wrap = $("#rvList");
  if (!wrap) return;

  if (!list.length) {
    wrap.innerHTML = `<div class="empty">아직 리뷰가 없습니다.</div>`;
    safeText("rvAvg", "평균 - / 0건");
    return;
  }

  const sum = list.reduce((a, r) => a + (Number(r.rating) || 0), 0);
  const avg = Math.round((sum / list.length) * 10) / 10;

  safeText("rvAvg", `평균 ${avg} / ${list.length}건`);

  wrap.innerHTML = list.map((r) => {
    const name = r.displayName || "익명";
    const rating = Number(r.rating) || 0;
    const date = fmtDate(r.updatedAt || r.createdAt);
    const text = r.text || "";
    return `
      <div class="review-item">
        <div class="review-top">
          <div class="review-name">${esc(name)}</div>
          <div class="review-meta">
            <span>${esc(starText(rating))}</span>
            <span>${esc(date)}</span>
          </div>
        </div>
        <div class="review-text">${esc(text)}</div>
      </div>
    `;
  }).join("");
}

async function saveMyReview({ itemId, user, rating, text }) {
  const ref = doc(db, "items", itemId, "reviews", user.uid);

  const payload = {
    uid: user.uid,
    displayName: user.displayName || user.email || "user",
    rating: Number(rating) || 5,
    text: String(text || "").trim(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(ref, payload, { merge: true });

  const snap = await getDoc(ref);
  if (snap.exists() && !snap.data().createdAt) {
    await setDoc(ref, { createdAt: serverTimestamp() }, { merge: true });
  }
}

/* 주문 저장 */
function setOrderState(t) {
  const el = $("#orderState");
  if (el) el.textContent = t || "";
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function initOrderDefault() {
  const od = $("#odDate");
  if (od && !od.value) od.value = todayISO();
}

async function createOrder({ itemId, itemTitle, ownerUid, price, user }) {
  const date = ($("#odDate")?.value || "").trim();
  const people = parseInt($("#odPeople")?.value || "1", 10);
  const contact = ($("#odContact")?.value || "").trim();
  const payment = ($("#odPay")?.value || "card").trim();
  const memo = ($("#odMemo")?.value || "").trim();

  if (!date) throw new Error("예약 날짜를 입력하세요.");
  if (!Number.isFinite(people) || people < 1) throw new Error("인원은 1 이상이어야 합니다.");
  if (contact.length < 3) throw new Error("구매자 연락처를 입력하세요.");

  const payload = {
    itemId,
    itemTitle: String(itemTitle || ""),
    ownerUid,
    price: Number.isFinite(price) ? price : 0,

    buyerUid: user.uid,
    buyerName: user.displayName || user.email || "buyer",
    contact,
    date,
    people,
    payment,   // card | fiat | hex
    memo,

    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, "orders"), payload);
  return ref.id;
}

function bindOrder({ itemId, itemTitle, ownerUid, status, price, user }) {
  const form = $("#orderForm");
  const hint = $("#orderHint");
  const mini = $("#orderMini");

  if (mini) mini.textContent = "결제방법: 카드/법정화폐/HEX (현재는 주문 기록 저장 단계)";

  if (!user) {
    if (form) form.style.display = "none";
    if (hint) {
      hint.style.display = "block";
      hint.textContent = "예약/구매는 로그인 후 가능합니다.";
    }
    return;
  }

  if (ownerUid === user.uid) {
    if (form) form.style.display = "none";
    if (hint) {
      hint.style.display = "block";
      hint.textContent = "본인 상품에는 예약/구매 요청을 할 수 없습니다.";
    }
    return;
  }

  if (!["published","approved"].includes(status)) {
    if (form) form.style.display = "none";
    if (hint) {
      hint.style.display = "block";
      hint.textContent = "공개(published)된 상품만 예약/구매 요청이 가능합니다.";
    }
    return;
  }

  if (hint) hint.style.display = "none";
  if (form) form.style.display = "block";
  initOrderDefault();

  $("#btnOrder")?.addEventListener("click", async () => {
    try {
      $("#btnOrder").disabled = true;
      setOrderState("저장 중...");

      const oid = await createOrder({
        itemId,
        itemTitle,
        ownerUid,
        price,
        user,
      });

      // 예약 저장 후 결제/상세로 이동
      if (oid) {
        location.href = `./order_detail.html?id=${encodeURIComponent(oid)}`;
        return;
      }

      setOrderState("");
      alert("예약/구매 요청이 저장되었습니다. (상태: pending)");
      $("#odMemo").value = "";
    } catch (e) {
      console.error(e);
      setOrderState(e?.message || String(e));
      alert(e?.message || String(e));
    } finally {
      $("#btnOrder").disabled = false;
    }
  });
}

async function main({ user, profile }) {
  const id = getIdFromQuery();
  if (!id) {
    setState("오류: id 파라미터가 없습니다. 예) /item.html?id=문서ID");
    showBox(false);
    return;
  }

  setState("불러오는 중...");
  showBox(false);

  try {
    const snap = await getDoc(doc(db, "items", id));
    if (!snap.exists()) {
      setState("상품이 존재하지 않습니다.");
      showBox(false);
      return;
    }

    const data = snap.data();
    const viewerUid = user?.uid || "";
    const viewerIsAdmin = isAdmin(profile);

    const itemInfo = renderItem({ id, data, viewerUid, viewerIsAdmin });

    setState("");
    showBox(true);

    const reviews = await loadReviews(id);
    renderReviews(reviews);

    // 리뷰 작성
    const form = $("#rvFormWrap");
    const hint = $("#rvHint");

    if (!user) {
      if (form) form.style.display = "none";
      if (hint) {
        hint.style.display = "block";
        hint.textContent = "리뷰 작성은 로그인 후 가능합니다.";
      }
    } else if (itemInfo.ownerUid === user.uid) {
      if (form) form.style.display = "none";
      if (hint) {
        hint.style.display = "block";
        hint.textContent = "본인 상품에는 리뷰를 작성할 수 없습니다.";
      }
    } else if (!["published","approved"].includes(itemInfo.status)) {
      if (form) form.style.display = "none";
      if (hint) {
        hint.style.display = "block";
        hint.textContent = "공개(published)된 상품만 리뷰 작성이 가능합니다.";
      }
    } else {
      if (hint) hint.style.display = "none";
      if (form) form.style.display = "block";

      $("#btnRvSave")?.addEventListener("click", async () => {
        const rating = $("#rvRating")?.value || "5";
        const text = $("#rvText")?.value || "";

        try {
          $("#btnRvSave").disabled = true;
          await saveMyReview({ itemId: id, user, rating, text });

          const list = await loadReviews(id);
          renderReviews(list);
          alert("리뷰 저장 완료");
        } catch (e) {
          console.error(e);
          alert(e?.message || String(e));
        } finally {
          $("#btnRvSave").disabled = false;
        }
      });
    }

    // 예약/구매
    bindOrder({
      itemId: id,
      itemTitle: itemInfo.title,
      ownerUid: itemInfo.ownerUid,
      status: itemInfo.status,
      price: itemInfo.price,
      user,
    });

  } catch (e) {
    console.error(e);
    const msg = e?.message || String(e);

    if (msg.includes("Missing or insufficient permissions")) {
      setState("권한 문제: 현재 계정이 이 상품을 읽을 권한이 없습니다. (rules 확인)");
    } else {
      setState("오류: " + msg);
    }
    showBox(false);
  }
}

onAuthReady(async ({ user, profile }) => {
  await main({ user, profile });
});