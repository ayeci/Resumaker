import type { HistoryItem } from '../types/resume';

const ENDING_KEYWORDS = ['現在', '至る', '退職', '退社', '卒業', '修了', '終了', '完了', '満了', '予定'];

const isFuture = (year: string, month: string): boolean => {
    if (!year) return false;
    const y = parseInt(year, 10);
    const m = month ? parseInt(month, 10) : 12; // 年のみ指定の場合は年末(12月)として扱う
    // 未来の日付判定: ユーザーが「2025」と入力し、現在が2024年なら未来と判定する

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    if (y > currentYear) return true;
    if (y === currentYear && m > currentMonth) return true;

    return false;
};

/**
 * 履歴項目を処理し、最終行への「現在に至る」の追加などを行う
 * @param items 履歴項目リスト
 * @param type 履歴タイプ ('education' | 'work')
 * @param addCurrentMarker 「現在に至る」を自動付与するか
 * @returns 処理済みの履歴項目リスト
 */
export const processHistory = (items: HistoryItem[], type: 'education' | 'work', addCurrentMarker = false): HistoryItem[] => {
    if (items.length === 0) return items;
    if (type !== 'work') return items;

    const processed = [...items];

    // 「現在に至る」を付与しない設定、または既に自動付与済み(IDチェック)の場合はスキップ
    // (ReactのStrict Mode等で2回呼ばれた場合のガード)
    if (!addCurrentMarker) return processed;

    const lastItem = items[items.length - 1];

    // 1. 既に終了キーワードが含まれているかチェック
    if (ENDING_KEYWORDS.some(k => lastItem.content && lastItem.content.includes(k))) {
        return processed;
    }

    // 2. 未来の日付かチェック
    if (lastItem.year && lastItem.month && isFuture(lastItem.year, lastItem.month)) {
        return processed;
    }

    // 3. 「現在に至る」を追加
    processed.push({
        id: 'auto-current',
        year: '',
        month: '',
        content: '現在に至る'
    });

    return processed;
};

import type { ResumeConfig, ExportOptions } from '../types/resume';

/**
 * 学歴・職歴・各種終了マーカーを含む、表示用の統合された履歴リストを構築する
 * Preview.tsxとexporter.tsで共通のロジックを使用するために利用
 * @param resume 履歴書データ
 * @param options エクスポートオプション
 * @returns 構築された履歴項目リスト
 */
export const buildCombinedHistory = (resume: ResumeConfig, options: ExportOptions): HistoryItem[] => {
    const list: HistoryItem[] = [];
    const education = resume.education || [];
    const workExperience = resume.work_experience || [];

    // 学歴
    if (education.length > 0) {
        list.push({ id: 'education-header', content: '学歴', content_align: 'center' });
        list.push(...education);
        // 学歴ブロックの「以上」
        if (options.isEducationEndMarker) {
            list.push({ id: 'edu-end', content: '以上', content_align: 'right' });
        }
    }

    // 職歴
    if (workExperience.length > 0) {
        list.push({ id: 'work-header', content: '職歴', content_align: 'center' });

        // 職歴データの処理（「現在に至る」の付与判定を含む）
        const processedWork = processHistory(workExperience, 'work', options.isWorkCurrentMarker);
        list.push(...processedWork);

        // 職歴ブロックの「以上」
        if (options.isWorkEndMarker) {
            list.push({ id: 'work-end', content: '以上', content_align: 'right' });
        }
    }

    // 履歴全体の「以上」
    // データが存在する場合のみ付与チェック
    if (list.length > 0 && options.isHistoryEndMarker) {
        list.push({ id: 'history-end', content: '以上', content_align: 'right' });
    } else if (list.length === 0) {
        // データが何もない場合
        list.push({ id: 'history-empty', content: '特になし' });
    }

    return list;
};
