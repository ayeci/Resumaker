/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */

import { useEffect, useRef, useState } from 'react';
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

    // 無限ループ防止用のサイズ記録Refを追加
    const lastSize = useRef({ width: 0, height: 0 });

    useEffect(() => {
        const container = containerRef.current;
        if (!container || !onSizeChange) return;

        // 2. ResizeObserver でコンテナの実際のDOMサイズを監視する
        const observer = new ResizeObserver(() => {
            // scrollWidth / scrollHeight を使うことで、
            // 「A3見開き」や「はみ出た複数ページ」の総延長を正確に取得できます
            const actualWidth = container.scrollWidth;
            const actualHeight = container.scrollHeight;

            // 高さが0など、まだ描画されていない状態のときは無視する
            if (actualWidth === 0 || actualHeight === 0) return;

            // 前回のサイズと同じな場合は通知をスキップ（無限ループの防波堤）
            if (lastSize.current.width === actualWidth && lastSize.current.height === actualHeight) {
                return;
            }
            lastSize.current = { width: actualWidth, height: actualHeight };

            onSizeChange({
                fitWidth: actualWidth,
                fitHeight: actualHeight,
                totalWidth: actualWidth,
                totalHeight: actualHeight
            });
        });

        // 監視スタート
        observer.observe(container);

        return () => {
            observer.disconnect();
        };
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
                        inWrapper: false,
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