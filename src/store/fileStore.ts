/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */

import { checkNeedsLimit } from '../utils/device';

export interface StoredTemplate {
    url: string;
    name: string;
    type: string;
    data: ArrayBuffer;
}

interface EncryptedRecord {
    url: string;
    name: string;
    type: string;
    encryptedData: ArrayBuffer;
    iv: Uint8Array; // 復号に必要な初期化ベクトル
}

const DB_NAME = 'ResumakerDB';
const STORE_NAME = 'templates';

// ── モバイル向けインメモリストア ──
// IndexedDB を使わずメモリ上で管理することで、IDB の内部キャッシュによる
// メモリ圧迫を完全に排除する。タブリロード時にはデータが消失するが、
// 元々 clearTemplateFileStore() で毎回消去していたため動作上の違いはない。
const inMemoryStore = new Map<string, StoredTemplate>();

// ── 暗号化キー管理（デスクトップ専用） ──

/** 揮発性暗号化キー(RAM上にのみ存在し、メモリクリアされたら消える) */
let volatileKey: CryptoKey | null = null;

/** 
 * 暗号化キーを取得する（デスクトップ専用）
 * @returns CryptoKey 暗号化キー
 */
const getEncryptionKey = async (): Promise<CryptoKey> => {
    if (!window.isSecureContext || !crypto.subtle) {
        throw new Error("SECURE_CONTEXT_ERROR");
    }
    return volatileKey ? volatileKey : volatileKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
};

// ── IndexedDB（デスクトップ専用） ──

let dbInstance: IDBDatabase | null = null;

const getDBInstance = (): Promise<IDBDatabase> => {
    if (dbInstance) return Promise.resolve(dbInstance);

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore(STORE_NAME);
        };
        request.onsuccess = () => {
            dbInstance = request.result;
            resolve(dbInstance);
        };
        request.onerror = () => {
            reject(request.error);
        };
    });
}

// ── ストアAPI（モバイル: Map / デスクトップ: IndexedDB+暗号化）──

/**
 * モバイルかどうかでストレージ戦略を切り替えるユニファイドAPI
 */
export const templateFileStore = {
    async get(id: string): Promise<StoredTemplate | undefined> {
        // モバイル: インメモリから直接取得
        if (checkNeedsLimit()) {
            return inMemoryStore.get(id);
        }

        // デスクトップ: IndexedDB + 復号
        try {
            const db = await getDBInstance();
            const record: EncryptedRecord | undefined = await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const request = tx.objectStore(STORE_NAME).get(id);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });

            if (!record) return undefined;

            const key = await getEncryptionKey();
            const decryptedBuffer = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: new Uint8Array(record.iv) },
                key,
                record.encryptedData
            );

            return {
                url: record.url,
                name: record.name,
                type: record.type,
                data: decryptedBuffer
            };
        } catch (error) {
            console.error('復号失敗、またはデータが存在しません', error);
            return undefined;
        }
    },

    async set(id: string, value: StoredTemplate): Promise<void> {
        // モバイル: インメモリに保存（IDB書き込みゼロ）
        if (checkNeedsLimit()) {
            inMemoryStore.set(id, value);
            return;
        }

        // デスクトップ: 暗号化 + IndexedDB
        const key = await getEncryptionKey();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encryptedData = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            value.data
        );

        const record: EncryptedRecord = {
            url: value.url,
            name: value.name,
            type: value.type,
            encryptedData,
            iv
        };

        const db = await getDBInstance();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const request = tx.objectStore(STORE_NAME).put(record, id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    async delete(id: string): Promise<void> {
        // モバイル: インメモリから削除
        if (checkNeedsLimit()) {
            inMemoryStore.delete(id);
            return;
        }

        // デスクトップ: IndexedDB から削除
        const db = await getDBInstance();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const request = tx.objectStore(STORE_NAME).delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    async keys(): Promise<string[]> {
        if (checkNeedsLimit()) {
            return Array.from(inMemoryStore.keys());
        }

        const db = await getDBInstance();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.getAllKeys();
            request.onsuccess = () => resolve(request.result as string[]);
            request.onerror = () => reject(request.error);
        });
    },

    async getMetadataList(): Promise<{ id: string, name: string }[]> {
        if (checkNeedsLimit()) {
            return Array.from(inMemoryStore.entries()).map(([id, val]) => ({
                id,
                name: val.name
            }));
        }

        const db = await getDBInstance();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.getAll();
            const keyRequest = store.getAllKeys();

            tx.oncomplete = () => {
                const records = request.result as EncryptedRecord[];
                const ids = keyRequest.result as string[];
                const metadata = records.map((rec, index) => ({
                    id: ids[index],
                    name: rec.name
                }));
                resolve(metadata);
            };

            tx.onerror = () => reject(tx.error);
        });
    },
};

/**
 * ストア内の全データを削除する
 */
export const clearTemplateFileStore = async (): Promise<void> => {
    // モバイル: インメモリストアをクリア
    if (checkNeedsLimit()) {
        inMemoryStore.clear();
        return;
    }

    // デスクトップ: IndexedDB をクリア
    try {
        const db = await getDBInstance();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const req = tx.objectStore(STORE_NAME).clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (error) {
        console.error("IndexedDB クリアエラー", error);
    }
};

/**
 * 保存されている全テンプレートのメタデータ（ID、名前）のみを取得する
 */
export const getMetadataList = async (): Promise<{ id: string, name: string }[]> => {
    if (checkNeedsLimit()) {
        return Array.from(inMemoryStore.entries()).map(([id, val]) => ({
            id,
            name: val.name
        }));
    }

    const db = await getDBInstance();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        const keyRequest = store.getAllKeys();

        tx.oncomplete = () => {
            const records = request.result as EncryptedRecord[];
            const ids = keyRequest.result as string[];
            const metadata = records.map((rec, index) => ({
                id: ids[index],
                name: rec.name
            }));
            resolve(metadata);
        };

        tx.onerror = () => reject(tx.error);
    });
};