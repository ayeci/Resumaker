/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */

import React, { useState, useEffect } from 'react';
import { Workbook } from '@fortune-sheet/react';
import type { Sheet, Image } from '@fortune-sheet/core';
import type { IfortuneSheet, IfortuneImageDefault, IfortuneSheetConfig } from '@zenmrp/fortune-sheet-excel/dist/ToFortuneSheet/IFortune';
import '@fortune-sheet/react/dist/index.css';
import styles from './ExcelPreview.module.scss';
import type { ResumeConfig } from '../types/resume';
import { useExcelWorker } from '../hooks/useExcelWorker';
import { useNotification } from './NotificationContext';
import { DEFAULT_ROW_HEIGHT, DEFAULT_COL_WIDTH, EXCEL_MAX_ROW, EXCEL_MAX_COL } from '../utils/excel';

interface ExcelPreviewProps {
    file: File;
    resume: ResumeConfig;
    width?: number;
    height?: number;
    onSizeChange?: (size: { fitWidth: number; fitHeight: number; totalWidth: number; totalHeight: number }) => void;
    setIsLoading?: (loading: boolean) => void;
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

const FALLBACK_DUMMY_SHEET = {
    name: "Sheet1",
    id: "1",
    status: 1,
    order: 0,
    data: [[{ v: "", m: "" }]],
    celldata: [{ r: 0, c: 0, v: { v: "", m: "" } }]
} as unknown as Sheet;

const ExcelPreview: React.FC<ExcelPreviewProps> = ({ file, resume, width, height, onSizeChange, setIsLoading }) => {

    // 通知フック
    const { notify } = useNotification();

    const [sheetData, setSheetData] = useState<Sheet[]>([FALLBACK_DUMMY_SHEET]);
    // プレビューの強制再描画用キー
    const [previewKey, setPreviewKey] = useState(0);

    // Web Worker カスタムフック
    const { generatePreview, isLoading } = useExcelWorker();

    // 親のローディング状態と同期
    useEffect(() => {
        if (setIsLoading) {
            setIsLoading(isLoading);
        }
    }, [isLoading, setIsLoading]);

    // サイズ変更時に Luckysheet にリサイズを促す（再描画）
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (width || height) {
            timer = setTimeout(() => {
                setPreviewKey(prev => prev + 1);
            }, 0);
        }
        return () => clearTimeout(timer);
    }, [width, height]);

    useEffect(() => {
        let isMounted = true;

        const loadAndTransform = async () => {
            try {
                // Worker経由でExcel生成 → FortuneSheet変換を実行
                const result = await generatePreview(resume, file);

                if (!result.sheets || result.sheets.length === 0) {
                    if (isMounted) {
                        setSheetData([FALLBACK_DUMMY_SHEET]);
                        setPreviewKey(Date.now());
                    }
                    return;
                }

                if (isMounted) {

                    const processedSheets: Sheet[] = (result.sheets as unknown as IfortuneSheet[]).map((sheet) => {

                        // 画像の再配置処理（Excelの読み込み側と表示側でフォーマットが違うので書き換えている）
                        let finalizedImages: Image[] = [];
                        if (sheet.images) {
                            const config: IfortuneSheetConfig = sheet.config || {} as IfortuneSheetConfig;
                            // config.rowlen / columnlen は { [index: string]: number } なので
                            // 数値でアクセスするとエラーになる可能性があるため、Record<string | number, number> として扱うかキャストする
                            const rowlen = (config.rowlen || {}) as Record<string | number, number>;
                            const columnlen = (config.columnlen || {}) as Record<string | number, number>;

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
                                finalizedImages = rawImages.map((img: SourceImage, idx: number) => {
                                    const id = img.id ?? `img_${idx}_${Math.random().toString(36).substring(2, 5)}`;
                                    return processImage(id, img);
                                });
                            } else {
                                finalizedImages = Object.entries(rawImages).map(([id, img]) => {
                                    return processImage(id, img);
                                });
                            }
                        }
                        // 画像の再配置処理ここまで

                        return {
                            ...sheet,
                            status: 1,
                            images: finalizedImages,
                            showGridLines: 0,
                            config: {
                                ...sheet.config,
                                // アップデートの日付を更新
                                _update: Date.now()
                            }
                        } as unknown as Sheet;
                    }); // mapped loop ends here

                    let finalSheets = processedSheets;
                    // 空シート対策：FortuneSheet変換後に必要なプロパティが欠落している場合は補完する
                    if (!finalSheets || finalSheets.length === 0) {
                        finalSheets = [{
                            name: "Sheet1",
                            id: "1",
                            status: 1,
                            order: 0,
                            data: [[null]],
                            celldata: [],
                        } as unknown as Sheet];
                    } else {
                        finalSheets.forEach((s: any, i: number) => {
                            if (s.id === undefined) s.id = String(i + 1);
                            if (s.status === undefined) s.status = i === 0 ? 1 : 0;
                            if (s.order === undefined) s.order = i;
                            if (!s.name) s.name = `Sheet${i + 1}`;
                        });
                    }

                    setSheetData(finalSheets);
                    setPreviewKey(Date.now()); // キーを更新してWorkbookを強制再マウント

                    // 印刷範囲に基づいたサイズを親に通知
                    if (onSizeChange && finalSheets.length > 0) {
                        const sheet = finalSheets[0] as unknown as IfortuneSheet;
                        const config = (sheet.config || {}) as IfortuneSheetConfig;
                        const rowlen = (config.rowlen || {}) as Record<string | number, number>;
                        const columnlen = (config.columnlen || {}) as Record<string | number, number>;

                        // ここで正しいデフォルト幅を取得しておく
                        const safeSheet = sheet as any;
                        const defaultColWidth = safeSheet.defaultColWidth ?? DEFAULT_COL_WIDTH;
                        const defaultRowHeight = safeSheet.defaultRowHeight ?? DEFAULT_ROW_HEIGHT;

                        let w = 0;
                        let h = 0;

                        // バッファ計算用に「最大列数・行数」を記録する変数
                        let maxC_for_buffer = 0;
                        let maxR_for_buffer = 0;

                        // Worker側で付与された printAreaBounds を使用
                        const r = safeSheet.printAreaBounds;

                        // A. 印刷範囲(PrintArea)がある場合
                        if (r) {
                            // 印刷領域の左端に罫線があるかどうかの判別
                            const borderInfo = (sheet.config?.borderInfo || []) as any[];

                            // 印刷範囲の左端の列 (r.c1) に左罫線があるかを判定
                            const hasLeftBorderAtStart = borderInfo.some(info => {
                                const col = info.value?.col_index ?? info.col_index ?? info.range?.[0]?.column?.[0];

                                // 印刷範囲の左端 (r.c1) と一致するか判定
                                if (col === undefined || col !== r.c1) return false;

                                // 左罫線 ('l') の存在確認
                                return !!info.value?.l;
                            });

                            if (hasLeftBorderAtStart) {
                                notify("excel-border-warning", "warning", "左端の罫線は表示されていない可能性がありますが、Excel形式で保存した場合は、正常に出力されます。");
                            }

                            // 最大列数を記録（バッファ計算用）
                            maxC_for_buffer = r.c2;
                            maxR_for_buffer = r.r2;

                            for (let i = r.c1; i <= r.c2; i++) {
                                w += columnlen[String(i)] ?? columnlen[i] ?? defaultColWidth;
                            }
                            for (let i = r.r1; i <= r.r2; i++) {
                                h += rowlen[String(i)] ?? rowlen[i] ?? defaultRowHeight;
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
                                maxC = EXCEL_MAX_COL;
                                maxR = EXCEL_MAX_ROW;
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

                        // CSS の padding (32px * 2 = 64px) を考慮し、少し余裕を持たせたバッファを設定
                        const widthBuffer = 80 + (maxC_for_buffer * 2);
                        const heightBuffer = 80 + (maxR_for_buffer * 2);

                        // 最後に安全マージン
                        onSizeChange({
                            fitWidth: w + widthBuffer,
                            fitHeight: h + heightBuffer,
                            totalWidth: w + widthBuffer,
                            totalHeight: h + heightBuffer
                        });
                    }
                }
            } catch (e: any) {
                // キャンセルされた場合はエラーを無視
                if (isMounted) {
                    const errorMessage = e instanceof Error ? e.message : String(e);
                    // fetchのAbortErrorや意図的なキャンセルの場合は通知しない
                    if (!errorMessage.includes("キャンセル")) {
                        notify("excel-load-error", "error", errorMessage);
                        // マーカーが存在しないなどのエラー時は空のシートを表示する
                        setSheetData([FALLBACK_DUMMY_SHEET]);
                        setPreviewKey(Date.now());
                    }
                }
            }
        };

        if (file) {
            loadAndTransform();
        }

        return () => {
            isMounted = false;
            if (typeof window !== 'undefined' && (window as any).luckysheet) {
                try {
                    (window as any).luckysheet.destroy();
                } catch {
                    // エラーは無視
                }
            }
        };
    }, [file, resume, onSizeChange, notify, generatePreview]);

    return (
        <div
            className={styles.excelPreviewContainer}
            style={{
                width: width ? `${width}px` : '100%',
                height: height ? `${height}px` : '100%'
            }}
        >
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
                }}
            />
        </div>
    );
};

export default ExcelPreview;
