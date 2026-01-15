// /assets/js/pages/product_edit.js
import { db, onAuthReady } from "../auth.js";
import { doc, getDoc, updateDoc, serverTimestamp } from "../firestore-bridge.js";

function $(id){ return document.getElementById(id); }

function setMsg(t){
  const el = $("saveMsg");
  if(el) el.textContent = t || "";
}

function qs(name){
  return new URLSearchParams(location.search).get(name);
}

function uniqNonEmpty(arr){
  const out = [];
  const set = new Set();
  for(const v of (arr || [])){
    const s = String(v || "").trim();
    if(!s) continue;
    if(set.has(s)) continue;
    set.add(s);
    out.push(s);
  }
  return out;
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

  // 폼 채우기
  $("pTitle").value = data.title || "";
  $("pCategory").value = data.category || "";
  $("pRegion").value = data.region || "";
  $("pPrice").value = (data.price ?? "") === null ? "" : String(data.price ?? "");
  $("pCurrency").value = data.currency || "KRW";
  $("pDesc").value = data.desc || "";

  const images = Array.isArray(data.images) ? data.images : (data.imageUrl ? [data.imageUrl] : []);
  const imgs = uniqNonEmpty(images).slice(0,4);
  $("pImage1").value = imgs[0] || "";
  $("pImage2").value = imgs[1] || "";
  $("pImage3").value = imgs[2] || "";
  $("pImage4").value = imgs[3] || "";

  form.addEventListener("submit", async (ev)=>{
    ev.preventDefault();
    setMsg("");

    const btn = $("btnSave");
    if(btn) btn.disabled = true;

    try{
      const title = ($("pTitle").value || "").trim();
      const category = ($("pCategory").value || "").trim();
      const region = ($("pRegion").value || "").trim();
      const priceRaw = ($("pPrice").value || "").trim();
      const price = priceRaw === "" ? "" : Number(priceRaw);
      const currency = ($("pCurrency").value || "KRW").trim();
      const desc = ($("pDesc").value || "").trim();

      const newImages = uniqNonEmpty([
        ($("pImage1")?.value || "").trim(),
        ($("pImage2")?.value || "").trim(),
        ($("pImage3")?.value || "").trim(),
        ($("pImage4")?.value || "").trim(),
      ]).slice(0,4);

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
        price,
        currency,
        desc,
        images: newImages,
        imageUrl: newImages[0] || "",

        // 수정 시 재검수(가이드가 published 상태를 유지할 수 없게)
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
