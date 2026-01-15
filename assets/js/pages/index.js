// /assets/js/pages/index.js

import {
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// 절대경로로 통일 (배포/로컬 모두 안전)
import { db } from "/assets/js/firebase-init.js";

import { toItemViewModel, renderItemCard } from "./index.lib.js";

function pickEl(ids){
  for(const id of ids){
    const el = document.getElementById(id);
    if(el) return el;
  }
  return null;
}

// 프로젝트마다 id가 달라서 후보군으로 흡수
const listEl  = pickEl(["pubList", "itemList", "itemsList", "list", "grid", "itemsGrid"]);
const stateEl = pickEl(["pubState", "itemsState", "state", "loadingState", "listState"]);

if (!listEl || !stateEl) {
  console.error("index.js: list/state element not found", { listEl, stateEl });
} 

function tsSeconds(v) {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (typeof v.seconds === "number") return v.seconds;
  return 0;
}

async function loadItems() {
  if (!listEl || !stateEl) return;

  try {
    stateEl.textContent = "불러오는 중...";

    const q = query(
      collection(db, "items"),
      where("status", "==", "published")
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      stateEl.textContent = "등록된 상품이 없습니다.";
      listEl.innerHTML = "";
      return;
    }

    const rows = [];
    snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));

    rows.sort((a, b) => {
      const ta = tsSeconds(a.createdAt) || tsSeconds(a.updatedAt);
      const tb = tsSeconds(b.createdAt) || tsSeconds(b.updatedAt);
      return tb - ta;
    });

    let html = "";
    for (const r of rows) {
      const vm = toItemViewModel(r.id, r);
      html += renderItemCard(vm);
    }

    listEl.innerHTML = html;
    stateEl.textContent = "";
  } catch (e) {
    console.error(e);
    stateEl.textContent = e?.message || "상품을 불러오지 못했습니다.";
  }
}

loadItems();
