// /assets/js/auth.js
// Firebase Auth + 역할(role) 판정 + 공통 헬퍼

import { auth, googleProvider, db } from "/assets/js/firebase-init.js";

import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

export { auth, googleProvider, db };
export { onAuthStateChanged, signOut };

// 로그인 (팝업 우선, 실패 시 리다이렉트)
export async function login(){
  try{
    await signInWithPopup(auth, googleProvider);
  }catch(e){
    const code = e?.code || "";
    const redirectLike =
      code === "auth/popup-closed-by-user" ||
      code === "auth/popup-blocked" ||
      code === "auth/cancelled-popup-request" ||
      code === "auth/unauthorized-domain";
    if(redirectLike){
      await signInWithRedirect(auth, googleProvider);
      return;
    }
    throw e;
  }
}

export async function handleRedirectResult(){
  try{
    await getRedirectResult(auth);
  }catch(e){
    console.warn("redirect result:", e?.code || e?.message || e);
  }
}

export function logout(){
  return signOut(auth);
}

// 역할 결정 규칙
// 1) admins/{uid} 있으면 그 role (기본 admin)
// 2) guides/{uid}.approved === true 이면 guide
// 3) users/{uid}.role 있으면 그 role
// 4) 로그인만 되어 있으면 user
export async function getUserRole(uid){
  if(!uid) return "guest";

  // 1) admins
  try{
    const aRef = doc(db, "admins", uid);
    const aSnap = await getDoc(aRef);
    if(aSnap.exists()){
      const data = aSnap.data() || {};
      return data.role || "admin";
    }
  }catch(e){
    console.warn("admins read failed:", e?.code || e?.message || e);
  }

  // 2) guides/{uid} (승인된 가이드는 role=guide)
  try{
    const gRef = doc(db, "guides", uid);
    const gSnap = await getDoc(gRef);
    if(gSnap.exists()){
      const g = gSnap.data() || {};
      if(g.approved === true) return "guide";
    }
  }catch(e){
    console.warn("guides read failed:", e?.code || e?.message || e);
  }

  // 3) users
  try{
    const uRef = doc(db, "users", uid);
    const uSnap = await getDoc(uRef);
    if(uSnap.exists()){
      const u = uSnap.data() || {};
      if(typeof u.role === "string" && u.role) return u.role;
    }
  }catch(e){
    console.warn("users read failed:", e?.code || e?.message || e);
  }

  return "user";
}

// 화면에서 쓰기 좋은 profile 오브젝트를 구성
export async function getUserProfile(user){
  if(!user) return null;
  const role = await getUserRole(user.uid);

  return {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || "",
    photoURL: user.photoURL || "",
    role,
  };
}

export function watchAuth(cb){
  return onAuthStateChanged(auth, async (user)=>{
    if(!user){
      cb({ loggedIn:false, role:"guest", user:null, profile:null });
      return;
    }

    const profile = await getUserProfile(user);
    cb({ loggedIn:true, role: profile?.role || "user", user, profile });
  });
}

// auth 상태 준비되면 1회 호출되는 헬퍼
export function onAuthReady(cb){
  let unsub = null;
  unsub = onAuthStateChanged(auth, async (user)=>{
    if(unsub) unsub(); // 1회만
    if(!user){
      cb({ loggedIn:false, role:"guest", user:null, profile:null });
      return;
    }

    const profile = await getUserProfile(user);
    cb({ loggedIn:true, role: profile?.role || "user", user, profile });
  });
}
