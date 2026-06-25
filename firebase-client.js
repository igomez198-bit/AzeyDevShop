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

window.FIREBASE_AUTH_USER = null;
window.FIREBASE_AUTH_READY = false;
window.FIREBASE_AUTH_PROMISES = [];

function resolveAuthReady() {
  if (window.FIREBASE_AUTH_READY) return;
  window.FIREBASE_AUTH_READY = true;
  window.dispatchEvent(new Event('firebase-auth-ready'));
  while (window.FIREBASE_AUTH_PROMISES.length) {
    const next = window.FIREBASE_AUTH_PROMISES.shift();
    next(window.FIREBASE_AUTH_USER);
  }
}

onAuthStateChanged(auth, user => {
  window.FIREBASE_AUTH_USER = user;
  if (user) {
    console.log('Firebase anonymous sign-in successful:', user.uid);
    resolveAuthReady();
  } else if (window.FIREBASE_AUTH_READY) {
    console.warn('Firebase auth state changed: signed out');
  }
});

function waitForAuthReady(timeoutMs = 5000) {
  if (window.FIREBASE_AUTH_READY) {
    return Promise.resolve(window.FIREBASE_AUTH_USER);
  }
  return new Promise(resolve => {
    window.FIREBASE_AUTH_PROMISES.push(resolve);
    setTimeout(() => {
      if (!window.FIREBASE_AUTH_READY) {
        console.warn('Firebase auth ready timeout, continuing with current auth state.');
        resolveAuthReady();
      }
    }, timeoutMs);
  });
}

// Auto sign-in anonymously so write operations work if rules allow
signInAnonymously(auth)
  .catch(error => {
    console.error('Firebase anonymous sign-in failed:', error);
  })
  .finally(() => {
    if (!window.FIREBASE_AUTH_READY) {
      resolveAuthReady();
    }
  });

const productUpdateChannel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('deviation-products')
  : null;

const DATABASE_REST_URL = 'https://devi-e9064-default-rtdb.asia-southeast1.firebasedatabase.app';

function objToArray(obj) {
  if (!obj) return [];
  return Object.keys(obj)
    .map(k => ({ ...(obj[k] || {}), id: Number(k) }))
    .sort((a, b) => a.id - b.id);
}

window.PRODUCTS_LOADED = false;

async function restFetchProductsOnce() {
  try {
    const response = await fetch(`${DATABASE_REST_URL}/products.json`);
    if (!response.ok) return null;
    const val = await response.json();
    return objToArray(val);
  } catch (error) {
    console.warn('Firebase REST fetch failed:', error);
    return null;
  }
}

async function restSetProductsArray(products) {
  try {
    const obj = {};
    (products || []).forEach(p => {
      const id = Number(p.id) || Date.now();
      const { id: _removeId, ...payload } = p;
      obj[id] = payload;
    });
    const response = await fetch(`${DATABASE_REST_URL}/products.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(obj)
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`REST write failed: ${response.status} ${text}`);
    }
    return { ok: true, count: (products || []).length };
  } catch (error) {
    const errorMessage = error?.message || String(error);
    console.error('Firebase REST setProductsArray failed:', errorMessage);
    return { error: errorMessage };
  }
}

async function restUpdateProduct(product) {
  try {
    const id = Number(product.id);
    if (!id) throw new Error('Invalid product id');
    const { id: _removeId, ...payload } = product;
    const response = await fetch(`${DATABASE_REST_URL}/products/${id}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`REST update failed: ${response.status} ${text}`);
    }
    return { ok: true, id };
  } catch (error) {
    const errorMessage = error?.message || String(error);
    console.error('Firebase REST updateProduct failed:', errorMessage, { product });
    return { error: errorMessage };
  }
}

