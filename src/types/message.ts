/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */

/**
 * 通知メッセージの型定義
 */
export type Message = {
    open: boolean | undefined;
    severity: "success" | "error" | "warning";
    message: string;
};