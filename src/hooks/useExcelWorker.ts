/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { ResumeConfig } from '../types/resume';

/** FortuneSheet変換結果の型 */
interface FortuneSheetResult {
    sheets: Record<string, unknown>[];
    [key: string]: unknown;
}

/** Workerからの応答メッセージの型 */
interface WorkerResponse {
    type: 'SUCCESS' | 'ERROR';
    data?: FortuneSheetResult;
    error?: string;
}

/** useExcelWorkerの戻り値 */
interface UseExcelWorkerReturn {
    /** Worker経由でExcel生成→FortuneSheet変換を実行し、結果をPromiseで返す */
    generatePreview: (resume: ResumeConfig, templateBuffer: ArrayBuffer) => Promise<FortuneSheetResult>;
    /** 処理中フラグ */
    isLoading: boolean;
    /** エラー情報 */
    error: string | null;
    /** 成功時のFortuneSheetデータ（sheetsなど） */
    data: FortuneSheetResult | null;
}

/**
 * Excel生成処理をWeb Workerで実行するカスタムフック
 *
 * - Vite環境対応の Worker 構文を使用
 * - コンポーネントアンマウント時に自動で worker.terminate()
 * - generatePreview は Promise を返す
 */
export const useExcelWorker = (): UseExcelWorkerReturn => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<FortuneSheetResult | null>(null);

    // Workerインスタンスを保持
    const workerRef = useRef<Worker | null>(null);
    // Promise の resolve/reject を保持
    const pendingRef = useRef<{
        resolve: (value: FortuneSheetResult) => void;
        reject: (reason: Error) => void;
    } | null>(null);

    // Worker初期化（マウント時に1回だけ）
    useEffect(() => {
        const worker = new Worker(
            new URL('../worker/excel.worker.ts', import.meta.url),
            { type: 'module' }
        );

        worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
            const { type, data: responseData, error: responseError } = e.data;

            if (type === 'SUCCESS' && responseData) {
                setData(responseData);
                setError(null);
                setIsLoading(false);
                pendingRef.current?.resolve(responseData);
            } else if (type === 'ERROR') {
                const errMsg = responseError || '不明なエラーが発生しました';
                setError(errMsg);
                setData(null);
                setIsLoading(false);
                pendingRef.current?.reject(new Error(errMsg));
            }

            pendingRef.current = null;
        };

        worker.onerror = (e) => {
            const errMsg = `Worker エラー: ${e.message}`;
            setError(errMsg);
            setData(null);
            setIsLoading(false);
            pendingRef.current?.reject(new Error(errMsg));
            pendingRef.current = null;
        };

        workerRef.current = worker;

        // クリーンアップ: アンマウント時にWorkerを終了
        return () => {
            worker.terminate();
            workerRef.current = null;
            // 未解決のPromiseがあればreject
            if (pendingRef.current) {
                pendingRef.current.reject(new Error('コンポーネントがアンマウントされました'));
                pendingRef.current = null;
            }
        };
    }, []);

    /**
     * Worker経由でExcel生成→FortuneSheet変換を実行する
     * @param resume 履歴書データ
     * @param templateBuffer テンプレートのArrayBuffer
     * @returns FortuneSheetデータ (Promise)
     */
    const generatePreview = useCallback((resume: ResumeConfig, templateBuffer: ArrayBuffer): Promise<FortuneSheetResult> => {
        return new Promise<FortuneSheetResult>((resolve, reject) => {
            if (!workerRef.current) {
                const err = new Error('Worker が初期化されていません');
                setError(err.message);
                reject(err);
                return;
            }

            // 前回の未解決Promiseがあればreject
            if (pendingRef.current) {
                pendingRef.current.reject(new Error('新しいリクエストにより前回の処理がキャンセルされました'));
            }

            setIsLoading(true);
            setError(null);
            pendingRef.current = { resolve, reject };

            workerRef.current.postMessage({
                type: 'PROCESS_EXCEL',
                payload: { resume, templateBuffer }
            });
        });
    }, []);

    return { generatePreview, isLoading, error, data };
};
