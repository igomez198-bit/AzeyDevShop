// Firebase client (uses modular v9+ SDK)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getDatabase, ref, get, set, onValue, child, remove, update } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';

const firebaseConfig = {
  apiKey: "AIzaSyDuO_MGd39mqV2upPyRIvMlU5Cf0wSY6AU",
  authDomain: "devi-e9064.firebaseapp.com",
  databaseURL: "https://devi-e9064-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "devi-e9064",
  storageBucket: "devi-e9064.firebasestorage.app",
  messagingSenderId: "822796455497",
  appId: "1:822796455497:web:fdc318d6d5d5b829eef998",
  measurementId: "G-ZG4WYMBC0N"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// Auto sign-in anonymously so write operations work if rules allow
signInAnonymously(auth).catch(()=>{});

function objToArray(obj) {
  if (!obj) return [];
  return Object.keys(obj).map(k => ({ ...(obj[k] || {}), id: Number(k) })).sort((a,b)=>a.id-b.id);
}

async function fetchProductsOnce() {
  try {
    const snapshot = await get(ref(db, 'products'));
    const val = snapshot.exists() ? snapshot.val() : null;
    const arr = objToArray(val);
    // keep local storage in sync
    try { localStorage.setItem('deviation_inventory_v1', JSON.stringify(arr)); } catch (e) {}
    window.PRODUCTS = arr;
    // notify pages
    window.dispatchEvent(new Event('storage'));
    return arr;
  } catch (e) {
    return null;
  }
}

function subscribeProducts(onChange) {
  const r = ref(db, 'products');
  return onValue(r, snap => {
    const val = snap.exists() ? snap.val() : null;
    const arr = objToArray(val);
    try { localStorage.setItem('deviation_inventory_v1', JSON.stringify(arr)); } catch (e) {}
    window.PRODUCTS = arr;
    window.dispatchEvent(new Event('storage'));
    if (typeof onChange === 'function') onChange(arr);
  });
}

async function setProductsArray(products) {
  try {
    const obj = {};
    (products || []).forEach(p => {
      const id = Number(p.id) || Date.now();
      obj[id] = { ...p };
      obj[id].id = undefined;
    });
    await set(ref(db, 'products'), obj);
    return { ok: true, count: (products || []).length };
  } catch (e) {
    return { error: e.message };
  }
}

async function addProduct(product) {
  try {
    // fetch current products to compute next id
    const snapshot = await get(ref(db, 'products'));
    const val = snapshot.exists() ? snapshot.val() : {};
    const keys = Object.keys(val || {}).map(k=>Number(k)).filter(Boolean);
    const nextId = keys.length ? Math.max(...keys)+1 : 1;
    const data = { ...product };
    delete data.id;
    await update(ref(db, `products/${nextId}`), data);
    return { ok: true, id: nextId };
  } catch (e) {
    return { error: e.message };
  }
}

async function deleteProduct(id){
  try{
    await remove(ref(db, `products/${id}`));
    return { ok: true };
  }catch(e){
    return { error: e.message };
  }
}

window.FirebaseClient = { fetchProductsOnce, subscribeProducts, setProductsArray, addProduct, deleteProduct };

// Auto-subscribe to keep clients in sync
subscribeProducts();
