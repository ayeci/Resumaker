/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */

import React, { Suspense, useState, useRef, useEffect, useLayoutEffect, lazy, useCallback } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import { useResume } from '../context/ResumeHooks';
import styles from './Preview.module.scss';
import clsx from 'clsx';
import { WordPreview } from './WordPreview';
import StandardPreview, { A4_WIDTH_MM, A4_HEIGHT_MM } from './StandardPreview';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { RotateCcw } from 'lucide-react';
import { usePreviewTrigger } from '../hooks/usePreviewTrigger';
import { ErrorBoundary } from './ErrorBoundary';
import { templateFileStore } from '../store/fileStore';
import { checkIsMobile } from '../utils/device';
import { SESSION_KEYS } from '../utils/sessionKeys';
import { useNotification } from './NotificationContext';

const ExcelPreview = lazy(() => import('./ExcelPreview'));
const MM_TO_PX = 3.78;

export const Preview: React.FC = () => {
    const { notify } = useNotification();
    const { resume, templates, selectedTemplateId, previewMode, exportOptions, flushCount } = useResume();
    const [isLoading, setIsLoading] = useState(false);

    // モバイル判定
    const [isMobileEnv, setIsMobileEnv] = useState(checkIsMobile());
    useLayoutEffect(() => {
        const handleResize = () => setIsMobileEnv(checkIsMobile());
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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

    // 2本指での「ズームしながらパン」を可能にするための指の中心点トラッカー
    const lastTouchCenter = useRef({ x: 0, y: 0 });

    // 1. 操作したいDOM要素（インスタンス）を保持する変数
    const innerRef = useRef<HTMLDivElement>(null);

    // 2. 座標データとズーム倍率（計算用の絶対的な最新値）を保持する変数
    const panRef = useRef({ x: 0, y: 0 });

    // 3. ズーム倍率も同様に Ref で持っておくと同期が楽
    const scaleRef = useRef(scale);

    const selectedTemplate = templates.find(t => t.id === selectedTemplateId) ?? null;

    const [actualFile, setActualFile] = useState<File | null>(null);

    useEffect(() => {
        if (!isLoading) {
            const timer = setTimeout(() => {
                sessionStorage.removeItem(SESSION_KEYS.HEAVY_TASK);
            }, 1000); // 1秒以内にisLoadingがtrueになれば、この消去はキャンセルされる
            return () => clearTimeout(timer);
        }
    }, [isLoading]);

    useEffect(() => {
        let isMounted = true;

        const loadFile = async () => {
            if (previewMode === 'template' && selectedTemplateId) {
                setActualFile(null);

                // 1. ストレージからデータを取得
                const fileData = await templateFileStore.get(selectedTemplateId);

                if (fileData) {
                    try {
                        // ストアに保持されている Blob/File を直接使用（fetch コピーを廃止）
                        if (isMounted) {// 2. スマホブラウザ向けに、型を厳密に定義したBlobを作成
                            const blob = new Blob([fileData.data], {
                                type: fileData.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                            });

                            // 3. Fileオブジェクトとして再構成（名前と最終更新日を付与）
                            const file = new File([blob], fileData.name, {
                                type: blob.type,
                                lastModified: Date.now()
                            });

                            // 4. 【重要】一部のモバイルブラウザ向けにObjectURLを生成して
                            // データの存在をブラウザのメモリに「ピン留め」する
                            const tempUrl = URL.createObjectURL(file);

                            setActualFile(file);

                            // 5. クリーンアップ：コンポーネントが消える時にURLを解放する
                            return () => URL.revokeObjectURL(tempUrl);
                        }
                    } catch (e) {
                        notify("template-load-error", "error", "テンプレートの復号または展開に失敗しました");
                        console.error("テンプレートの復号または展開に失敗しました", e);
                    }
                }
            } else {
                setActualFile(null);
            }
        };

        loadFile();

        return () => { isMounted = false; };
    }, [previewMode, selectedTemplateId, notify]);

    // コンテンツから報告されたサイズ（論理サイズ, defaultはA4サイズ基準）
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
    const applyTransformToDOM = useCallback((pan: { x: number, y: number }, scale: number) => {
        let finalX = pan.x;
        let finalY = pan.y;

        if (viewportRef.current && wrapperRef.current && innerRef.current) {
            const viewportRect = viewportRef.current.getBoundingClientRect();
            const wrapperRect = wrapperRef.current.getBoundingClientRect();

            // CSSのFlexbox等による「中央寄せ」で生じている本来のズレ（余白）を計算
            const wrapperOffsetX = wrapperRect.left - viewportRect.left;
            const wrapperOffsetY = wrapperRect.top - viewportRect.top;

            const actualWidth = Math.max(baseWidthPx, innerRef.current.scrollWidth);
            const actualHeight = Math.max(baseHeightPx, innerRef.current.scrollHeight);

            const scaledWidth = actualWidth * scale;
            const scaledHeight = actualHeight * scale;

            const MARGIN_X = Math.min(100, viewportRect.width * 0.2);
            const MARGIN_Y = Math.min(100, viewportRect.height * 0.2);

            // 画面より小さい場合はJSで中央寄せし、大きい場合は端で止める
            const freeSpaceX = viewportRect.width - scaledWidth;
            let minX, maxX;
            if (freeSpaceX > 0) {
                const centerX = freeSpaceX / 2 - wrapperOffsetX;
                minX = centerX;
                maxX = centerX;
            } else {
                const limitLeft = viewportRect.width - scaledWidth - wrapperOffsetX - MARGIN_X;
                const limitRight = MARGIN_X - wrapperOffsetX;
                minX = Math.min(limitLeft, limitRight);
                maxX = Math.max(limitLeft, limitRight);
            }

            const freeSpaceY = viewportRect.height - scaledHeight;
            let minY, maxY;
            if (freeSpaceY > 0) {
                const centerY = freeSpaceY / 2 - wrapperOffsetY;
                minY = centerY;
                maxY = centerY;
            } else {
                const limitTop = viewportRect.height - scaledHeight - wrapperOffsetY - MARGIN_Y;
                const limitBottom = MARGIN_Y - wrapperOffsetY;
                minY = Math.min(limitTop, limitBottom);
                maxY = Math.max(limitTop, limitBottom);
            }

            finalX = Math.max(minX, Math.min(maxX, pan.x));
            finalY = Math.max(minY, Math.min(maxY, pan.y));
        }

        panRef.current = { x: finalX, y: finalY };

        if (innerRef.current) {
            innerRef.current.style.transform = `translate3d(${finalX}px, ${finalY}px, 0) scale(${scale})`;
        }
    }, [baseWidthPx, baseHeightPx]);

    // スケーリングの更新処理
    const updateScale = useCallback((forcedSize?: typeof contentSize, forceReset: boolean = false) => {
        const viewport = viewportRef.current;
        if (!viewport) return;

        const isMobile = window.innerWidth <= 768;
        // モバイルではスクロールバーの出現/消失による ResizeObserver 無限ループ（Reactのクラッシュ、真っ白な画面）を防ぐため、
        // viewport.clientWidth を避け window.innerWidth で固定する。
        const parentWidth = isMobile ? window.innerWidth : (viewport.clientWidth > 0 ? viewport.clientWidth : window.innerWidth);
        const size = forcedSize || contentSize;

        // テンプレートモードではパディングなし、通常プレビューでは 32px (1rem*2)
        const contentFitWidthWithPadding = size.fitWidth + currentPadding;

        let newScale = 1;

        if (isMobile) {
            newScale = size.fitWidth > 0 ? (parentWidth) / contentFitWidthWithPadding : 1;
        } else {
            newScale = 1.0;
        }

        const finalNewScale = Math.max(newScale, 0.1);
        setBaseScale(finalNewScale);

        let nextScale = finalNewScale;

        setScale(() => {
            if (!forceReset && isManualZoomRef.current) {
                // 手動ズーム中は「過去のState(prev)」ではなく、絶対的な「最新のRef」を正として維持する
                nextScale = scaleRef.current;
                return scaleRef.current;
            }
            scaleRef.current = finalNewScale;
            return finalNewScale;
        });

        requestAnimationFrame(() => {
            const targetPan = forceReset ? { x: 0, y: 0 } : panRef.current;
            applyTransformToDOM(targetPan, nextScale);
            setPan({ ...panRef.current });
        });

    }, [contentSize, currentPadding, applyTransformToDOM]);

    // 子コンポーネントからのサイズ変更通知
    const handleSizeChange = useCallback((size: typeof contentSize) => {
        setContentSize(size);
    }, []);

    // ウィンドウリサイズによるコンテナサイズ監視
    useLayoutEffect(() => {
        const handleResize = () => {
            if (!isManualZoomRef.current) {
                updateScale();
            }
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [updateScale]);

    // モード・テンプレート切替時にスケーリングをリセット
    const currentModeAndTemplate = `${previewMode}-${selectedTemplateId}`;
    const previousModeAndTemplate = useRef(currentModeAndTemplate);

    useLayoutEffect(() => {
        if (previousModeAndTemplate.current !== currentModeAndTemplate) {
            previousModeAndTemplate.current = currentModeAndTemplate; // フラグは同期的に即座に更新する

            // リンターエラー回避のため、requestAnimationFrameで遅延実行
            const frameId = requestAnimationFrame(() => {
                isManualZoomRef.current = false;
                updateScale(undefined, true);
            });

            return () => cancelAnimationFrame(frameId);
        }
    }, [currentModeAndTemplate, updateScale]);

    // タッチ操作の登録
    useEffect(() => {
        const element = wrapperRef.current;
        if (!element) return;

        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 1) {
                // 1本指はパン（移動）操作
                isDraggingRef.current = true;
                lastPanPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            } else if (e.touches.length === 2) {
                // 2本指はズーム＆パン操作
                isDraggingRef.current = false;
                const dist = Math.hypot(
                    e.touches[0].pageX - e.touches[1].pageX,
                    e.touches[0].pageY - e.touches[1].pageY
                );
                initialDistance.current = dist;
                initialScale.current = scaleRef.current;

                // 初期タッチ時の2本指の中心点を記録
                const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                if (viewportRef.current) {
                    const rect = viewportRef.current.getBoundingClientRect();
                    lastTouchCenter.current = { x: centerX - rect.left, y: centerY - rect.top };
                }
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length === 1 && isDraggingRef.current) {
                // 1本指でのパン
                if (e.cancelable) e.preventDefault();
                const dx = e.touches[0].clientX - lastPanPos.current.x;
                const dy = e.touches[0].clientY - lastPanPos.current.y;
                const newPan = {
                    x: panRef.current.x + dx,
                    y: panRef.current.y + dy
                };

                isManualZoomRef.current = true;
                applyTransformToDOM(newPan, scaleRef.current);
                lastPanPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };

            } else if (e.touches.length === 2 && initialDistance.current !== null) {
                // 2本指でのズーム＆パン
                if (e.cancelable) e.preventDefault();
                const dist = Math.hypot(
                    e.touches[0].pageX - e.touches[1].pageX,
                    e.touches[0].pageY - e.touches[1].pageY
                );
                const delta = dist / initialDistance.current;
                const newScale = Math.min(Math.max(initialScale.current * delta, 0.1), 5.0);

                const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

                if (viewportRef.current) {
                    const rect = viewportRef.current.getBoundingClientRect();
                    const mouseX = centerX - rect.left;
                    const mouseY = centerY - rect.top;

                    // 1. ズームの基準点を中心にするための座標補正
                    const scaleRatio = newScale / scaleRef.current;
                    const newPan = {
                        x: mouseX - (mouseX - panRef.current.x) * scaleRatio,
                        y: mouseY - (mouseY - panRef.current.y) * scaleRatio
                    };

                    // 2. ズームしながらの「パン（平行移動）」を加算
                    newPan.x += mouseX - lastTouchCenter.current.x;
                    newPan.y += mouseY - lastTouchCenter.current.y;

                    isManualZoomRef.current = true;
                    scaleRef.current = newScale;
                    lastTouchCenter.current = { x: mouseX, y: mouseY };

                    // 操作中はDOMのみ更新
                    applyTransformToDOM(newPan, newScale);
                }
            }
        };

        const handleTouchEnd = (e: TouchEvent) => {
            if (e.touches.length === 0) {
                // 全ての指が離れた時、結果を確定させる
                if (isDraggingRef.current || initialDistance.current !== null) {
                    isDraggingRef.current = false;
                    initialDistance.current = null;
                    applyTransformToDOM(panRef.current, scaleRef.current);
                    setScale(scaleRef.current);
                    setPan({ ...panRef.current }); // 新規オブジェクトを渡してボタンを確実に出現させる
                }
            } else if (e.touches.length === 1) {
                // 2本指から1本指に減った際のジャンプ防止
                initialDistance.current = null;
                isDraggingRef.current = true;
                lastPanPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
        };

        element.addEventListener('touchstart', handleTouchStart, { passive: false });
        element.addEventListener('touchmove', handleTouchMove, { passive: false });
        element.addEventListener('touchend', handleTouchEnd);
        element.addEventListener('touchcancel', handleTouchEnd);

        return () => {
            element.removeEventListener('touchstart', handleTouchStart);
            element.removeEventListener('touchmove', handleTouchMove);
            element.removeEventListener('touchend', handleTouchEnd);
            element.removeEventListener('touchcancel', handleTouchEnd);
        };
    }, [applyTransformToDOM]);

    // マウスホイールでのズーム・パン操作の登録
    useEffect(() => {
        const container = viewportRef.current;
        if (!container) return;

        let wheelTimeout: NodeJS.Timeout | null = null;

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault(); // ブラウザ全体のスクロール・ズームを防ぐ
            isManualZoomRef.current = true;

            if (e.ctrlKey || e.metaKey) {
                // Ctrl + ホイール: ズーム操作
                const zoomSensitivity = 0.002;
                const delta = -e.deltaY * zoomSensitivity;
                const newScale = Math.min(Math.max(scaleRef.current + delta, 0.1), 5.0);

                // マウスカーソルの位置をズームの基準点にする
                const rect = container.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                const scaleRatio = newScale / scaleRef.current;
                const newPan = {
                    x: mouseX - (mouseX - panRef.current.x) * scaleRatio,
                    y: mouseY - (mouseY - panRef.current.y) * scaleRatio
                };

                scaleRef.current = newScale; // StateではなくRefを更新
                applyTransformToDOM(newPan, newScale);
            } else {
                // 通常ホイール: スクロール（パン操作）
                const newPan = {
                    x: panRef.current.x - e.deltaX,
                    y: panRef.current.y - e.deltaY
                };
                applyTransformToDOM(newPan, scaleRef.current);
            }

            // ホイールが止まってから150ms後にStateに反映してサイズを確定
            if (wheelTimeout) clearTimeout(wheelTimeout);
            wheelTimeout = setTimeout(() => {
                applyTransformToDOM(panRef.current, scaleRef.current);
                setScale(scaleRef.current);
                setPan({ ...panRef.current }); // 新規オブジェクトを渡す
            }, 150);
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
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [updateScale]);

    const renderLoading = () => (
        <div className={styles.renderingOverlay}>
            <div className={styles.renderingContainer}>
                <div className={styles.rendering}></div>
                <div className={styles.loadingText}>生成中...</div>
            </div>
        </div>
    );

    const renderContent = () => {
        if (previewMode === 'template' && selectedTemplate) {
            // モバイル環境の場合はプレビューを描画せず、メッセージを表示
            if (isMobileEnv) {
                return (
                    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', color: 'text.secondary' }}>
                        <Typography variant="h6" gutterBottom>プレビュー非表示</Typography>
                        <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
                            モバイル端末でのメモリ不足（ブラウザの強制終了）を防ぐため、<br />
                            テンプレートのプレビュー表示を制限しています。<br /><br />
                            データは正常に読み込まれています。<br />
                            メニューからファイルを出力してご確認ください。
                        </Typography>
                    </Box>
                );
            }

            if (!actualFile) {
                return <div>ファイルが見つかりません</div>;
            }

            return (
                <Box className={styles.templateWrapper}>
                    <Suspense fallback={renderLoading()}>
                        {selectedTemplate.format === 'excel' ? (
                            <ExcelPreview
                                key={selectedTemplate.id}
                                file={actualFile} // キャッシュされたFileを渡す
                                resume={previewResume}
                                onSizeChange={handleSizeChange}
                                setIsLoading={setIsLoading}
                            />
                        ) : selectedTemplate.format === 'word' ? (
                            <WordPreview
                                key={selectedTemplate.id}
                                file={actualFile} // キャッシュされたFileを渡す
                                resume={previewResume}
                                options={exportOptions}
                                onSizeChange={handleSizeChange}
                                setIsLoading={setIsLoading}
                            />
                        ) : (
                            <Box sx={{ p: 2 }}>サポートされていないフォーマットです</Box>
                        )}
                    </Suspense>
                </Box>
            );
        }
        return <StandardPreview resume={previewResume} exportOptions={exportOptions} onSizeChange={handleSizeChange} />;
    };

    // パン（ドラッグ）用のイベントハンドラ
    const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
        // マウスの左クリックのみを処理する（タッチ操作は無視して干渉を防ぐ）
        if (e.pointerType !== 'mouse' || e.button !== 0) return;

        isDraggingRef.current = true; // StateではなくRefを更新
        lastPanPos.current = { x: e.clientX, y: e.clientY };
        e.currentTarget.setPointerCapture(e.pointerId);

        if (viewportRef.current) viewportRef.current.style.cursor = 'grabbing';
    };

    // ズーム・パンのカクツキ対策でDOMのstyleを直接操作する
    const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
        if (e.pointerType !== 'mouse' || !isDraggingRef.current) return;

        // 1. 差分を計算
        const dx = e.clientX - lastPanPos.current.x;
        const dy = e.clientY - lastPanPos.current.y;

        // 2. 座標データ(panRef)を更新（ここでは再描画は起きない）
        const newPan = {
            x: panRef.current.x + dx,
            y: panRef.current.y + dy
        };

        isManualZoomRef.current = true;

        // 3. DOMのスタイルを直接上書き（ReactをバイパスしてGPUに命令）
        applyTransformToDOM(newPan, scaleRef.current);

        lastPanPos.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
        if (e.pointerType !== 'mouse' || !isDraggingRef.current) return;

        isDraggingRef.current = false; // Refを戻す
        e.currentTarget.releasePointerCapture(e.pointerId);

        if (viewportRef.current) viewportRef.current.style.cursor = 'grab';

        // ポインターアップ時に一回だけ State を更新して、DOM直接操作を React の世界に結果を報告する
        applyTransformToDOM(panRef.current, scaleRef.current);
        setScale(scaleRef.current); // ズーム後にドラッグしても倍率を確実に戻さない
        setPan({ ...panRef.current });
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
                style={{ cursor: 'grab', touchAction: 'none', overflow: 'hidden' }}
            >
                <Box
                    ref={wrapperRef}
                    className={clsx(styles.wrapper, previewMode === 'template' && styles.templateMode)}
                    style={{
                        width: `${baseWidthPx * scale}px`,
                        height: `${baseHeightPx * scale}px`,
                        minWidth: `${baseWidthPx * scale}px`,
                        minHeight: `${baseHeightPx * scale}px`,
                        margin: 0,
                    } as CSSProperties}
                >
                    <Box
                        className={clsx(styles.inner, previewMode === 'template' && styles.templateInner)}
                        ref={innerRef}
                        style={{
                            width: `${baseWidthPx}px`,
                            height: `${baseHeightPx}px`,
                            willChange: 'transform',
                            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`,
                            transformOrigin: 'top left',
                        } as CSSProperties}
                    >
                        <ErrorBoundary key={`${previewMode}-${selectedTemplateId}`}>
                            {renderContent()}
                        </ErrorBoundary>
                    </Box>
                </Box>
            </Box>

            {/* 共通ローディング表示 (変換中など) */}
            {isLoading && renderLoading()}

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