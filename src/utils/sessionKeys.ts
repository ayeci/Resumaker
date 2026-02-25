/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */

export const SESSION_KEYS = {
    /** 重い処理（プレビュー生成など）の実行中フラグ */
    HEAVY_TASK: 'resumaker_heavy_task_running',
    /** バックグラウンド移行によるキル検知フラグ */
    BG_KILL: 'resumaker_bg_kill',
    /** OSのファイルピッカー展開中フラグ */
    PICKING_FILE: 'resumaker_picking_file',
    /** ユーザーの意図的なリロード・ページ遷移検知フラグ */
    INTENTIONAL_RELOAD: 'resumaker_intentional_reload',
    /** ページが正常に動作中であることを示す生存フラグ */
    ALIVE: 'resumaker_alive',
} as const;