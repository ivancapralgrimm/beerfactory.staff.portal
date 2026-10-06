import type {
  QuestionBank,
  QuizResult
} from "@/features/attestation/types";

const DB_NAME = "bfstaff-attestation-v2";
const DB_VERSION = 1;
const BANK_STORE = "bank";
const OUTBOX_STORE = "outbox";
const CURRENT_BANK_KEY = "current";
const FALLBACK_BANK_KEY = "bfstaff-attestation-bank-fallback-v1";
const FALLBACK_OUTBOX_KEY = "bfstaff-attestation-outbox-fallback-v1";

export type CachedAttestationBank = {
  key: typeof CURRENT_BANK_KEY;
  bank: QuestionBank;
  savedAt: string;
};

export type AttestationOutboxEntry = {
  clientAttemptId: string;
  userId: string;
  result: QuizResult;
  queuedAt: string;
};

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexeddb_unavailable"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(BANK_STORE)) {
        db.createObjectStore(BANK_STORE, { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        const store = db.createObjectStore(OUTBOX_STORE, {
          keyPath: "clientAttemptId"
        });
        store.createIndex("userId", "userId", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("indexeddb_open_failed"));
    request.onblocked = () => reject(new Error("indexeddb_blocked"));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error || new Error("indexeddb_transaction_failed"));
    transaction.onabort = () =>
      reject(transaction.error || new Error("indexeddb_transaction_aborted"));
  });
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("indexeddb_request_failed"));
  });
}

function readFallbackBank() {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(FALLBACK_BANK_KEY) || "null"
    ) as CachedAttestationBank | null;
    return parsed?.bank ? parsed : null;
  } catch {
    return null;
  }
}

function writeFallbackBank(record: CachedAttestationBank) {
  try {
    localStorage.setItem(FALLBACK_BANK_KEY, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

function readFallbackOutbox() {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(FALLBACK_OUTBOX_KEY) || "[]"
    ) as AttestationOutboxEntry[];

    return Array.isArray(parsed)
      ? parsed.filter(
          (entry) =>
            entry &&
            typeof entry.clientAttemptId === "string" &&
            typeof entry.userId === "string"
        )
      : [];
  } catch {
    return [];
  }
}

function writeFallbackOutbox(entries: AttestationOutboxEntry[]) {
  try {
    localStorage.setItem(
      FALLBACK_OUTBOX_KEY,
      JSON.stringify(entries.slice(-200))
    );
    return true;
  } catch {
    return false;
  }
}

async function readIndexedOutbox() {
  const db = await openDatabase();

  try {
    const transaction = db.transaction(OUTBOX_STORE, "readonly");
    const done = transactionDone(transaction);
    const values = await requestResult(
      transaction.objectStore(OUTBOX_STORE).getAll()
    ) as AttestationOutboxEntry[];
    await done;
    return values;
  } finally {
    db.close();
  }
}

export async function cacheAttestationBank(bank: QuestionBank) {
  const record: CachedAttestationBank = {
    key: CURRENT_BANK_KEY,
    bank,
    savedAt: new Date().toISOString()
  };

  try {
    const db = await openDatabase();

    try {
      const transaction = db.transaction(BANK_STORE, "readwrite");
      const done = transactionDone(transaction);
      transaction.objectStore(BANK_STORE).put(record);
      await done;
      return;
    } finally {
      db.close();
    }
  } catch (error) {
    if (!writeFallbackBank(record)) throw error;
  }
}

export async function readCachedAttestationBank() {
  try {
    const db = await openDatabase();

    try {
      const transaction = db.transaction(BANK_STORE, "readonly");
      const done = transactionDone(transaction);
      const value = await requestResult(
        transaction.objectStore(BANK_STORE).get(CURRENT_BANK_KEY)
      ) as CachedAttestationBank | undefined;
      await done;

      if (value?.bank) return value;
    } finally {
      db.close();
    }
  } catch {
    // Safari/private-mode fallback is handled below.
  }

  return readFallbackBank();
}

export async function enqueueAttestationAttempt(
  entry: AttestationOutboxEntry
) {
  try {
    const db = await openDatabase();

    try {
      const transaction = db.transaction(OUTBOX_STORE, "readwrite");
      const done = transactionDone(transaction);
      transaction.objectStore(OUTBOX_STORE).put(entry);
      await done;
      return;
    } finally {
      db.close();
    }
  } catch (error) {
    const entries = readFallbackOutbox();
    const withoutCurrent = entries.filter(
      (item) => item.clientAttemptId !== entry.clientAttemptId
    );

    if (!writeFallbackOutbox([...withoutCurrent, entry])) {
      throw error;
    }
  }
}

export async function listPendingAttestationAttempts(userId: string) {
  const merged = new Map<string, AttestationOutboxEntry>();

  try {
    for (const entry of await readIndexedOutbox()) {
      merged.set(entry.clientAttemptId, entry);
    }
  } catch {
    // Keep the localStorage fallback available even if IndexedDB is blocked.
  }

  for (const entry of readFallbackOutbox()) {
    if (!merged.has(entry.clientAttemptId)) {
      merged.set(entry.clientAttemptId, entry);
    }
  }

  return [...merged.values()]
    .filter((entry) => entry.userId === userId)
    .sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
}

export async function removePendingAttestationAttempt(
  clientAttemptId: string
) {
  try {
    const db = await openDatabase();

    try {
      const transaction = db.transaction(OUTBOX_STORE, "readwrite");
      const done = transactionDone(transaction);
      transaction.objectStore(OUTBOX_STORE).delete(clientAttemptId);
      await done;
    } finally {
      db.close();
    }
  } catch {
    // The fallback removal below is still attempted.
  }

  const entries = readFallbackOutbox();
  const filtered = entries.filter(
    (entry) => entry.clientAttemptId !== clientAttemptId
  );

  if (filtered.length !== entries.length) {
    writeFallbackOutbox(filtered);
  }
}

export async function pendingAttestationAttemptCount(userId: string) {
  return (await listPendingAttestationAttempts(userId)).length;
}
