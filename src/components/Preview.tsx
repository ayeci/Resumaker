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
import { Box, IconButton, Tooltip } from '@mui/material';
import { RotateCcw } from 'lucide-react';
import { usePreviewTrigger } from '../hooks/usePreviewTrigger';
import { ErrorBoundary } from './ErrorBoundary';

const ExcelPreview = React.lazy(() => import('./ExcelPreview'));
const MM_TO_PX = 3.78;

export const Preview: React.FC = () => {
    const { resume, templates, selectedTemplateId, previewMode, exportOptions, flushCount } = useResume();

    // デバウンス済みのプレビュー用履歴書データ
    const { previewResume } = usePreviewTrigger(resume, flushCount);
    const viewportRef = useRef<HTMLDivElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const [baseScale, setBaseScale] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const isDraggingRef = useRef(false);
    const lastPanPos = useRef({ x: 0, y: 0 });
    const initialDistance = useRef<number | null>(null);
    const initialScale = useRef<number>(1);
    const isManualZoomRef = useRef(false);

    // 1. 操作したいDOM要素（インスタンス）を保持する変数
    const innerRef = useRef<HTMLDivElement>(null);

    // 2. 座標データ（計算用の最新値）を保持する変数
    // ※ useState ではなく useRef を使うことで、値を書き換えても「再描画」を発生させない
    const panRef = useRef({ x: 0, y: 0 });

    // 3. ズーム倍率も同様に Ref で持っておくと同期が楽です
    const scaleRef = useRef(scale);

    // Stateが更新されたら、こっそり Ref も同期しておく（初期化・ボタンリセット用）
    useEffect(function syncRefs() {
        panRef.current = pan;
        scaleRef.current = scale;
    }, [pan, scale]);

    const selectedTemplate = templates.find(t => t.id === selectedTemplateId) ?? null;

    // コンテンツから報告されたサイズ（論理サイズ）
    const [contentSize, setContentSize] = useState({
        fitWidth: A4_WIDTH_MM * MM_TO_PX,
        fitHeight: A4_HEIGHT_MM * MM_TO_PX,
        totalWidth: A4_WIDTH_MM * MM_TO_PX,
        totalHeight: A4_HEIGHT_MM * MM_TO_PX
    });

    // 論理サイズ（ベースとなる大きさ）
    const currentPadding = previewMode === 'template' ? 0 : 32;
    const baseWidthPx = contentSize.totalWidth + currentPadding;
    const baseHeightPx = contentSize.totalHeight + currentPadding;


    /** DOM直接操作用の共通ヘルパー関数 */
    const applyTransformToDOM = React.useCallback((pan: { x: number, y: number }, scale: number) => {
        let finalX = pan.x;
        let finalY = pan.y;
        if (viewportRef.current && wrapperRef.current) {
            // Viewport と Wrapper の「実際の画面上の位置」を取得
            // （DOMを書き換える前に取得するので、パフォーマンス低下の心配はありません）
            const viewportRect = viewportRef.current.getBoundingClientRect();
            const wrapperRect = wrapperRef.current.getBoundingClientRect();

            // CSSのFlexbox等による「中央寄せ」で生じている本来のズレ（余白）を計算
            const wrapperOffsetX = wrapperRect.left - viewportRect.left;
            const wrapperOffsetY = wrapperRect.top - viewportRect.top;

            // 子コンポーネントからの自己申告サイズだけでなく、
            // 実際のDOM（Wordの複数ページ等であふれた分）の scrollWidth / scrollHeight も見て、大きい方を採用する
            const actualWidth = innerRef.current ? Math.max(baseWidthPx, innerRef.current.scrollWidth) : baseWidthPx;
            const actualHeight = innerRef.current ? Math.max(baseHeightPx, innerRef.current.scrollHeight) : baseHeightPx;

            const scaledWidth = baseWidthPx * scale;
            const scaledHeight = baseHeightPx * scale;

            const MARGIN_X = Math.min(100, viewportRect.width * 0.2);
            const MARGIN_Y = Math.min(100, viewportRect.height * 0.2);

            // X軸の制限
            const minX = MARGIN_X - scaledWidth - wrapperOffsetX;
            const maxX = viewportRect.width - MARGIN_X - wrapperOffsetX;

            // Y軸の制限
            const minY = MARGIN_Y - scaledHeight - wrapperOffsetY;
            const maxY = viewportRect.height - MARGIN_Y - wrapperOffsetY;

            // 制限の適用
            finalX = Math.max(minX, Math.min(maxX, pan.x));
            finalY = Math.max(minY, Math.min(maxY, pan.y));

            const finalWrapperWidth = `${actualWidth * scale}px`;
            const finalWrapperHeight = `${actualHeight * scale}px`;
            wrapperRef.current.style.width = finalWrapperWidth;
            wrapperRef.current.style.height = finalWrapperHeight;
            wrapperRef.current.style.minWidth = finalWrapperWidth;
            wrapperRef.current.style.minHeight = finalWrapperHeight;
        }

        // 計算後の正しい座標を Ref に上書き保存する（見えない壁での空回り防止）
        panRef.current = { x: finalX, y: finalY };

        if (innerRef.current) {
            innerRef.current.style.transform = `translate3d(${finalX}px, ${finalY}px, 0) scale(${scale})`;
        }
        if (wrapperRef.current) {
            const scaledWidth = `${baseWidthPx * scale}px`;
            const scaledHeight = `${baseHeightPx * scale}px`;

            wrapperRef.current.style.width = scaledWidth;
            wrapperRef.current.style.height = scaledHeight;
            wrapperRef.current.style.minWidth = scaledWidth;
            wrapperRef.current.style.minHeight = scaledHeight;
        }
    }, [baseWidthPx, baseHeightPx]);

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
        const finalNewScale = Math.max(newScale, 0.1);
        setBaseScale(finalNewScale);

        setScale(prev => {
            // 手動ズーム中で、強制リセットでない場合は現在の倍率を維持
            if (!forceReset && isManualZoomRef.current) return prev;
            return finalNewScale;
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
            setPan({ x: 0, y: 0 });
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
                scaleRef.current = newScale; // StateではなくRefを更新

                applyTransformToDOM(panRef.current, newScale);
            }
        };

        const handleTouchEnd = () => {
            if (initialDistance.current !== null) {
                initialDistance.current = null;
                // 指を離したタイミングでStateに反映
                setScale(scaleRef.current);
            }
        };

        element.addEventListener('touchstart', handleTouchStart, { passive: false });
        element.addEventListener('touchmove', handleTouchMove, { passive: false });
        element.addEventListener('touchend', handleTouchEnd);
        element.addEventListener('touchcancel', handleTouchEnd); // touchend / touchcancel 両方に設定

        return () => {
            element.removeEventListener('touchstart', handleTouchStart);
            element.removeEventListener('touchmove', handleTouchMove);
            element.removeEventListener('touchend', handleTouchEnd);
            element.removeEventListener('touchcancel', handleTouchEnd);
        };
    }, [applyTransformToDOM]);

    // マウスホイールでのズーム操作の登録
    useEffect(() => {
        const container = viewportRef.current;
        if (!container) return;

        let wheelTimeout: NodeJS.Timeout | null = null;

        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault(); // ブラウザ全体のズームを防ぐ

                const zoomSensitivity = 0.001;
                const delta = -e.deltaY * zoomSensitivity;

                const newScale = Math.min(Math.max(scaleRef.current + delta, 0.1), 3.0);
                isManualZoomRef.current = true;
                scaleRef.current = newScale; // StateではなくRefを更新

                applyTransformToDOM(panRef.current, newScale);

                // ホイールが止まってから150ms後にStateに反映
                if (wheelTimeout) clearTimeout(wheelTimeout);
                wheelTimeout = setTimeout(() => {
                    setScale(scaleRef.current);
                }, 150);
            }
        };

        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            container.removeEventListener('wheel', handleWheel);
            if (wheelTimeout) clearTimeout(wheelTimeout);
        };
    }, [applyTransformToDOM]);

    // Ctrl+0でのズームリセット操作の登録
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === '0') {
                e.preventDefault(); // ブラウザ標準のズームリセットを防ぐ
                isManualZoomRef.current = false;
                updateScale(undefined, true);
                setPan({ x: 0, y: 0 });
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

    // パン（ドラッグ）用のイベントハンドラ
    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        // メインボタン（左クリック）またはタッチの場合のみ処理
        if (e.button !== 0 && e.pointerType === 'mouse') return;

        isDraggingRef.current = true; // StateではなくRefを更新
        lastPanPos.current = { x: e.clientX, y: e.clientY };
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    // ズーム・パンのカクツキ対策でDOMのstyleを直接操作する
    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDraggingRef.current || initialDistance.current !== null) return;

        const dx = e.clientX - lastPanPos.current.x;
        const dy = e.clientY - lastPanPos.current.y;

        // 座標データ(panRef)を更新（ここでは再描画は起きない）
        panRef.current = {
            x: panRef.current.x + dx,
            y: panRef.current.y + dy
        };

        applyTransformToDOM(panRef.current, scaleRef.current);

        lastPanPos.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false; // Refを戻す
        e.currentTarget.releasePointerCapture(e.pointerId);

        // ポインターアップ時に一回だけ State を更新して、DOM直接操作を React の世界に結果を報告する
        setPan(panRef.current);
        setScale(scaleRef.current);
    };

    return (
        <Box style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0 }}>
            <Box
                className={styles.viewport}
                ref={viewportRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{ cursor: 'grab', touchAction: 'none' }}
            >
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
                        ref={innerRef}
                        style={{
                            width: `${baseWidthPx}px`,
                            height: `${baseHeightPx}px`,
                            /* GPUアクセラレーションを強制 */
                            willChange: 'transform',
                            /* ズームと移動を同時に適用（必ず translate → scale の順序） */
                            transform: `translate3d(${pan.x}px, ${pan.y}px,0) scale(${scale})`,
                            transformOrigin: 'top left',
                        } as React.CSSProperties}
                    >
                        <ErrorBoundary key={`${previewMode}-${selectedTemplateId}`}>
                            {renderContent()}
                        </ErrorBoundary>
                    </Box>
                </Box>
            </Box>

            {/* ズーム/パンのリセットボタン */}
            <Box
                style={{
                    position: 'absolute',
                    bottom: 16,
                    right: 16,
                    zIndex: 1000,
                    opacity: (Math.abs(scale - baseScale) > 0.001 || pan.x !== 0 || pan.y !== 0) ? 1 : 0,
                    pointerEvents: (Math.abs(scale - baseScale) > 0.001 || pan.x !== 0 || pan.y !== 0) ? 'auto' : 'none',
                    transition: 'opacity 0.2s ease-in-out',
                }}
            >
                <Tooltip title="表示リセット (Ctrl+0)" placement="left">
                    <IconButton
                        onClick={() => {
                            isManualZoomRef.current = false;
                            updateScale(undefined, true);
                            setPan({ x: 0, y: 0 });
                        }}
                        style={{
                            backgroundColor: '#fff',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                        }}
                        size="medium"
                    >
                        <RotateCcw size={20} />
                    </IconButton>
                </Tooltip>
            </Box>
        </Box>
    );
};