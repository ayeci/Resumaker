/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */

import React, { useState, useEffect } from 'react';
import { Workbook } from '@fortune-sheet/react';
import { transformExcelToFortune } from '@zenmrp/fortune-sheet-excel';
import type { Sheet, Image } from '@fortune-sheet/core';
import type { IfortuneSheet, IfortuneImageDefault, IfortuneSheetConfig } from '@zenmrp/fortune-sheet-excel/dist/ToFortuneSheet/IFortune';
import '@fortune-sheet/react/dist/index.css';
import styles from './ExcelPreview.module.scss';
import type { ResumeConfig } from '../types/resume';
import { generateExcelBlob } from '../utils/exporter';
import PizZip from 'pizzip';
import { Alert } from '@mui/material';
import type { Message } from '../types/message';
import { getMaximumPrintAreaFromList } from '../utils/excel';

interface ExcelPreviewProps {
    templateBuffer: ArrayBuffer;
    resume: ResumeConfig;
    width?: number;
    height?: number;
    onSizeChange?: (size: { fitWidth: number; fitHeight: number; totalWidth: number; totalHeight: number }) => void;
    onNotify?: (severity: Message["severity"], content: string) => void;
}

/** FortuneSheetのソース画像データ定義（入力時） */
interface SourceImage extends Partial<Image> {
    fromRow?: number;
    fromCol?: number;
    fromRowOff?: number;
    fromColOff?: number;
    toRow?: number;
    toCol?: number;
    toRowOff?: number;
    toColOff?: number;
    default?: Partial<IfortuneImageDefault> & {
        row?: number;
        column?: number;
    };
}

