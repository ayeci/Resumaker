/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */

import { useEffect, useRef } from 'react';
import { renderAsync } from 'docx-preview';
import type { ResumeConfig, ExportOptions } from '../types/resume';
import { generateWordBlob } from '../utils/exporter';
import styles from './WordPreview.module.scss';
import { useNotification } from './NotificationContext';

interface WordPreviewProps {
    file: File;
    resume: ResumeConfig;
    options: ExportOptions;
    onSizeChange?: (size: { fitWidth: number; fitHeight: number; totalWidth: number; totalHeight: number }) => void;
    setIsLoading?: (loading: boolean) => void;
}

export function WordPreview({ file, resume, options, onSizeChange, setIsLoading }: WordPreviewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const { notify } = useNotification();

    // 無限ループ防止用のサイズ記録Refを追加
    const lastSize = useRef({ width: 0, height: 0 });

    useEffect(() => {
        const container = containerRef.current;
        if (!container || !onSizeChange) return;

        // ResizeObserver でコンテナの実際のDOMサイズを監視する
        const observer = new ResizeObserver(() => {
            const actualWidth = container.scrollWidth;
            const actualHeight = container.scrollHeight;

            if (actualWidth === 0 || actualHeight === 0) return;

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

        observer.observe(container);

        return () => {
            observer.disconnect();
        };
    }, [onSizeChange]);

    useEffect(() => {
        let isCancelled = false;

        const renderDoc = async () => {
            if (!containerRef.current || !file) return;
            if (setIsLoading) setIsLoading(true);
            try {
                // 1. 記入済みのWordドキュメントBlobを生成
                const arrayBuffer = await file.arrayBuffer();
                if (isCancelled) return;

                const blob = await generateWordBlob(resume, arrayBuffer, options);
                if (isCancelled) return;

                // 2. docx-preview を使用してレンダリング
                if (containerRef.current) {
                    containerRef.current.innerHTML = ''; // 以前のコンテンツをクリア
                    await renderAsync(blob, containerRef.current, undefined, {
                        className: "docx-preview-content",
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
                if (isCancelled) return;
                console.error("Failed to render word preview:", e);
                notify("word-preview-error", "error", "Wordプレビューの生成に失敗しました。");
            } finally {
                if (!isCancelled && setIsLoading) {
                    setIsLoading(false);
                }
            }
        };

        renderDoc();

        return () => {
            isCancelled = true;
        };
    }, [file, resume, options, setIsLoading, notify]);

    return (
        <div className={styles.wordPreviewContainer}>
            <div
                ref={containerRef}
                className={styles.contentContainer}
            />
        </div>
    );
}