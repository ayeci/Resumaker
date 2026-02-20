/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */

import { transformExcelToFortune } from '@zenmrp/fortune-sheet-excel';
import { generateExcelBlob } from '../utils/exporter';

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

            // ★メモリ対策：マルチシートでなければ、1枚目だけ返す
            const optimizedSheets = result.sheets.length > 0 ? [result.sheets[0]] : [];

            // 処理結果をメインスレッドに返す
            self.postMessage({ type: 'SUCCESS', data: { ...result, sheets: optimizedSheets } });

        } catch (error) {
            self.postMessage({
                type: 'ERROR',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
};