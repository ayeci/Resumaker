/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */

/**
 * 画面サイズに基づいて「モバイル表示」が必要かどうかを判定します
 */
export const checkIsMobile = (): boolean => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 768 || (window.innerWidth <= 900 && window.matchMedia('(orientation: landscape)').matches);
};

/**
 * Android, iOS, iPad などのモバイルプラットフォームかどうかを判定します
 */
export const checkIsMobilePlatform = (): boolean => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    return /Android|iPhone|iPad|iPod|Windows Phone/i.test(ua);
};

/**
 * 低メモリ端末（RAM 8GB未満）かどうかを判定します
 */
export const checkIsLowMemory = (): boolean => {
    if (typeof navigator === 'undefined') return false;
    const nav = navigator as any;
    // nav.deviceMemory はChromeなどの一部のブラウザのみサポート
    return nav.deviceMemory !== undefined && nav.deviceMemory < 8;
};

/**
 * メモリ節約（機能制限・暗号化スキップ・IDB回避）が必要な環境かどうかを判定します。
 * PCでウィンドウサイズを小さくしただけのケースをモバイルと誤認しないよう、
 * プラットフォームとRAM容量を優先して判定します。
 */
export const checkNeedsLimit = (): boolean => {
    return checkIsMobilePlatform() || checkIsLowMemory();
};