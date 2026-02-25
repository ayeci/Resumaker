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

/**
 * FortuneSheet 表示前のシートデータの後処理
 * 1. 結合セル内部の不要な罫線を除去
 * 2. テキストのはみ出し（オーバーフロー）設定を修正
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cleanUpSheetData = (sheets: any[]) => {
    sheets.forEach((sheet) => {

        // --- 1. 結合セル内の不要な内部罫線を消去 ---
        if (sheet.config && sheet.config.merge && sheet.config.borderInfo) {
            const merges = Object.values(sheet.config.merge) as { r: number, c: number, rs: number, cs: number }[];

            sheet.config.borderInfo = sheet.config.borderInfo.map((border: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                if (border.rangeType === 'cell' && border.value) {
                    const r = border.value.row_index;
                    const c = border.value.col_index;

                    let keepL = true, keepR = true, keepT = true, keepB = true;

                    for (const m of merges) {
                        const { r: mr, c: mc, rs, cs } = m;
                        if (r >= mr && r < mr + rs && c >= mc && c < mc + cs) {
                            if (c > mc) keepL = false;
                            if (c < mc + cs - 1) keepR = false;
                            if (r > mr) keepT = false;
                            if (r < mr + rs - 1) keepB = false;
                        }
                    }

                    if (!keepL && !keepR && !keepT && !keepB) return null;

                    const newValue = { ...border.value };
                    if (!keepL) delete newValue.l;
                    if (!keepR) delete newValue.r;
                    if (!keepT) delete newValue.t;
                    if (!keepB) delete newValue.b;

                    return { ...border, value: newValue };
                }
                return border;
            }).filter(Boolean);
        }

        // --- 2. 究極版：安全なはみ出し処理（見えない壁の完全撤去） ---
        if (sheet.celldata) {
            sheet.celldata.forEach((cell: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                // セルの実体がない場合はスキップ
                if (!cell || !cell.v || typeof cell.v !== 'object') return;

                const v = cell.v;

                // ① 「折り返し("2")」以外のテキストは全て「はみ出し("1")」を強制
                // ※ FortuneSheet は tb を 文字列 で比較するため、数値ではなく文字列を設定する
                if (v.tb !== 2 && v.tb !== '2') {
                    v.tb = '1';
                }

                // ② 実データが存在するかどうかをあらゆる角度から厳密に判定
                const hasRawValue = v.v !== null && v.v !== undefined && v.v !== '';       // 通常の値
                const hasDisplayValue = v.m !== null && v.m !== undefined && v.m !== '';   // 表示用の値
                const hasRichText = v.ct && typeof v.ct === 'object' && v.ct.s && Array.isArray(v.ct.s) && v.ct.s.length > 0; // 装飾付きテキスト
                const hasFormula = !!v.f;    // 数式
                const hasMerge = !!v.mc;     // 結合情報
                const hasComment = !!v.ps;   // コメント

                const hasAnyContent = hasRawValue || hasDisplayValue || hasRichText || hasFormula || hasMerge || hasComment;

                if (!hasAnyContent) {
                    // ③ 実データが何もない場合
                    // FortuneSheet において単に文字のはみ出しをブロックする「見えない壁」になっているため、
                    // セルの値オブジェクト自体を null にして物理的に透過させる（罫線は消えない）
                    cell.v = null;
                } else {
                    // ④ データがあるセルでも、白背景なら透明化して隣からの侵入を許容する
                    if (v.bg === '#ffffff' || v.bg === '#FFFFFF') {
                        delete v.bg;
                    }
                }
            });
        }
    });
};

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

            // 結合セルの内部罫線除去 + テキストはみ出し設定の修正
            if (result.sheets) {
                cleanUpSheetData(result.sheets);
            }

            // メモリ対策・描画フリーズ防止：メインスレッドで行っていた XML 解析・印刷範囲設定を Worker 側で行う
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