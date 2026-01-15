// /assets/js/pages/product_new.js
import { db, onAuthReady } from "../auth.js";
import { doc, getDoc, collection, addDoc, serverTimestamp } from "../firestore-bridge.js";

function $(id){ return document.getElementById(id); }

function setMsg(t){
  const el = $("saveMsg");
  if(el) el.textContent = t || "";
}

async function getGuideName(uid, fallback){
  try{
    const gRef = doc(db, "guides", uid);
    const gSnap = await getDoc(gRef);
    if(gSnap.exists()){
      const g = gSnap.data() || {};
      if(g.name) return g.name;
    }
  }catch(e){
    console.warn("guides read:", e);
  }
  return fallback || "가이드";
}

onAuthReady(async ({ loggedIn, role, user })=>{
  if(!loggedIn){
    alert("로그인이 필요합니다.");
    location.href = "./guide.html";
    return;
  }
  if(!(role === "guide" || role === "admin")){
    alert("가이드 승인 후 상품 등록이 가능합니다. 먼저 가이드 신청을 해주세요.");
    location.href = "./guide.html";
    return;
  }

  const form = $("formProduct");
  if(!form) return;

  form.addEventListener("submit", async (ev)=>{
    ev.preventDefault();
    setMsg("");

    const btn = $("btnSave");
    if(btn) btn.disabled = true;

    try{
      const title = ($("pTitle").value || "").trim();
      const category = ($("pCategory").value || "").trim();
      const region = ($("pRegion").value || "").trim();
      const price = Number(($("pPrice").value || "0").trim() || 0);
      const currency = ($("pCurrency").value || "KRW").trim();
      const desc = ($("pDesc").value || "").trim();
      const images = [
      ($("pImage1")?.value || "").trim(),
      ($("pImage2")?.value || "").trim(),
      ($("pImage3")?.value || "").trim(),
      ($("pImage4")?.value || "").trim(),
    ].filter(Boolean);
    const imageUrl = images[0] || "";

      if(!title || !category || !region){
        alert("상품명/카테고리/지역은 필수입니다.");
        return;
      }

      const guideName = await getGuideName(user.uid, user.displayName || "");

      const payload = {
        title,
        category,
        region,
        price,
        currency,
        desc,
        images,
        imageUrl,
        status: "pending",          // 관리자 승인 대기
        guideUid: user.uid,         // 가이드 UID
        ownerUid: user.uid,         // 소유자(동일)
        guideName,
        reviewCount: 0,
        reviewSum: 0,
        reviewAvg: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const ref = await addDoc(collection(db, "items"), payload);
      setMsg("등록 완료: 검수 대기(pending)");
      // 바로 내 상품으로 이동
      location.href = "./my_products.html?created=" + encodeURIComponent(ref.id);
    }catch(err){
      console.error(err);
      alert("등록 실패: " + (err?.message || String(err)));
    }finally{
      if(btn) btn.disabled = false;
    }
  });
});
