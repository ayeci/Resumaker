/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { ResumeConfig } from '../types/resume';

interface FortuneSheetResult {
    sheets: Record<string, unknown>[];
    [key: string]: unknown;
}

interface WorkerTask {
    resume: ResumeConfig;
    file: File;
    resolve: (value: FortuneSheetResult) => void;
    reject: (reason: Error) => void;
}

/** Reactの外側（グローバル）で唯一の Worker と 行列（キュー）を管理 */
let worker: Worker | null = null;
const taskQueue: WorkerTask[] = [];
let isProcessing = false;

const processNextTask = () => {
    if (isProcessing || taskQueue.length === 0) return;
    isProcessing = true;

    // 1タスクごとに新しいWorkerを作る（常にクリーンなメモリ空間からスタート）
    worker = new Worker(
        new URL('../worker/excel.worker.ts', import.meta.url),
        { type: 'module' }
    );

    const currentTask = taskQueue.shift()!;

    const cleanupAndNext = () => {
        // 処理が終わったらWorkerを終了してOSにメモリを完全返還する
        if (worker) {
            worker.terminate();
            worker = null;
        }
        isProcessing = false;
        // 次のタスクまで少し休んで、OSのガベージコレクションを促す
        setTimeout(processNextTask, 150);
    };

    worker.onmessage = (e: MessageEvent) => {
        const { type, data, error } = e.data;
        if (type === 'SUCCESS') currentTask.resolve(data);
        else currentTask.reject(new Error(error || 'Worker処理エラー'));
        cleanupAndNext();
    };

    worker.onerror = (e) => {
        currentTask.reject(new Error(`Worker致命的エラー: ${e.message}`));
        cleanupAndNext();
    };

    // Workerには File オブジェクトを直接送る
    // Blob URL の portrait は Worker からアクセス不可なため、メインスレッドで事前変換
    const resumeForWorker = { ...currentTask.resume };
    (async () => {
        try {
            if (resumeForWorker.portrait && resumeForWorker.portrait.startsWith('blob:')) {
                const response = await fetch(resumeForWorker.portrait);
                const blob = await response.blob();
                const buffer = await blob.arrayBuffer();
                const bytes = new Uint8Array(buffer);
                // Workerに送るためdata URLに変換（Worker内のresolvePortraitImageが処理可能）
                let binary = '';
                for (let i = 0; i < bytes.length; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                const mimeMatch = blob.type.match(/image\/(png|jpeg|jpg|gif|tiff)/);
                const mimeType = mimeMatch ? blob.type : 'image/png';
                resumeForWorker.portrait = `data:${mimeType};base64,${btoa(binary)}`;
            }
        } catch (e) {
            console.error('Portrait conversion for Worker failed:', e);
            resumeForWorker.portrait = ''; // 変換失敗時は写真なしで続行
        }
        worker!.postMessage({
            type: 'PROCESS_EXCEL',
            payload: { resume: resumeForWorker, file: currentTask.file }
        });
    })();
};

const enqueueExcelTask = (resume: ResumeConfig, file: File): Promise<FortuneSheetResult> => {
    return new Promise((resolve, reject) => {
        taskQueue.push({ resume, file, resolve, reject });
        processNextTask();
    });
};

/** フック本体 */
export const useExcelWorker = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<FortuneSheetResult | null>(null);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    const generatePreview = useCallback(async (resume: ResumeConfig, file: File) => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await enqueueExcelTask(resume, file);
            if (isMounted.current) {
                setData(result);
                setIsLoading(false);
            }
            return result;
        } catch (err: any) {
            if (isMounted.current) {
                setError(err.message);
                setData(null);
                setIsLoading(false);
            }
            throw err;
        }
    }, []);

    return { generatePreview, isLoading, error, data };
};