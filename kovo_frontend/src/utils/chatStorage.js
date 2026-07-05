// IndexedDB wrapper for local chat persistence
// PERF: Debounced writes to avoid performance overhead from constant IndexedDB transactions

const DB_NAME = 'kovo_chat_db';
const DB_VERSION = 1;
const STORE_NAME = 'conversations';

let dbInstance = null;

function openDB() {
  // PERF: Reuse the DB connection instead of opening a new one every time
  if (dbInstance) return Promise.resolve(dbInstance);
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'participantId' });
      }
    };
    request.onsuccess = (e) => {
      dbInstance = e.target.result;
      // Reset on close so we reopen next time
      dbInstance.onclose = () => { dbInstance = null; };
      resolve(dbInstance);
    };
    request.onerror = (e) => reject(e.target.error);
  });
}

// PERF: Debounce mechanism to batch IndexedDB writes
let pendingSave = null;
let saveTimer = null;
const SAVE_DEBOUNCE_MS = 500; // Wait 500ms after last change before writing to IndexedDB

export const chatStorage = {
  saveConversations(conversations) {
    // PERF: Store the latest data and debounce the actual write
    pendingSave = conversations;
    
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const dataToSave = pendingSave;
      pendingSave = null;
      saveTimer = null;
      chatStorage._doSave(dataToSave);
    }, SAVE_DEBOUNCE_MS);
  },

  async _doSave(conversations) {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      
      // Save each active conversation with up to 50 latest messages
      for (const conv of conversations) {
        // Filter out temporary states for saving
        const slicedMessages = conv.messages.slice(-50).map(m => ({
          id: m.id,
          senderId: m.senderId,
          text: m.text,
          postId: m.postId || null,
          reactions: m.reactions || [],
          ts: m.ts,
          status: m.status === 'sending' || m.status === 'failed' ? 'sent' : (m.status || 'sent')
        }));
        
        store.put({
          participantId: conv.participantId,
          participantUser: conv.participantUser,
          messages: slicedMessages,
          unread: conv.unread || 0,
          hasMore: conv.hasMore || false,
          nextCursor: conv.nextCursor || null,
          updatedAt: Date.now()
        });
      }
      
      // Wait for transaction to complete (no need to await each put individually)
      await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('[ChatStorage] Failed to save conversations:', err);
    }
  },

  async loadConversations() {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      
      return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('[ChatStorage] Failed to load conversations:', err);
      return [];
    }
  },

  async clear() {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('[ChatStorage] Failed to clear chat database:', err);
    }
  }
};
