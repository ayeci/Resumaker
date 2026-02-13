import React, { useState, useEffect } from 'react';
import { Workbook } from '@fortune-sheet/react';
import { transformExcelToFortune } from '@zenmrp/fortune-sheet-excel';
import type { Sheet, Image } from '@fortune-sheet/core';
import type { IfortuneSheet, IfortuneImageDefault, IfortuneSheetConfig } from '@zenmrp/fortune-sheet-excel/dist/ToFortuneSheet/IFortune';
import '@fortune-sheet/react/dist/index.css';
import styles from './ExcelPreview.module.scss';
import type { ResumeConfig } from '../types/resume';
import { generateExcelBlob } from '../utils/exporter';

interface Props {
    templateBuffer: ArrayBuffer;
    resume: ResumeConfig;
}

// FortuneSheetのソース画像データ定義（入力時）
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

const ExcelPreview: React.FC<Props> = ({ templateBuffer, resume }) => {
    // Workbookのdataプロパティに渡すため、Sheet[]型を使用
    const [sheetData, setSheetData] = useState<Sheet[]>([]);
    const [loading, setLoading] = useState(true);
    // プレビューの強制再描画用キー
    const [previewKey, setPreviewKey] = useState(0);

    useEffect(() => {
        let isMounted = true;

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
                    const finalSheets: Sheet[] = (result.sheets as IfortuneSheet[]).map((sheet) => {
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
                                    const id = img.id || `img_${index}_${Math.random().toString(36).substr(2, 5)}`;
                                    return processImage(id, img);
                                });
                            } else {
                                finalizedImages = Object.entries(rawImages).map(([id, img]) => {
                                    return processImage(id, img);
                                });
                            }
                        }

                        return {
                            ...sheet,
                            status: 1,
                            images: finalizedImages,
                            showGridLines: 0,
                            config: { ...sheet.config, _update: Date.now() }
                        } as unknown as Sheet;
                    });
                    setSheetData(finalSheets);
                    setPreviewKey(prev => prev + 1);
                }
            } catch (e) {
                console.error("Failed to load excel template:", e);
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        if (templateBuffer) {
            loadAndTransform();
        }

        return () => { isMounted = false; };
    }, [templateBuffer, resume]);

    if (loading) return <div className={styles.renderingContainer}><div className={styles.rendering} /></div>;;

    return (
        <div className={styles.excelPreviewContainer}>
            <Workbook
                key={previewKey}
                data={sheetData}
                onChange={() => { /* 編集をYAMLに逆反映させる機能も作れます */ }}
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
