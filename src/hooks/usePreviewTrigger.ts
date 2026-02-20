/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */

import { useState, useEffect, useRef } from 'react';
import type { ResumeConfig } from '../types/resume';

/** プレビュー更新のデバウンス遅延（ミリ秒） */
const PREVIEW_DEBOUNCE_MS = 2000;

/** 即時更新のスロットル間隔（ミリ秒） — 連続Enter等による過剰更新を防止 */
const FLUSH_THROTTLE_MS = 500;

/**
 * プレビュー更新タイミングを制御するカスタムフック
 *
 * - resume変更時: PREVIEW_DEBOUNCE_MS 後に previewResume を更新
 * - flushCount変更時: 即座に previewResume を更新（FLUSH_THROTTLE_MS で間引き）
 *
 * @param resume 現在の履歴書データ
 * @param flushCount 即時更新シグナル（インクリメントで発火）
 * @returns previewResume — デバウンス済みの履歴書データ
 */
export const usePreviewTrigger = (
    resume: ResumeConfig,
    flushCount: number
): { previewResume: ResumeConfig } => {
    const [previewResume, setPreviewResume] = useState<ResumeConfig>(resume);

    // 最新のresumeを常に参照できるようにする
    const resumeRef = useRef(resume);
    useEffect(() => {
        resumeRef.current = resume;
    }, [resume]);

    // 最後にflushした時刻を記録（throttle用）
    const lastFlushTimeRef = useRef(0);

    // デバウンスタイマー
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // --- Debounce: resume変更時に遅延更新 ---
    useEffect(() => {
        // デバウンスタイマーをリセット
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            setPreviewResume(resumeRef.current);
            lastFlushTimeRef.current = Date.now();
        }, PREVIEW_DEBOUNCE_MS);

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [resume]);

    // --- Flush: flushCount変更時に即時更新（throttle付き） ---
    useEffect(() => {
        // 初回レンダー時のflushCount=0は無視
        if (flushCount === 0) return;

        const now = Date.now();
        const elapsed = now - lastFlushTimeRef.current;

        if (elapsed >= FLUSH_THROTTLE_MS) {
            // throttle間隔を超えている → 即時更新
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
            }
            setPreviewResume(resumeRef.current);
            lastFlushTimeRef.current = now;
        }
        // throttle間隔内 → スキップ（デバウンスタイマーに任せる）
    }, [flushCount]);

    return { previewResume };
};
