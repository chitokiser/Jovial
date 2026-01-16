// /assets/js/pages/index.js
// 홈(공개 상품): published items 로드 + KPI/랭킹/리더보드 렌더
// 중요: Firestore 복합 인덱스 없이 동작하도록 orderBy 제거, 프론트에서 정렬

import { db } from "../firebase-init.js";
import {
  collection,
  query,
  where,
  limit,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { toItemViewModel, renderItemCard, renderRatingInline, esc, catLabel } from "./index.lib.js";

const $ = (id) => document.getElementById(id);

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function fmt1(v) {
  const x = Number(v);
  if (!Number.isFinite(x)) return "-";
  return String(Math.round(x * 10) / 10);
}

function tsSeconds(v) {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "object" && typeof v.seconds === "number") return v.seconds;
  return 0;
}

function computeKpi(items) {
  const published = items.length;
  let sumReviews = 0;
  let sumWeighted = 0;

  for (const it of items) {
    const c = n(it.ratingCount, 0);
    const a = n(it.ratingAvg, 0);
    sumReviews += c;
    sumWeighted += a * c;
  }

  const weightedAvg = sumReviews > 0 ? sumWeighted / sumReviews : 0;

  if ($("kpiPublished")) $("kpiPublished").textContent = String(published);
  if ($("kpiReviews")) $("kpiReviews").textContent = String(sumReviews);
  if ($("kpiAvg")) $("kpiAvg").textContent = sumReviews > 0 ? fmt1(weightedAvg) : "-";
}

function matchSearch(it, q) {
  if (!q) return true;
  const s = q.toLowerCase();
  const hay = [it.title, it.region, it.category, it.guideName]
    .map((x) => String(x || "").toLowerCase())
    .join(" ");
  return hay.includes(s);
}

function sortItems(items, mode) {
  const arr = items.slice();
  if (mode === "rating") {
    arr.sort((a, b) => {
      const ba = n(b.ratingAvg, 0), aa = n(a.ratingAvg, 0);
      if (ba !== aa) return ba - aa;
      return n(b.ratingCount, 0) - n(a.ratingCount, 0);
    });
    return arr;
  }
  if (mode === "reviews") {
    arr.sort((a, b) => n(b.ratingCount, 0) - n(a.ratingCount, 0));
    return arr;
  }
  // recent
  arr.sort((a, b) => n(b._ts, 0) - n(a._ts, 0));
  return arr;
}

function fillCategoryOptions(items) {
  const set = new Set();
  items.forEach((it) => set.add(it.category || "기타"));
  const cats = Array.from(set).sort((a, b) => String(a).localeCompare(String(b)));

  const sel = $("rankCat");
  if (!sel) return;

  sel.innerHTML =
    `<option value="__all__">전체</option>` +
    cats.map((c) => `<option value="${esc(c)}">${esc(catLabel(c))}</option>`).join("");
}

function renderItemsGrid(items) {
  const q = ($("qSearch")?.value || "").trim();
  const sortMode = $("qSort")?.value || "recent";

  const filtered = items.filter((it) => matchSearch(it, q));
  const sorted = sortItems(filtered, sortMode);

  const state = $("itemsState");
  if (state) state.textContent = `총 ${sorted.length}개 (published)`;

  const grid = $("itemsGrid");
  if (grid) grid.innerHTML = sorted.map(renderItemCard).join("");
}

function renderCategoryRanking(items) {
  const cat = $("rankCat")?.value || "__all__";
  const metric = $("rankMetric")?.value || "rating";

  const pool = items.filter((it) => (cat === "__all__" ? true : it.category === cat));
  const state = $("rankState");
  const list = $("rankList");
  if (!list || !state) return;

  if (!pool.length) {
    state.textContent = "표시할 항목이 없습니다.";
    list.innerHTML = "";
    return;
  }

  const sorted = pool.slice();
  if (metric === "reviews") {
    sorted.sort((a, b) => n(b.ratingCount, 0) - n(a.ratingCount, 0));
  } else {
    sorted.sort((a, b) => {
      const ba = n(b.ratingAvg, 0), aa = n(a.ratingAvg, 0);
      if (ba !== aa) return ba - aa;
      return n(b.ratingCount, 0) - n(a.ratingCount, 0);
    });
  }

  const top = sorted.slice(0, 6);
  state.textContent = `카테고리: ${cat === "__all__" ? "전체" : catLabel(cat)} · 상위 ${top.length}`;
  list.innerHTML = top
    .map((it, i) => {
      const rating = renderRatingInline(n(it.ratingAvg, 0), n(it.ratingCount, 0));
      const reviews = n(it.ratingCount, 0);
      const line = metric === "reviews" ? `리뷰 ${reviews}` : `평점 ${fmt1(n(it.ratingAvg, 0))} · 리뷰 ${reviews}`;
      return `
        <a class="rank-row" href="./item.html?id=${encodeURIComponent(it.id)}">
          <span class="rank-no">${i + 1}</span>
          <span class="rank-title">${esc(it.title || "(상품)")}</span>
          <span class="rank-meta">${metric === "reviews" ? esc(line) : rating}</span>
        </a>
      `;
    })
    .join("");
}

