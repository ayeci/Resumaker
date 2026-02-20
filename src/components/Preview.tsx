/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */

import React, { Suspense, useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useResume } from '../context/ResumeHooks';
import styles from './Preview.module.scss';
import clsx from 'clsx';
import WordPreview from './WordPreview';
import StandardPreview, { A4_WIDTH_MM, A4_HEIGHT_MM } from './StandardPreview';
import { Box } from '@mui/material';
import { usePreviewTrigger } from '../hooks/usePreviewTrigger';

const ExcelPreview = React.lazy(() => import('./ExcelPreview'));
const MM_TO_PX = 3.78;

export const Preview: React.FC = () => {
    const { resume, templates, selectedTemplateId, previewMode, exportOptions, flushCount } = useResume();

    // デバウンス済みのプレビュー用履歴書データ
    const { previewResume } = usePreviewTrigger(resume, flushCount);
    const viewportRef = useRef<HTMLDivElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const initialDistance = useRef<number | null>(null);
    const initialScale = useRef<number>(1);
    const isManualZoomRef = useRef(false);

    const scaleRef = useRef(scale);
    useEffect(() => { scaleRef.current = scale; }, [scale]);

    const selectedTemplate = templates.find(t => t.id === selectedTemplateId) ?? null;

    // コンテンツから報告されたサイズ（論理サイズ）
    const [contentSize, setContentSize] = useState({
        fitWidth: A4_WIDTH_MM * MM_TO_PX,
        fitHeight: A4_HEIGHT_MM * MM_TO_PX,
        totalWidth: A4_WIDTH_MM * MM_TO_PX,
        totalHeight: A4_HEIGHT_MM * MM_TO_PX
    });

    // スケーリングの更新処理
    const updateScale = React.useCallback((forcedSize?: typeof contentSize, forceReset: boolean = false) => {
        const viewport = viewportRef.current;
        if (!viewport) return;

        const isMobile = window.innerWidth <= 768;
        // モバイルではスクロールバーの出現/消失による ResizeObserver 無限ループ（Reactのクラッシュ、真っ白な画面）を防ぐため、
        // viewport.clientWidth を避け window.innerWidth で固定します。
        const parentWidth = isMobile ? window.innerWidth : (viewport.clientWidth > 0 ? viewport.clientWidth : window.innerWidth);

        const size = forcedSize || contentSize;

        // テンプレートモードではパディングなし、通常プレビューでは 32px (1rem*2)
        const currentPadding = previewMode === 'template' ? 0 : 32;
        const contentFitWidthWithPadding = size.fitWidth + currentPadding;

        let newScale = 1;

        if (isMobile) {
            // モバイル: 表示可能領域の横幅いっぱいにフィット (ウインドウの端に合わせる)
            // 少しだけ余白を見込むため 0.96 などをかけるか、単に parentWidth をパディング込みで計算
            newScale = size.fitWidth > 0 ? (parentWidth) / contentFitWidthWithPadding : 1;
        } else {
            // PC: ユーザー要望により 100% 表示を基本とする (縮小フィットさせない)
            newScale = 1.0;
        }

        // 下限設定
        setScale(prev => {
            // 手動ズーム中で、強制リセットでない場合は現在の倍率を維持
            if (!forceReset && isManualZoomRef.current) return prev;
            return Math.max(newScale, 0.1);
        });
    }, [contentSize, previewMode]);

    // 子コンポーネントからのサイズ変更通知
    const handleSizeChange = React.useCallback((size: typeof contentSize) => {
        setContentSize(size);
    }, []);

    // ウィンドウリサイズによるコンテナサイズ監視 (ResizeObserverの無限ループ回避のため)
    useLayoutEffect(() => {
        const handleResize = () => {
            if (!isManualZoomRef.current) {
                updateScale();
            }
        };

        // 初期ロード時にも一回実行
        handleResize();

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [updateScale]);

    // モード切替時にスケーリングをリセット
    useEffect(() => {
        const frameId = requestAnimationFrame(() => {
            isManualZoomRef.current = false;
            updateScale(undefined, true);
        });
        return () => cancelAnimationFrame(frameId);
    }, [previewMode, selectedTemplateId, updateScale]);

    // ピンチ操作の登録
    useEffect(() => {
        const element = wrapperRef.current;
        if (!element) return;

        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 2) {
                const dist = Math.hypot(
                    e.touches[0].pageX - e.touches[1].pageX,
                    e.touches[0].pageY - e.touches[1].pageY
                );
                initialDistance.current = dist;
                initialScale.current = scaleRef.current;
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length === 2 && initialDistance.current !== null) {
                if (e.cancelable) e.preventDefault();
                const dist = Math.hypot(
                    e.touches[0].pageX - e.touches[1].pageX,
                    e.touches[0].pageY - e.touches[1].pageY
                );
                const delta = dist / initialDistance.current;
                const newScale = Math.min(Math.max(initialScale.current * delta, 0.1), 3);
                isManualZoomRef.current = true;
                setScale(newScale);
            }
        };

        const handleTouchEnd = () => { initialDistance.current = null; };

        element.addEventListener('touchstart', handleTouchStart, { passive: false });
        element.addEventListener('touchmove', handleTouchMove, { passive: false });
        element.addEventListener('touchend', handleTouchEnd);

        return () => {
            element.removeEventListener('touchstart', handleTouchStart);
            element.removeEventListener('touchmove', handleTouchMove);
            element.removeEventListener('touchend', handleTouchEnd);
        };
    }, []);

    // マウスホイールでのズーム操作の登録
    useEffect(() => {
        const container = viewportRef.current;
        if (!container) return;

        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault(); // ブラウザ全体のズームを防ぐ

                const zoomSensitivity = 0.001;
                const delta = -e.deltaY * zoomSensitivity;

                setScale((prev) => {
                    const newScale = Math.min(Math.max(prev + delta, 0.1), 3.0);
                    isManualZoomRef.current = true;
                    return newScale;
                });
            }
        };

        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, []);

    // Ctrl+0でのズームリセット操作の登録
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === '0') {
                e.preventDefault(); // ブラウザ標準のズームリセットを防ぐ
                isManualZoomRef.current = false;
                updateScale(undefined, true);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [updateScale]);

    const renderContent = () => {
        if (previewMode === 'template' && selectedTemplate) {
            return (
                <Box className={styles.templateWrapper}>
                    {selectedTemplate.format === 'excel' ? (
                        <Suspense fallback={<div>Loading Excel Preview...</div>}>
                            <ExcelPreview
                                templateBuffer={selectedTemplate.arrayBuffer}
                                resume={previewResume}
                                onSizeChange={handleSizeChange}
                            />
                        </Suspense>
                    ) : selectedTemplate.format === 'word' ? (
                        <WordPreview
                            templateBuffer={selectedTemplate.arrayBuffer}
                            resume={previewResume}
                            options={exportOptions}
                            onSizeChange={handleSizeChange}
                        />
                    ) : (
                        <div>サポートされていないフォーマットです</div>
                    )}
                </Box>
            );
        }
        return <StandardPreview resume={previewResume} exportOptions={exportOptions} onSizeChange={handleSizeChange} />;
    };

    // 論理サイズ（ベースとなる大きさ）
    const currentPadding = previewMode === 'template' ? 0 : 32;
    const baseWidthPx = contentSize.totalWidth + currentPadding;
    const baseHeightPx = contentSize.totalHeight + currentPadding;

    return (
        <Box className={styles.viewport} ref={viewportRef}>
            <Box
                ref={wrapperRef}
                className={clsx(styles.wrapper, previewMode === 'template' && styles.templateMode)}
                style={{
                    /* 物理的な「フットプリント」サイズをJSで確保 */
                    width: `${baseWidthPx * scale}px`,
                    height: `${baseHeightPx * scale}px`,

                    /* モバイルなどでギリギリの時に吸着しないよう、
                       少しだけ余白を持たせると安全です（任意）
                    */
                    minWidth: `${baseWidthPx * scale}px`,
                    minHeight: `${baseHeightPx * scale}px`,
                } as React.CSSProperties}
            >
                <Box
                    className={clsx(styles.inner, previewMode === 'template' && styles.templateInner)}
                    style={{
                        width: `${baseWidthPx}px`,
                        height: `${baseHeightPx}px`,

                        /* ここを変えました：左上基準 */
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left',
                    } as React.CSSProperties}
                >
                    {renderContent()}
                </Box>
            </Box>
        </Box>
    );
};
