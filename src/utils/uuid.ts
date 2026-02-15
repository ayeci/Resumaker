/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */

/**
 * UUID (v4) を生成する
 * ブラウザの crypto.randomUUID() が利用可能な場合はそれを使用し、
 * 非セキュアコンテキスト（HTTPアクセス時など）で利用できない場合は
 * math.random ベースのフォールバックを使用する。
 */
export const generateUUID = (): string => {
    // 1. crypto.randomUUID() が利用可能な場合
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    // 2. フォールバック (RFC 4122 v4 準拠に近い形式)
    // 注意: セキュリティ要件が高い用途には不向きだが、UIのID生成には十分
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};
