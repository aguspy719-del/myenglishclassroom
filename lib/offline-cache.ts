"use client";

const DB_NAME = "english-lms-offline";
const DB_VERSION = 1;

const STORES = {
  materials: "materials",
  assignments: "assignments",
  grades: "grades",
  classes: "classes",
  announcements: "announcements",
  attendance: "attendance",
};

// Open IndexedDB
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      Object.values(STORES).forEach((store) => {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: "id" });
        }
      });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Save data to cache
export async function cacheData(storeName: string, data: any[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    data.forEach((item) => store.put(item));
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("Cache write failed:", err);
  }
}

// Get data from cache
export async function getCachedData(storeName: string): Promise<any[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("Cache read failed:", err);
    return [];
  }
}

// Clear a store
export async function clearCache(storeName: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).clear();
  } catch (err) {
    console.warn("Cache clear failed:", err);
  }
}

// Check if online
export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

// Hook to use cached data with online fallback
export async function fetchWithCache<T>(
  storeName: string,
  fetchFn: () => Promise<T[]>,
  forceRefresh = false
): Promise<{ data: T[]; fromCache: boolean }> {
  const online = isOnline();

  if (online && !forceRefresh) {
    try {
      const data = await fetchFn();
      if (data && data.length > 0) {
        await cacheData(storeName, data as any[]);
      }
      return { data, fromCache: false };
    } catch {
      // Fall through to cache
    }
  }

  // Offline or fetch failed — use cache
  const cached = await getCachedData(storeName);
  return { data: cached as T[], fromCache: true };
}
