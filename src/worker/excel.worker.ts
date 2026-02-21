/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */

import { transformExcelToFortune } from '@zenmrp/fortune-sheet-excel';
import { generateExcelBlob } from '../utils/exporter';

// Web Worker 環境向けのポリフィル (一部のExcelパーサーがwindowやdocumentを要求するため)
if (typeof self !== 'undefined' && (self as any).window === undefined) {
    (self as any).window = self;
    (self as any).document = {
        createElement: () => ({
            style: {},
            getContext: () => ({
                measureText: () => ({ width: 0, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0 })
            })
        }),
        createTextNode: () => ({}),
        documentElement: { style: {} },
        createElementNS: () => ({ style: {} }),
    };
}

self.onmessage = async (e: MessageEvent) => {
    const { type, payload } = e.data;

    if (type === 'PROCESS_EXCEL') {
        try {
            const { resume, templateBuffer } = payload;

            // 1. 重い処理：Excel生成
            const excelBlob = await generateExcelBlob(resume, templateBuffer);
            const file = new File([excelBlob], "preview.xlsx", {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });

            // 2. さらに重い処理：FortuneSheet変換
            const result = await transformExcelToFortune(file);

            // ★メモリ対策：マルチシートへの対応と非表示シートの除外
            let visibleSheets = result.sheets.filter((s: { hide?: number | boolean }) => s.hide !== 1 && s.hide !== true);
            if (visibleSheets.length === 0 && result.sheets.length > 0) {
                // 万が一すべて非表示の場合はフォールバックとして最初のシートを使う
                visibleSheets = [result.sheets[0]];
            }
            const optimizedSheets = visibleSheets.length > 0 ? [visibleSheets[0]] : [];

            if (optimizedSheets.length > 0) {
                // Ensure there is at least an empty celldata array to avoid 'undefined' crashes
                const s = optimizedSheets[0] as any;
                if (!s.celldata) {
                    s.celldata = [];
                }
            }

            console.log("Worker Result sheets:", optimizedSheets.map((s: { id: string, data?: unknown[], celldata?: unknown[] }) => ({ id: s.id, dataLength: s.data?.length, celldataLen: s.celldata?.length })));

            // 処理結果をメインスレッドに返す
            self.postMessage({ type: 'SUCCESS', data: { ...result, sheets: optimizedSheets } });

        } catch (error) {
            let errMsg = error instanceof Error ? error.message : String(error);
            // FortuneSheet内部処理がワーカー内でwindowオブジェクトにアクセスして失敗するケースを捕捉
            if (errMsg.includes("window is not defined") || errMsg.includes("document is not defined")) {
                errMsg = "テンプレートの解析に失敗しました。特殊なオブジェクトや非対応の画像が含まれているか、マーカーが存在しない可能性があります。";
            }
            self.postMessage({
                type: 'ERROR',
                error: errMsg
            });
        }
    }
};