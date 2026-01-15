// /assets/js/header-auth.js
// 헤더의 로그인/로그아웃 + 역할별 메뉴 노출 + 모바일 햄버거

import {
  handleRedirectResult,
  login,
  logout,
  watchAuth,
} from "./auth.js";

function show(el, on){
  if(!el) return;
  el.style.display = on ? "" : "none";
}

function applyRoleToMenu(role){
  const badge = document.getElementById("roleBadge");
  if(badge){
    const text =
      role === "admin" ? "관리자" :
      role === "guide" ? "가이드" :
      role === "user"  ? "일반" :
      "게스트";
    badge.textContent = text;
    show(badge, role !== "guest");
  }

  // data-role이 있는 메뉴만 필터링. data-role이 없으면 항상 보임.
  const links = document.querySelectorAll("#hdrNav a");
  links.forEach((a)=>{
    const rule = (a.getAttribute("data-role") || "").trim();
    if(!rule){
      show(a, true);
      return;
    }
    const allow = rule.split(/\s+/).includes(role);
    show(a, allow);
  });
}

function initHamburger(){
  if(window.__pg_burger_bound) return;

  const header = document.getElementById("siteHeaderBar");
  const btn = document.getElementById("btnBurger");
  const nav = document.getElementById("hdrNav");

  if(!header || !btn || !nav) return;

  window.__pg_burger_bound = true;

  function openMenu(){
    header.classList.add("nav-open");
    btn.setAttribute("aria-expanded", "true");
  }

  function closeMenu(){
    header.classList.remove("nav-open");
    btn.setAttribute("aria-expanded", "false");
  }

  function toggleMenu(){
    header.classList.contains("nav-open") ? closeMenu() : openMenu();
  }

  btn.addEventListener("click", (e)=>{
    e.preventDefault();
    e.stopPropagation();
    toggleMenu();
  });

  nav.addEventListener("click", (e)=>{
    if(e.target && e.target.closest && e.target.closest("a")) closeMenu();
  });

  document.addEventListener("click", (e)=>{
    if(!header.classList.contains("nav-open")) return;
    if(!header.contains(e.target)) closeMenu();
  });

  document.addEventListener("keydown", (e)=>{
    if(e.key === "Escape") closeMenu();
  });

  window.addEventListener("resize", ()=>{
    if(window.matchMedia("(min-width: 861px)").matches){
      closeMenu();
    }
  });
}

async function bindHeader(){
  const btnLogin = document.getElementById("btnLogin");
  const btnLogout = document.getElementById("btnLogout");
  const nav = document.getElementById("hdrNav");

  // partial이 아직 안 붙었으면 스킵 (다음 이벤트에서 재시도)
  if(!btnLogin && !btnLogout && !nav) return;

  // 중복 바인딩 방지
  if(window.__pg_hdr_bound) return;
  window.__pg_hdr_bound = true;

  // redirect 로그인 흐름 처리(모바일/팝업차단 대비)
  await handleRedirectResult();

  if(btnLogin){
    btnLogin.onclick = async ()=>{
      try{ await login(); }catch(e){ console.warn(e); }
    };
  }

  if(btnLogout){
    btnLogout.onclick = async ()=>{
      try{ await logout(); }catch(e){ console.warn(e); }
    };
  }

  // 햄버거 바인딩 (partials 주입 후에만 가능)
  initHamburger();

  // 기본은 guest 메뉴
  applyRoleToMenu("guest");
  show(btnLogin, true);
  show(btnLogout, false);

  watchAuth(({ loggedIn, role })=>{
    show(btnLogin, !loggedIn);
    show(btnLogout, loggedIn);
    applyRoleToMenu(role || (loggedIn ? "user" : "guest"));
  });
}

// partials가 붙은 뒤에 바인딩
window.addEventListener("partials:mounted", bindHeader);
window.addEventListener("partials:loaded", bindHeader);
// 혹시 이벤트를 못 받았을 때를 대비
document.addEventListener("DOMContentLoaded", bindHeader);
