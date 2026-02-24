/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */

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

/** 揮発性暗号化キー(RAM上にのみ存在し、メモリクリアされたら消える) */
let volatileKey: CryptoKey | null = null;

/** 
 * 暗号化キーを取得する
 * @returns CryptoKey 暗号化キー
 */
const getEncryptionKey = async (): Promise<CryptoKey> => {// 安全でないコンテキスト (HTTP) では crypto.subtle が undefined になる
    if (!window.isSecureContext || !crypto.subtle) {
        // nullを返すと型エラーになるので、エラーを投げて呼び出し側のcatchに飛ばす
        throw new Error("SECURE_CONTEXT_ERROR");
    }
    return volatileKey ? volatileKey : volatileKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
};

// IndexedDBの初期化

let dbInstance: IDBDatabase | null = null;

/** 
 * IndexedDBのインスタンスを取得する
 * @returns Promise<IDBDatabase> IndexedDBのインスタンス
 */
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

/**
 * ストア操作（暗号化・復号の自動ラップ）
 */
export const templateFileStore = {
    async get(id: string): Promise<StoredTemplate | undefined> {
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
        const db = await getDBInstance();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const request = tx.objectStore(STORE_NAME).delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },
    async keys(): Promise<string[]> {
        const db = await getDBInstance();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);

            // getAllKeys() を使用してすべての ID を取得
            const request = store.getAllKeys();

            request.onsuccess = () => resolve(request.result as string[]);
            request.onerror = () => reject(request.error);
        });
    },
    async getMetadataList(): Promise<{ id: string, name: string }[]> {
        const db = await getDBInstance();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);

            // getAllRecordsで中身を、getAllKeysでIDを同時に取得
            const request = store.getAll();
            const keyRequest = store.getAllKeys();

            tx.oncomplete = () => {
                const records = request.result as EncryptedRecord[];
                const ids = keyRequest.result as string[];

                // 暗号化された binary データ (encryptedData) は無視して、
                // 平文の name と id だけを返す
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
 * @returns Promise<{ id: string, name: string }[]> メタデータ(id, name)の配列
 */
export const getMetadataList = async (): Promise<{ id: string, name: string }[]> => {
    const db = await getDBInstance();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);

        // getAllRecordsで中身を、getAllKeysでIDを同時に取得
        const request = store.getAll();
        const keyRequest = store.getAllKeys();

        tx.oncomplete = () => {
            const records = request.result as EncryptedRecord[];
            const ids = keyRequest.result as string[];

            // 暗号化された binary データ (encryptedData) は無視して、
            // 平文の name と id だけを返す
            const metadata = records.map((rec, index) => ({
                id: ids[index],
                name: rec.name
            }));
            resolve(metadata);
        };

        tx.onerror = () => reject(tx.error);
    });
};