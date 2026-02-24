/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */

import PizZip from 'pizzip';
import { transformExcelToFortune } from '@zenmrp/fortune-sheet-excel';
import { generateExcelBlob } from '../utils/exporter';
import { getMaximumPrintAreaFromList, EXCEL_MAX_ROW, EXCEL_MAX_COL } from '../utils/excel';

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
            const { resume, file } = payload;

            // 1. 重い処理：Excel生成
            const excelBlob = await generateExcelBlob(resume, file);
            const excelFile = new File([excelBlob], "preview.xlsx", {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });

            // 2. さらに重い処理：FortuneSheet変換
            const result = await transformExcelToFortune(excelFile);

            // ★メモリ対策・描画フリーズ防止：メインスレッドで行っていた XML 解析・印刷範囲設定を Worker 側で行う
            try {
                const zip = new PizZip(await excelBlob.arrayBuffer());
                const workbookXmlStr = zip.file("xl/workbook.xml")?.asText();
                if (workbookXmlStr) {
                    // 簡単な正規表現で definedName タグを抽出（DOMParserがWorkerにないための代替アプローチ）
                    // 例: <definedName name="_xlnm.Print_Area" localSheetId="0">Sheet1!$A$1:$I$44</definedName>
                    const regex = /<definedName\s+name="([^"]+)"(?:\s+localSheetId="([^"]+)")?[^>]*>([^<]+)<\/definedName>/g;
                    let match;
                    while ((match = regex.exec(workbookXmlStr)) !== null) {
                        const name = match[1];
                        const localSheetId = match[2];
                        const content = match[3];

                        if (name === "_xlnm.Print_Area" && localSheetId) {
                            const sheetIndex = parseInt(localSheetId, 10);
                            const targetSheet = result.sheets[sheetIndex] as any;
                            if (targetSheet && content) {
                                const areas = content.split(',');
                                const cleanedAreas = areas.map((area: string) => {
                                    const parts = area.split('!');
                                    return (parts.length > 1 ? parts[1] : parts[0]).replace(/\$/g, "");
                                });
                                const range = getMaximumPrintAreaFromList(cleanedAreas);
                                if (range) {
                                    targetSheet.config = targetSheet.config || {};
                                    targetSheet.config.rowhidden = targetSheet.config.rowhidden || {};
                                    targetSheet.config.colhidden = targetSheet.config.colhidden || {};

                                    for (let r = 0; r < EXCEL_MAX_ROW; r++) {
                                        if (r < range.r1 || r > range.r2) {
                                            targetSheet.config.rowhidden[`${r}`] = 0;
                                        }
                                    }
                                    for (let c = 0; c < EXCEL_MAX_COL; c++) {
                                        if (c < range.c1 || c > range.c2) {
                                            targetSheet.config.colhidden[`${c}`] = 0;
                                        }
                                    }
                                    // ExcelPreviewでのサイズ計算用に計算済み範囲を持たせる
                                    targetSheet.printAreaBounds = range;
                                }
                            }
                        }
                    }
                }
            } catch (xmlError) {
                console.warn("Worker: workbook.xml の Print_Area の解析に失敗しました", xmlError);
            }

            // 常に先頭のシート(インデックス0)をプレビュー対象として表示する
            // メモリ節約のため、1シート目以外の巨大なデータ(data, celldata, images等)をWorker側で明示的に破棄してからメインスレッドに渡す
            const optimizedSheets = result.sheets.length > 0 ? [result.sheets[0]] : [];

            if (optimizedSheets.length > 0) {
                const s = optimizedSheets[0] as any;
                // celldataがない場合のクラッシュ防止
                if (!s.celldata) {
                    s.celldata = [];
                }
            }

            // 処理結果をメインスレッドに返す
            // result全体を送る際、sheetsをoptimizedSheets（1つだけ）に置き換えることで、
            // 通信量とメインスレッド側のメモリデシリアライズ負荷を大幅に削減する
            self.postMessage({
                type: 'SUCCESS',
                data: {
                    ...result,
                    sheets: optimizedSheets,
                    // calcChain など他の巨大なオブジェクトが最上位にある場合はここで個別に消す事も検討
                }
            });

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