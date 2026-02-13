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

interface Props {
    templateBuffer: ArrayBuffer;
    resume: ResumeConfig;
    options: ExportOptions;
}

const WordPreview: React.FC<Props> = ({ templateBuffer, resume, options }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