const ExcelPreview: React.FC<ExcelPreviewProps> = ({ templateBuffer, resume, width, height, onSizeChange, onNotify }) => {

    // ポップアップメッセージ
    const [message, setMessage] = useState<Message[]>([]);

    // Workbookのdataプロパティに渡すため、Sheet[]型を使用
    const [sheetData, setSheetData] = useState<Sheet[]>([]);
    const [loading, setLoading] = useState(true);
    // プレビューの強制再描画用キー
    const [previewKey, setPreviewKey] = useState(0);

    // サイズ変更時に Luckysheet にリサイズを促す（再描画）
    useEffect(() => {
        if (width || height) {
            setPreviewKey(prev => prev + 1);
        }
    }, [width, height]);

    useEffect(() => {
        let isMounted = true;

        const message_: Message[] = [];

        const loadAndTransform = async () => {
            setLoading(true);
            try {

                const excelBlob = await generateExcelBlob(resume, templateBuffer);
                const fileToTransform = new File([excelBlob], "preview.xlsx", { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

                const result = await transformExcelToFortune(fileToTransform);

                if (!result.sheets || result.sheets.length === 0) {
                    if (isMounted) setSheetData([]);
                    return;
                }

                if (isMounted) {

                    // 印刷範囲を取得する処理の前処理
                    const zip = new PizZip(templateBuffer);
                    const workbookXmlStr = zip.file("xl/workbook.xml")?.asText();
                    if (!workbookXmlStr) throw new Error("Workbook.xml が見つかりません");

                    const xmlDoc = new DOMParser().parseFromString(workbookXmlStr, "application/xml");
                    const definedNames = xmlDoc.getElementsByTagName("definedName");
                    // 印刷範囲を取得する処理の前処理 ここまで


                    const finalSheets: Sheet[] = (result.sheets as IfortuneSheet[]).map((sheet, index) => {

                        // 画像の再配置処理（Excelの読み込み側と表示側でフォーマットが違うので書き換えている）
                        let finalizedImages: Image[] = [];
                        if (sheet.images) {
                            const config: IfortuneSheetConfig = sheet.config || {} as IfortuneSheetConfig;
                            // config.rowlen / columnlen は { [index: string]: number } なので
                            // 数値でアクセスするとエラーになる可能性があるため、Record<string | number, number> として扱うかキャストする
                            const rowlen = (config.rowlen || {}) as Record<string | number, number>;
                            const columnlen = (config.columnlen || {}) as Record<string | number, number>;

                            const DEFAULT_ROW_HEIGHT = 19;
                            const DEFAULT_COL_WIDTH = 73;

                            const calculateMetrics = (img: SourceImage) => {
                                let top = 0;
                                let left = 0;
                                let width = 0;
                                let height = 0;

                                // 1. 開始位置 (fromRow, fromCol)
                                const r = img.fromRow ?? img.default?.row ?? 0;
                                const c = img.fromCol ?? img.default?.column ?? 0;
                                const fromRowOff = img.fromRowOff ?? 0;
                                const fromColOff = img.fromColOff ?? 0;

                                // Top計算
                                for (let i = 0; i < r; i++) {
                                    top += rowlen[i] ?? DEFAULT_ROW_HEIGHT;
                                }
                                const absTop = top + fromRowOff;

                                // Left計算
                                for (let i = 0; i < c; i++) {
                                    left += columnlen[i] ?? DEFAULT_COL_WIDTH;
                                }
                                const absLeft = left + fromColOff;

                                top = absTop;
                                left = absLeft;

                                // 2. 終了位置
                                if (typeof img.toRow === 'number' && typeof img.toCol === 'number') {
                                    let bottom = 0;
                                    let right = 0;
                                    const rEnd = img.toRow!;
                                    const cEnd = img.toCol!;
                                    const rEndOff = img.toRowOff ?? 0;
                                    const cEndOff = img.toColOff ?? 0;

                                    // Bottom計算
                                    for (let i = 0; i < rEnd; i++) {
                                        bottom += rowlen[i] ?? DEFAULT_ROW_HEIGHT;
                                    }
                                    bottom += rEndOff;
                                    height = Math.max(0, bottom - absTop);

                                    // Right計算
                                    for (let i = 0; i < cEnd; i++) {
                                        right += columnlen[i] ?? DEFAULT_COL_WIDTH;
                                    }
                                    right += cEndOff;
                                    width = Math.max(0, right - absLeft);

                                } else {
                                    if (img.default?.width) {
                                        width = img.default.width;
                                    } else {
                                        width = columnlen[c] ?? DEFAULT_COL_WIDTH;
                                    }

                                    if (img.default?.height) {
                                        height = img.default.height;
                                    } else {
                                        height = rowlen[r] ?? DEFAULT_ROW_HEIGHT;
                                    }
                                }

                                return { top, left, width, height };
                            };

                            const processImage = (id: string, img: SourceImage): Image => {
                                const { top, left, width, height } = calculateMetrics(img);
                                const image: Image = {
                                    id,
                                    width,
                                    height,
                                    left,
                                    top,
                                    src: img.src || ""
                                };
                                return image;
                            };

                            const rawImages = sheet.images as unknown as (SourceImage[] | Record<string, SourceImage>);

                            if (Array.isArray(rawImages)) {
                                finalizedImages = rawImages.map((img: SourceImage, index: number) => {
                                    const id = img.id ?? `img_${index}_${Math.random().toString(36).substring(2, 5)}`;
                                    return processImage(id, img);
                                });
                            } else {
                                finalizedImages = Object.entries(rawImages).map(([id, img]) => {
                                    return processImage(id, img);
                                });
                            }
                        }
                        // 画像の再配置処理ここまで

                        // 印刷範囲を取得し、非表示に設定する処理
                        const rowhidden: Record<string, number> = {};
                        const colhidden: Record<string, number> = {};
                        // 0. 印刷範囲を取得
                        let rawRanges = "";
                        for (let i = 0; i < definedNames.length; i++) {
                            const node = definedNames[i];
                            // localSheetId属性を確認し、対象シートの印刷範囲を特定（マルチシート対応）
                            if (node.getAttribute("name") === "_xlnm.Print_Area" &&
                                node.getAttribute("localSheetId") === String(index)) {
                                rawRanges = node.textContent || "";
                                break;
                            }
                        }

                        if (rawRanges) {
                            // 1. カンマで分割して個別の範囲を取得
                            // 例: ["Sheet1!$A$1:$B$10", "Sheet1!$D$1:$E$10"]
                            const areas = rawRanges.split(',');

                            // 2. 各範囲からシート名を取り除き、純粋なアドレス形式に変換
                            // 例: ["A1:B10", "D4:E5"]
                            const cleanedAreas = areas.map(area => {
                                const parts = area.split('!');
                                return (parts.length > 1 ? parts[1] : parts[0]).replace(/\$/g, "");
                            });

                            const range = getMaximumPrintAreaFromList(cleanedAreas);
                            if (range) {

                                // 4. 印刷範囲外の行を非表示にセット
                                // 0行目から最大行（例: 1000）まで回して、範囲外を登録
                                for (let r = 0; r < 1000; r++) {
                                    if (r < range.r1 || r > range.r2) {
                                        // Luckysheetの仕様：キーを行番号、値を 0 にすると非表示
                                        rowhidden[`${r}`] = 0;
                                    }
                                }

                                // 5. 印刷範囲外の列を非表示にセット
                                for (let c = 0; c < 1000; c++) {
                                    if (c < range.c1 || c > range.c2) {
                                        colhidden[`${c}`] = 0;
                                    }
                                }
                            }
                        }

                        return {
                            ...sheet,
                            status: 1,
                            images: finalizedImages,
                            showGridLines: 0,
                            config: {
                                ...sheet.config,
                                // 非表示エリアの設定
                                rowhidden,
                                colhidden,
                                // アップデートの日付を更新
                                _update: Date.now()
                            }
                        } as unknown as Sheet;
                    });

                    setSheetData(finalSheets);
                    setPreviewKey(prev => prev + 1);

                    // 印刷範囲に基づいたサイズを親に通知
                    if (onSizeChange && finalSheets.length > 0) {
                        const sheet = finalSheets[0] as unknown as IfortuneSheet;
                        const config = (sheet.config || {}) as IfortuneSheetConfig;
                        const rowlen = (config.rowlen || {}) as Record<string | number, number>;
                        const columnlen = (config.columnlen || {}) as Record<string | number, number>;

                        // ここで正しいデフォルト幅を取得しておく
                        const safeSheet = sheet as any;
                        const defaultColWidth = safeSheet.defaultColWidth ?? 73;
                        const defaultRowHeight = safeSheet.defaultRowHeight ?? 19;

                        // 印刷範囲の再取得
                        let rawRanges = "";
                        for (let i = 0; i < definedNames.length; i++) {
                            if (definedNames[i].getAttribute("name") === "_xlnm.Print_Area" &&
                                definedNames[i].getAttribute("localSheetId") === "0") {
                                rawRanges = definedNames[i].textContent || "";
                                break;
                            }
                        }

                        let w = 0;
                        let h = 0;

                        // バッファ計算用に「最大列数・行数」を記録する変数
                        let maxC_for_buffer = 0;
                        let maxR_for_buffer = 0;

                        // A. 印刷範囲(PrintArea)がある場合
                        if (rawRanges) {
                            const cleaned = rawRanges.split('!').pop()?.replace(/\$/g, "") || "";
                            const r = getMaximumPrintAreaFromList(cleaned);

                            if (r) {
                                // 印刷領域の左端に罫線があるかどうかの判別
                                const borderInfo = (sheet.config?.borderInfo || []) as any[];

                                // 印刷範囲の左端の列 (r.c1) に左罫線があるかを判定
                                const hasLeftBorderAtStart = borderInfo.some(info => {
                                    const col = info.value?.col_index ?? info.col_index ?? info.range?.[0]?.column?.[0];

                                    // 印刷範囲の左端 (r.c1) と一致するか判定
                                    if (col === undefined || col !== r.c1) return false;

                                    // 左罫線 ('l') の存在確認
                                    // ログで確認された通り、info.value.l の有無をチェックします
                                    return !!info.value?.l;
                                });

                                if (hasLeftBorderAtStart) {
                                    onNotify?.("warning", "左端の罫線は表示されていない可能性がありますが、Excel形式で保存した場合は、正常に出力されます。");
                                }
                                // 印刷領域の左端に罫線があるかどうかの判別 ここまで

                                // 最大列数を記録（バッファ計算用）
                                maxC_for_buffer = r.c2;
                                maxR_for_buffer = r.r2;
                                // 固定値(73)ではなく、取得した defaultColWidth を使う
                                for (let i = r.c1; i <= r.c2; i++) {
                                    // 文字列キーと数値キーの両方をケア
                                    w += columnlen[String(i)] ?? columnlen[i] ?? defaultColWidth;
                                }
                                // 固定値(19)ではなく、取得した defaultRowHeight を使う
                                for (let i = r.r1; i <= r.r2; i++) {
                                    h += rowlen[String(i)] ?? rowlen[i] ?? defaultRowHeight;
                                }
                            }
                        }

                        // B. 印刷範囲がない、または計算できなかった場合（自動検出）
                        if (w === 0 || h === 0) {
                            let maxR = 0;
                            let maxC = 0;
                            let hasData = false;

                            // celldata走査
                            if (safeSheet.celldata && Array.isArray(safeSheet.celldata)) {
                                safeSheet.celldata.forEach((cell: any) => {
                                    if (cell && typeof cell.r === 'number' && typeof cell.c === 'number') {
                                        maxR = Math.max(maxR, cell.r);
                                        maxC = Math.max(maxC, cell.c);
                                        hasData = true;
                                    }
                                });
                            }

                            // data走査
                            if (safeSheet.data && Array.isArray(safeSheet.data)) {
                                safeSheet.data.forEach((row: any, r: number) => {
                                    if (!row || !Array.isArray(row)) return;
                                    row.forEach((cell: any, c: number) => {
                                        if (cell !== null) {
                                            maxR = Math.max(maxR, r);
                                            maxC = Math.max(maxC, c);
                                            hasData = true;
                                        }
                                    });
                                });
                            }

                            // borderInfo走査 (罫線のみの範囲)
                            const borderInfo = sheet.config?.borderInfo;
                            if (borderInfo && Array.isArray(borderInfo)) {
                                borderInfo.forEach((border: any) => {
                                    if (border.rangeType === 'range' && border.range) {
                                        border.range.forEach((range: any) => {
                                            if (range.row) { maxR = Math.max(maxR, range.row[1]); hasData = true; }
                                            if (range.column) { maxC = Math.max(maxC, range.column[1]); hasData = true; }
                                        });
                                    } else if (border.rangeType === 'cell') {
                                        if (typeof border.row_index === 'number') { maxR = Math.max(maxR, border.row_index); hasData = true; }
                                        if (typeof border.col_index === 'number') { maxC = Math.max(maxC, border.col_index); hasData = true; }
                                    }
                                });
                            }

                            if (!hasData) {
                                maxR = 50; maxC = 20;
                            } else {
                                maxR += 5; maxC += 5;
                            }

                            // バッファ計算用に記録
                            maxC_for_buffer = maxC;
                            maxR_for_buffer = maxR;

                            // デフォルト値を使って積み上げ
                            for (let c = 0; c <= maxC; c++) {
                                w += columnlen[String(c)] ?? columnlen[c] ?? defaultColWidth;
                            }
                            for (let r = 0; r <= maxR; r++) {
                                h += rowlen[String(r)] ?? rowlen[r] ?? defaultRowHeight;
                            }
                        }

                        const widthBuffer = 30 + (maxC_for_buffer * 4);
                        const heightBuffer = 30 + (maxR_for_buffer * 4);

                        // 最後に安全マージン
                        onSizeChange({
                            fitWidth: w + widthBuffer,
                            fitHeight: h + heightBuffer,
                            totalWidth: w + widthBuffer,
                            totalHeight: h + heightBuffer
                        });
                    }
                }
            } catch (e) {
                onNotify?.("error", "Excelテンプレートのロードに失敗しました" + e);
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }

        };

        if (templateBuffer) {
            loadAndTransform();
        }

        setMessage((prev) => [...prev, ...message_]);

        return () => { isMounted = false; };
    }, [templateBuffer, resume, onSizeChange, onNotify]);

    if (loading) return <div className={styles.renderingContainer}><div className={styles.rendering} /></div>;;

    return (
        <div className={styles.excelPreviewContainer}>
            {message.length > 0 && (
                <article className={styles.popupMessage}>
                    {message.map((message, index) => (
                        <Alert severity={message.severity} key={index}>{message.message}</Alert>
                    ))}
                </article>
            )}
            <Workbook
                key={previewKey}
                data={sheetData}
                showToolbar={false}
                showFormulaBar={false}
                showSheetTabs={false}
                allowEdit={false}
                cellContextMenu={[]}
                headerContextMenu={[]}
                sheetTabContextMenu={[]}
                rowHeaderWidth={0}
                columnHeaderHeight={0}
                hooks={{
                    beforeCellMouseDown: () => false, // セル選択を無効化（クリックイベントをキャンセル）
                }
                }
            />
        </div >
    );
};

export default ExcelPreview;
