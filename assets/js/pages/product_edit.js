// /assets/js/pages/product_edit.js
// 상품 수정: 20장 이미지 + 포함/불포함/준비물(배열 저장) 통합

import { db, onAuthReady } from "../auth.js";
import { doc, getDoc, updateDoc, serverTimestamp } from "../firestore-bridge.js";

const $ = (id) => document.getElementById(id);

function setMsg(t){
  const el = $("saveMsg");
  if(el) el.textContent = t || "";
}

function qs(name){
  return new URLSearchParams(location.search).get(name);
}

function v(id){
  const el = $(id);
  return el ? String(el.value || "").trim() : "";
}

function parseLines(text){
  return String(text || "")
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.replace(/^[-•*]+\s*/, ""));
}

function linesToText(v){
  if(!v) return "";
  if(Array.isArray(v)) return v.map(x => String(x ?? "").trim()).filter(Boolean).join("\n");
  if(typeof v === "string") return v.trim();
  return "";
}

function uniqNonEmpty(arr){
  const out = [];
  const set = new Set();
  for(const x of (arr || [])){
    const s = String(x || "").trim();
    if(!s) continue;
    if(set.has(s)) continue;
    set.add(s);
    out.push(s);
  }
  return out;
}

function normalizeImages(data){
  // string[] 또는 {url}[] 모두 지원
  const raw = Array.isArray(data?.images) ? data.images : (data?.imageUrl ? [data.imageUrl] : []);
  return uniqNonEmpty(raw.map(x => (typeof x === "string") ? x : (x && typeof x === "object" ? (x.url || x.src || "") : "")));
}

onAuthReady(async ({ loggedIn, role, user })=>{
  if(!loggedIn){
    alert("로그인이 필요합니다.");
    location.href = "./guide.html";
    return;
  }
  if(!(role === "guide" || role === "admin")){
    alert("가이드 승인 후 이용 가능합니다.");
    location.href = "./guide.html";
    return;
  }

  const id = qs("id");
  if(!id){
    alert("잘못된 접근입니다. (id 없음)");
    location.href = "./my_products.html";
    return;
  }

  const form = $("formProduct");
  if(!form) return;

  const ref = doc(db, "items", id);
  const snap = await getDoc(ref);
  if(!snap.exists()){
    alert("상품을 찾을 수 없습니다.");
    location.href = "./my_products.html";
    return;
  }

  const data = snap.data() || {};
  const ownerUid = data.ownerUid || data.guideUid || "";
  if(role !== "admin" && ownerUid !== user.uid){
    alert("내 상품만 수정할 수 있습니다.");
    location.href = "./my_products.html";
    return;
  }

  // ===== 폼 채우기 =====
  $("pTitle").value = data.title || "";
  $("pCategory").value = data.category || "";
  $("pRegion").value = data.region || data.location || "";
  $("pPrice").value = (data.price ?? "") === null ? "" : String(data.price ?? "");
  $("pCurrency").value = data.currency || "KRW";
  $("pDesc").value = data.desc || "";

  // info3 (여러 키 호환)
  $("pIncludes").value = linesToText(data.includes ?? data.included ?? data.include ?? data.includeItems);
  $("pExcludes").value = linesToText(data.excludes ?? data.excluded ?? data.exclude ?? data.excludeItems);
  $("pPreparations").value = linesToText(data.preps ?? data.preparations ?? data.preparation ?? data.prepsText);

  // images: 최대 20
  const imgs = normalizeImages(data).slice(0, 20);
  for(let i=0;i<20;i++){
    const el = $(`pImage${i+1}`);
    if(el) el.value = imgs[i] || "";
  }

  // ===== 저장 =====
  form.addEventListener("submit", async (ev)=>{
    ev.preventDefault();
    setMsg("");

    const btn = $("btnSave");
    if(btn) btn.disabled = true;

    try{
      const title = v("pTitle");
      const category = v("pCategory");
      const region = v("pRegion");
      const priceRaw = v("pPrice");
      const price = priceRaw === "" ? "" : Number(priceRaw);
      const currency = v("pCurrency") || "KRW";
      const desc = v("pDesc");

      const includes = parseLines(v("pIncludes"));
      const excludes = parseLines(v("pExcludes"));
      const preps = parseLines(v("pPreparations"));

      const imagesRaw = Array.from({ length: 20 }, (_, i) => v(`pImage${i + 1}`)).filter(Boolean);
      const images = uniqNonEmpty(imagesRaw).slice(0, 20);
      const imageUrl = images[0] || "";

      if(!title || !category || !region){
        alert("상품명/카테고리/지역은 필수입니다.");
        return;
      }
      if(price !== "" && !Number.isFinite(price)){
        alert("가격 입력이 올바르지 않습니다.");
        return;
      }

      await updateDoc(ref, {
        title,
        category,
        region,
        location: region,
        price,
        currency,
        desc,

        includes,
        excludes,
        preps,

        images,
        imageUrl,

        // 수정 시 재검수(가이드가 published 유지 불가)
        status: (role === "admin") ? (data.status || "pending") : "pending",

        updatedAt: serverTimestamp(),
      });

      setMsg("저장 완료: 검수 대기(pending)");
      alert("저장되었습니다. (검수 대기)");
      location.href = "./my_products.html?updated=" + encodeURIComponent(id);
    }catch(err){
      console.error(err);
      alert("저장 실패: " + (err?.message || String(err)));
    }finally{
      if(btn) btn.disabled = false;
    }
  });
});