function computeGuideLeaderboard(items) {
  const map = new Map();
  for (const it of items) {
    const guideUid = it.guideUid || it.ownerUid || "unknown";
    const key = guideUid;
    if (!map.has(key)) {
      map.set(key, {
        guideUid,
        guideName: it.guideName || "",
        items: 0,
        reviewCount: 0,
        weightedSum: 0,
        itemsAvgSum: 0,
        itemsWithReviews: 0,
      });
    }
    const g = map.get(key);
    g.items += 1;
    g.guideName = g.guideName || it.guideName || "";

    const c = n(it.ratingCount, 0);
    const a = n(it.ratingAvg, 0);
    g.reviewCount += c;
    g.weightedSum += a * c;
    if (c > 0) {
      g.itemsAvgSum += a;
      g.itemsWithReviews += 1;
    }
  }

  return Array.from(map.values()).map((g) => {
    const weightedAvg = g.reviewCount > 0 ? g.weightedSum / g.reviewCount : 0;
    const itemsAvg = g.itemsWithReviews > 0 ? g.itemsAvgSum / g.itemsWithReviews : 0;
    return { ...g, weightedAvg, itemsAvg };
  });
}

function renderGuideLeaderboard(items) {
  const metric = $("leadMetric")?.value || "weighted";
  const leaders = computeGuideLeaderboard(items);

  const sorted = leaders.slice();
  if (metric === "reviews") {
    sorted.sort((a, b) => n(b.reviewCount, 0) - n(a.reviewCount, 0));
  } else if (metric === "items") {
    sorted.sort((a, b) => n(b.items, 0) - n(a.items, 0));
  } else if (metric === "avg") {
    sorted.sort((a, b) => n(b.itemsAvg, 0) - n(a.itemsAvg, 0));
  } else {
    sorted.sort((a, b) => {
      const bw = n(b.weightedAvg, 0), aw = n(a.weightedAvg, 0);
      if (bw !== aw) return bw - aw;
      return n(b.reviewCount, 0) - n(a.reviewCount, 0);
    });
  }

  const top = sorted.slice(0, 10);
  const state = $("leadState");
  const list = $("leadList");
  if (!state || !list) return;

  state.textContent = `상위 ${top.length}`;
  list.innerHTML = top
    .map((g, i) => {
      const line =
        metric === "reviews" ? `리뷰 ${n(g.reviewCount, 0)}` :
        metric === "items" ? `상품 ${n(g.items, 0)}개` :
        metric === "avg" ? `단순 평균 ${fmt1(g.itemsAvg)} · 리뷰 ${n(g.reviewCount, 0)}` :
        `가중 평균 ${fmt1(g.weightedAvg)} · 리뷰 ${n(g.reviewCount, 0)}`;

      const rating = renderRatingInline(
        metric === "avg" ? n(g.itemsAvg, 0) : n(g.weightedAvg, 0),
        n(g.reviewCount, 0)
      );

      return `
        <div class="lead-row">
          <span class="lead-no">${i + 1}</span>
          <span class="lead-name">${esc(g.guideName || g.guideUid)}</span>
          <span class="lead-meta">${metric === "items" || metric === "reviews" ? esc(line) : rating}</span>
        </div>
      `;
    })
    .join("");
}

async function loadPublishedItems() {
  // 인덱스 없이 동작: where만 사용 (정렬은 프론트에서)
  const q = query(
    collection(db, "items"),
    where("status", "==", "published"),
    limit(500)
  );

  const snap = await getDocs(q);

  const items = [];
  snap.forEach((d) => {
    const data = d.data() || {};
    const vm = toItemViewModel(d.id, data);

    vm._ts = tsSeconds(data.createdAt);
    vm.guideUid = data.guideUid || data.ownerUid || "";
    vm.guideName = data.guideName || data.ownerName || "";

    items.push(vm);
  });

  // 기본 recent 기준으로 미리 정렬
  items.sort((a, b) => n(b._ts, 0) - n(a._ts, 0));
  return items;
}

(async function init() {
  try {
    const items = await loadPublishedItems();

    computeKpi(items);
    fillCategoryOptions(items);

    renderItemsGrid(items);
    renderCategoryRanking(items);
    renderGuideLeaderboard(items);

    $("qSearch")?.addEventListener("input", () => renderItemsGrid(items));
    $("qSort")?.addEventListener("change", () => renderItemsGrid(items));
    $("rankCat")?.addEventListener("change", () => renderCategoryRanking(items));
    $("rankMetric")?.addEventListener("change", () => renderCategoryRanking(items));
    $("leadMetric")?.addEventListener("change", () => renderGuideLeaderboard(items));
  } catch (e) {
    console.error(e);
    const state = $("itemsState");
    if (state) state.textContent = "권한 또는 네트워크 문제로 불러오지 못했습니다.";
  }
})();
