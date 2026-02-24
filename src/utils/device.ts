/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */

/**
 * モバイル環境（画面サイズ）かどうかを判定します
 */
export const checkIsMobile = (): boolean => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 768 || (window.innerWidth <= 900 && window.matchMedia('(orientation: landscape)').matches);
};

/**
 * 低メモリ端末（RAM 8GB未満）かどうかを判定します
 */
export const checkIsLowMemory = (): boolean => {
    if (typeof navigator === 'undefined') return false;
    const nav = navigator as any;
    return nav.deviceMemory !== undefined && nav.deviceMemory < 8;
};

/**
 * メモリ節約（機能制限）が必要な環境かどうかを判定します
 */
export const checkNeedsLimit = (): boolean => {
    return checkIsMobile() || checkIsLowMemory();
};