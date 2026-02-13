import { createContext, useContext } from 'react';
import type { ResumeConfig, TemplateEntry, ExportOptions } from '../types/resume';

/**
 * エディタのモード ('json' | 'yaml')
 */
export type EditorMode = 'json' | 'yaml';

/**
 * ResumeContextが提供する値と関数の型定義
 */
export interface ResumeContextType {
    /** 現在の履歴書データ */
    resume: ResumeConfig;
    /** 履歴書データを更新する */
    setResume: (resume: ResumeConfig) => void;
    /** エディタ上の生テキストデータ */
    rawText: string;
    /** エディタ上の生テキストデータを更新する */
    setRawText: (text: string) => void;
    /** 現在のエディタモード */
    mode: EditorMode;
    /** エディタモードを変更する */
    setMode: (mode: EditorMode) => void;
    /** パースエラーメッセージ (nullならエラーなし) */
    parseError: string | null;
    /** 外部データをインポートする */
    importData: (data: string | ResumeConfig, type: 'json' | 'yaml' | 'auto') => void;
    /** インポート元のフォーマット */
    sourceFormat: 'word' | 'excel' | 'pdf' | 'other' | null;
    /** ロードされたテンプレートリスト */
    templates: TemplateEntry[];
    /** テンプレートを追加する (単一) */
    addTemplate: (file: File, format: 'word' | 'excel') => Promise<void>;
    /** テンプレートを追加する (複数) */
    addTemplates: (files: File[]) => Promise<void>;
    /** テンプレートを削除する */
    removeTemplate: (id: string) => void;
    /** テンプレートのチェック状態を切り替える */
    toggleTemplateCheck: (id: string) => void;
    /** 現在選択されているテンプレートID */
    selectedTemplateId: string | null;
    /** テンプレートを選択する */
    setSelectedTemplateId: (id: string | null) => void;
    /** エクスポートオプション */
    exportOptions: ExportOptions;
    /** エクスポートオプションを更新する */
    setExportOptions: (options: ExportOptions) => void;
    /** プレビューモード ('standard' | 'template') */
    previewMode: 'standard' | 'template';
    /** プレビューモードを変更する */
    setPreviewMode: (mode: 'standard' | 'template') => void;
    /** 証明写真ファイル */
    portraitFile: File | null;
    /** 証明写真ファイルを設定する */
    setPortraitFile: (file: File | null) => void;
}

/**
 * 履歴書データ管理コンテキスト
 */
export const ResumeContext = createContext<ResumeContextType | undefined>(undefined);

/**
 * ResumeContextを利用するためのカスタムフック
 * @returns ResumeContextType
 * @throws ResumeProvider外で使用された場合にエラーをスロー
 */
export const useResume = () => {
    const context = useContext(ResumeContext);
    if (context === undefined) {
        throw new Error('useResume must be used within a ResumeProvider');
    }
    return context;
};
