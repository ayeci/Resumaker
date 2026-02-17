/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */

import React, { useEffect, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';
import type { ResumeConfig, ExportOptions } from '../types/resume';
import { generateWordBlob } from '../utils/exporter';
import styles from './WordPreview.module.scss';

interface WordPreviewProps {
    templateBuffer: ArrayBuffer;
    resume: ResumeConfig;
    options: ExportOptions;
    onSizeChange?: (size: { fitWidth: number; fitHeight: number; totalWidth: number; totalHeight: number }) => void;
}

export function WordPreview({ templateBuffer, resume, options, onSizeChange }: WordPreviewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Wordプレビューは現状1ページ想定、または内容に応じた高さになる
        // 一旦標準的なA4サイズを通知しておく
        if (onSizeChange) {
            const a4WidthPx = 210 * 3.78;
            const a4HeightPx = 297 * 3.78;
            onSizeChange({
                fitWidth: a4WidthPx,
                fitHeight: a4HeightPx,
                totalWidth: a4WidthPx,
                totalHeight: a4HeightPx // TODO: 実測が必要
            });
        }
    }, [onSizeChange]);

    useEffect(() => {
        const renderDoc = async () => {
            if (!containerRef.current || !templateBuffer) return;

            setLoading(true);
            setError(null);
            try {
                // 1. 既存のユーティリティを使用して記入済みのWordドキュメントBlobを生成
                // 注意: generateWordBlob は Blob を返す
                const blob = await generateWordBlob(resume, templateBuffer, options);

                // 2. docx-preview を使用してレンダリング
                if (containerRef.current) {
                    containerRef.current.innerHTML = ''; // 以前のコンテンツをクリア
                    await renderAsync(blob, containerRef.current, undefined, {
                        className: "docx-preview-content", // スタイリング用のオプションクラス
                        inWrapper: true, // ラッパーを使用
                        ignoreWidth: false,
                        ignoreHeight: false,
                        ignoreFonts: false,
                        breakPages: true,
                        ignoreLastRenderedPageBreak: false,
                        experimental: false,
                        trimXmlDeclaration: true,
                        useBase64URL: false,
                        renderChanges: false,
                        debug: false,
                    });
                }
            } catch (e) {
                console.error("Failed to render word preview:", e);
                setError("Wordプレビューの生成に失敗しました。");
            } finally {
                setLoading(false);
            }
        };

        renderDoc();
    }, [templateBuffer, resume, options]);

    return (
        <div className={styles.wordPreviewContainer}>
            {loading && <div className={styles.loading}>レンダリング中...</div>}
            {error && <div className={styles.error}>{error}</div>}
            <div
                ref={containerRef}
                className={styles.contentContainer}
            />
        </div>
    );
};

export default WordPreview;