async function restBatchUpdateProducts(changedProducts = [], deletedIds = []) {
  try {
    const updates = {};
    (changedProducts || []).forEach(product => {
      const id = Number(product.id);
      if (!id) return;
      const { id: _removeId, ...payload } = product;
      updates[id] = payload;
    });
    (deletedIds || []).forEach(id => {
      const productId = Number(id);
      if (!productId) return;
      updates[productId] = null;
    });
    const response = await fetch(`${DATABASE_REST_URL}/products.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`REST batch update failed: ${response.status} ${text}`);
    }
    return { ok: true, count: Object.keys(updates).length };
  } catch (error) {
    const errorMessage = error?.message || String(error);
    console.error('Firebase REST batch update failed:', errorMessage, { changedProducts, deletedIds });
    return { error: errorMessage };
  }
}

async function batchUpdateProducts(changedProducts = [], deletedIds = []) {
  try {
    await waitForAuthReady();
    if (!window.FIREBASE_AUTH_USER) {
      console.warn('Firebase write proceeding without auth user; database rules must allow unauthenticated writes.');
    }
    const updates = {};
    (changedProducts || []).forEach(product => {
      const id = Number(product.id);
      if (!id) return;
      const { id: _removeId, ...payload } = product;
      updates[`products/${id}`] = payload;
    });
    (deletedIds || []).forEach(id => {
      const productId = Number(id);
      if (!productId) return;
      updates[`products/${productId}`] = null;
    });
    if (!Object.keys(updates).length) {
      return { ok: true, count: 0 };
    }
    await update(ref(db), updates);
    const deletedSet = new Set((deletedIds || []).map(id => Number(id)).filter(Boolean));
    const currentProducts = Array.isArray(window.PRODUCTS) ? window.PRODUCTS.slice() : [];
    const mergedProducts = currentProducts
      .filter(product => !deletedSet.has(Number(product.id)))
      .map(product => ({ ...product }));
    (changedProducts || []).forEach(product => {
      const id = Number(product.id);
      if (!id) return;
      const index = mergedProducts.findIndex(item => Number(item.id) === id);
      if (index >= 0) {
        mergedProducts[index] = { ...product };
      } else {
        mergedProducts.push({ ...product });
      }
    });
    window.PRODUCTS = mergedProducts;
    window.PRODUCTS_LOADED = true;
    try { localStorage.setItem('deviation_inventory_v1', JSON.stringify(mergedProducts)); } catch (e) {}
    dispatchProductUpdate();
    return { ok: true, count: Object.keys(updates).length };
  } catch (e) {
    console.warn('Firebase SDK batch update failed, trying REST fallback:', e);
    const restRes = await restBatchUpdateProducts(changedProducts, deletedIds);
    if (restRes && restRes.ok) {
      const deletedSet = new Set((deletedIds || []).map(id => Number(id)).filter(Boolean));
      const currentProducts = Array.isArray(window.PRODUCTS) ? window.PRODUCTS.slice() : [];
      const mergedProducts = currentProducts
        .filter(product => !deletedSet.has(Number(product.id)))
        .map(product => ({ ...product }));
      (changedProducts || []).forEach(product => {
        const id = Number(product.id);
        if (!id) return;
        const index = mergedProducts.findIndex(item => Number(item.id) === id);
        if (index >= 0) {
          mergedProducts[index] = { ...product };
        } else {
          mergedProducts.push({ ...product });
        }
      });
      window.PRODUCTS = mergedProducts;
      window.PRODUCTS_LOADED = true;
      try { localStorage.setItem('deviation_inventory_v1', JSON.stringify(mergedProducts)); } catch (e) {}
      dispatchProductUpdate();
      return restRes;
    }
    const errorMessage = restRes?.error || e?.message || String(e);
    console.error('Firebase batchUpdateProducts failed:', errorMessage, { changedProducts, deletedIds });
    return { error: errorMessage };
  }
}

function dispatchProductUpdate() {
  window.dispatchEvent(new Event('firebase-products-updated'));
  if (productUpdateChannel) {
    productUpdateChannel.postMessage({ type: 'products-updated' });
  }
}

async function fetchProductsOnce() {
  try {
    const snapshot = await get(ref(db, 'products'));
    const val = snapshot.exists() ? snapshot.val() : null;
    const arr = objToArray(val);
    try { localStorage.setItem('deviation_inventory_v1', JSON.stringify(arr)); } catch (e) {}
    window.PRODUCTS = arr;
    window.PRODUCTS_LOADED = true;
    dispatchProductUpdate();
    return arr;
  } catch (e) {
    console.warn('Firebase SDK fetch failed, trying REST fallback:', e);
    const arr = await restFetchProductsOnce();
    if (!Array.isArray(arr)) return null;
    try { localStorage.setItem('deviation_inventory_v1', JSON.stringify(arr)); } catch (e) {}
    window.PRODUCTS = arr;
    window.PRODUCTS_LOADED = true;
    dispatchProductUpdate();
    return arr;
  }
}

function subscribeProducts(onChange) {
  const r = ref(db, 'products');
  return onValue(r, snap => {
    const val = snap.exists() ? snap.val() : null;
    const arr = objToArray(val);
    try { localStorage.setItem('deviation_inventory_v1', JSON.stringify(arr)); } catch (e) {}
    window.PRODUCTS = arr;
    window.PRODUCTS_LOADED = true;
    dispatchProductUpdate();
    if (typeof onChange === 'function') onChange(arr);
  });
}

async function setProductsArray(products) {
  try {
    await waitForAuthReady();
    if (!window.FIREBASE_AUTH_USER) {
      console.warn('Firebase write proceeding without auth user; database rules must allow unauthenticated writes.');
    }
    const obj = {};
    (products || []).forEach(p => {
      const id = Number(p.id) || Date.now();
      const { id: _removeId, ...payload } = p;
      obj[id] = payload;
    });
    await set(ref(db, 'products'), obj);
    const arr = (products || []).map(p => ({ ...p }));
    window.PRODUCTS = arr;
    window.PRODUCTS_LOADED = true;
    try { localStorage.setItem('deviation_inventory_v1', JSON.stringify(arr)); } catch (e) {}
    dispatchProductUpdate();
    return { ok: true, count: arr.length };
  } catch (e) {
    console.warn('Firebase SDK write failed, trying REST fallback:', e);
    const restRes = await restSetProductsArray(products);
    if (restRes && restRes.ok) {
      const arr = (products || []).map(p => ({ ...p }));
      window.PRODUCTS = arr;
      window.PRODUCTS_LOADED = true;
      try { localStorage.setItem('deviation_inventory_v1', JSON.stringify(arr)); } catch (e) {}
      dispatchProductUpdate();
      return restRes;
    }
    const errorMessage = restRes?.error || e?.message || String(e);
    console.error('Firebase setProductsArray failed:', errorMessage, { products });
    return { error: errorMessage };
  }
}

async function updateProduct(product) {
  try {
    await waitForAuthReady();
    if (!window.FIREBASE_AUTH_USER) {
      console.warn('Firebase write proceeding without auth user; database rules must allow unauthenticated writes.');
    }
    const id = Number(product.id);
    if (!id) {
      throw new Error('Invalid product id for update');
    }
    const { id: _removeId, ...payload } = product;
    await update(ref(db, `products/${id}`), payload);
    const arr = Array.isArray(window.PRODUCTS) ? window.PRODUCTS.map(p => ({ ...p })) : [];
    window.PRODUCTS = arr;
    window.PRODUCTS_LOADED = true;
    try { localStorage.setItem('deviation_inventory_v1', JSON.stringify(arr)); } catch (e) {}
    dispatchProductUpdate();
    return { ok: true, id };
  } catch (e) {
    console.warn('Firebase SDK update failed, trying REST fallback:', e);
    const restRes = await restUpdateProduct(product);
    if (restRes && restRes.ok) {
      try { localStorage.setItem('deviation_inventory_v1', JSON.stringify(window.PRODUCTS || [])); } catch (e) {}
      dispatchProductUpdate();
      return restRes;
    }
    const errorMessage = restRes?.error || e?.message || String(e);
    console.error('Firebase updateProduct failed:', errorMessage, { product });
    return { error: errorMessage };
  }
}

async function addProduct(product) {
  try {
    await waitForAuthReady();
    if (!window.FIREBASE_AUTH_USER) {
      console.warn('Firebase write proceeding without auth user; database rules must allow unauthenticated writes.');
    }
    const snapshot = await get(ref(db, 'products'));
    const val = snapshot.exists() ? snapshot.val() : {};
    const keys = Object.keys(val || {}).map(k => Number(k)).filter(Boolean);
    const nextId = keys.length ? Math.max(...keys) + 1 : 1;
    const { id: _removeId, ...data } = product;
    await update(ref(db, `products/${nextId}`), data);
    dispatchProductUpdate();
    return { ok: true, id: nextId };
  } catch (e) {
    return { error: e.message };
  }
}

async function deleteProduct(id) {
  try {
    await waitForAuthReady();
    if (!window.FIREBASE_AUTH_USER) {
      console.warn('Firebase write proceeding without auth user; database rules must allow unauthenticated writes.');
    }
    await remove(ref(db, `products/${id}`));
    dispatchProductUpdate();
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
}

window.FirebaseClient = { fetchProductsOnce, subscribeProducts, setProductsArray, batchUpdateProducts, updateProduct, addProduct, deleteProduct };

// Auto-subscribe to keep clients in sync
subscribeProducts();
