// /assets/js/partials.js
// header/footer partial을 fetch로 주입합니다.
// Netlify/배포/로컬 모두 안전하게: 항상 "사이트 루트" 기준(/partials/...)으로 로드합니다.
// (페이지가 / 하위 경로여도 깨지지 않게)

(() => {
  function abs(urlPath){
    // urlPath: "/partials/header.html" 같은 루트 경로
    return new URL(urlPath, window.location.origin).toString();
  }

  async function loadInto(id, urlPath) {
    const el = document.getElementById(id);
    if (!el) return false;

    const url = abs(urlPath);
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`partial load failed: ${urlPath} (${res.status})`);

    const html = await res.text();
    el.innerHTML = html;
    return true;
  }

  async function mount(){
    try{
      // 루트 기준으로 고정
      await loadInto("siteHeader", "/partials/header.html");
      await loadInto("siteFooter", "/partials/footer.html");

      window.dispatchEvent(new CustomEvent("partials:loaded"));
      window.dispatchEvent(new CustomEvent("partials:mounted"));
    }catch(e){
      console.warn("partials mount failed:", e?.message || e);
      window.dispatchEvent(new CustomEvent("partials:error", { detail: e }));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
