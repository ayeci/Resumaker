/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */

import { useState, useCallback, type ReactNode, useRef, useMemo, useEffect } from 'react';
import yaml from 'js-yaml';
import { DEFAULT_RESUME, type ResumeConfig, DEFAULT_EXPORT_OPTIONS, type ExportOptions, type TemplateEntry } from '../types/resume';
import { ResumeContext, type EditorMode } from './ResumeHooks';
import { normalizeResumeData } from '../utils/importer';
import sampleYaml from '../../example/sample.yaml?raw'; // サンプルデータを読み込む
import { generateUUID } from '../utils/uuid';
import { templateFileStore } from '../store/fileStore';
import { checkNeedsLimit } from '../utils/device';

type RecursivePartial<T> = {
    [P in keyof T]?: T[P] extends (infer U)[]
    ? RecursivePartial<U>[]
    : T[P] extends object
    ? RecursivePartial<T[P]>
    : T[P];
};

/**
 * オブジェクトから空の値（null, undefined, 空文字）を再帰的に削除する
 * @param obj 対象オブジェクト
 * @returns クリーンアップされたオブジェクト
 */
function removeEmptyProperties<T>(obj: T): T {
    if (Array.isArray(obj)) {
        return obj
            .map(v => removeEmptyProperties(v))
            .filter(v => v !== null && v !== undefined && v !== '') as unknown as T;
    }
    if (typeof obj === 'object' && obj !== null) {
        const newObj = {} as T;
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const val = removeEmptyProperties(obj[key]);
                if (val !== null && val !== undefined && (val as unknown) !== '') {
                    newObj[key] = val;
                }
            }
        }
        return newObj;
    }
    return obj;
}

/**
 * エディタ表示用に履歴書データを整形する
 * 証明写真データを除外し、リスト項目のIDを削除する
 * @param resume 履歴書データ
 * @returns エディタ用オブジェクト
 */
const prepareResumeForEditor = (resume: ResumeConfig): RecursivePartial<ResumeConfig> => {
    const { portrait: _, ...rest } = resume;
    const cleaned = { ...rest } as RecursivePartial<ResumeConfig>;

    const listKeys: (keyof ResumeConfig)[] = ['education', 'work_experience', 'certificates'];

    listKeys.forEach(key => {
        const val = cleaned[key];
        if (Array.isArray(val)) {
            cleaned[key] = val.map(item => {
                if (item && typeof item === 'object') {
                    const { id: __, ...itemRest } = item as Record<string, unknown>;
                    return itemRest;
                }
                return item;
            }) as any; // HistoryItemのID削除後の一時的な型不整合を許容
        }
    });

    return removeEmptyProperties(cleaned);
};

/**
 * 履歴書データを指定された形式の文字列にシリアライズする
 * @param resume 履歴書データ
 * @param mode シリアライズ形式 ('json' | 'yaml')
 * @returns シリアライズされた文字列
 */
const serializeResume = (resume: ResumeConfig, mode: EditorMode): string => {
    const data = prepareResumeForEditor(resume);
    return mode === 'json'
        ? JSON.stringify(data, null, 2)
        : yaml.dump(data, {
            lineWidth: -1, // 行の折り返しを無効化
            noRefs: true,  // アンカーとエイリアスを使用しない
            quotingType: '"' // 文字列を二重引用符で囲む（好みによるがJSONと親和性が高い）
        });
};

/**
 * 履歴書データ管理プロバイダー
 * アプリケーション全体で履歴書の状態を共有する
 */
export const ResumeProvider = ({ children }: { children: ReactNode }) => {
    // サンプルデータを初期値としてロード
    const initialResume = (() => {
        try {
            const parsed = yaml.load(sampleYaml, { schema: yaml.JSON_SCHEMA });
            if (parsed && typeof parsed === 'object') {
                return normalizeResumeData(parsed as Partial<ResumeConfig>) as ResumeConfig;
            }
        } catch (e) {
            console.error('Failed to load sample yaml:', e);
        }
        return DEFAULT_RESUME;
    })();

    const [resume, setResumeState] = useState<ResumeConfig>(initialResume);
    const [mode, setMode] = useState<EditorMode>('yaml');
    const [rawText, setRawText] = useState<string>(sampleYaml);
    const [parseError, setParseError] = useState<{ message: string; line?: number } | null>(null);
    const [sourceFormat, setSourceFormat] = useState<'word' | 'excel' | 'pdf' | 'other' | null>(null);
    const [templates, setTemplates] = useState<TemplateEntry[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [exportOptions, setExportOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
    const [previewMode, setPreviewMode] = useState<'standard' | 'template'>('standard');
    const [portraitFile, setPortraitFileState] = useState<File | null>(null);

    useEffect(() => {
        const loadPersistedTemplates = async () => {
            try {
                // ストレージからメタデータを取得
                const metadataList = await templateFileStore.getMetadataList();
                if (metadataList.length > 0) {
                    const restoredTemplates: TemplateEntry[] = metadataList.map(m => ({
                        id: m.id,
                        name: m.name,
                        format: m.name.endsWith('.docx') ? 'word' : 'excel' as const,
                        checked: true
                        // data はここには持たないことでメモリを節約
                    }));
                    setTemplates(restoredTemplates);

                    // 最初のテンプレートをデフォルト選択にする
                    const first = restoredTemplates[0];
                    setSelectedTemplateId(first.id);
                    setSourceFormat(first.format);
                }
            } catch (error) {
                console.error("Failed to load templates from IDB:", error);
            }
        };

        loadPersistedTemplates();
    }, []); // 初回マウント時のみ実行

    // プレビュー即時更新シグナル
    const [flushCount, setFlushCount] = useState(0);
    const flushPreview = useCallback(() => {
        setFlushCount(c => c + 1);
    }, []);

    const isImporting = useRef(false);

    const handleSetRawText = useCallback((text: string) => {
        if (isImporting.current) {
            return;
        }
        setRawText(text);
        try {
            const parsed = mode === 'json' ? JSON.parse(text) : yaml.load(text, { schema: yaml.JSON_SCHEMA });
            if (parsed && typeof parsed === 'object') {
                const normalized = normalizeResumeData(parsed as Partial<ResumeConfig>);
                setResumeState({ ...normalized, portrait: resume.portrait } as ResumeConfig);
                setParseError(null);
            }
        } catch (e: unknown) {
            let message = String(e);
            let line: number | undefined;

            const err = e as { mark?: { line: number }; reason?: string; message?: string };
            if (err.mark && typeof err.mark.line === 'number') {
                line = err.mark.line + 1;
                message = err.reason || err.message || message;
            } else if (e instanceof SyntaxError && e.message.includes('at position')) {
                const match = e.message.match(/at position (\d+)/);
                if (match) {
                    const pos = parseInt(match[1], 10);
                    const lines = text.substring(0, pos).split('\n');
                    line = lines.length;
                    message = e.message;
                }
            }

            setParseError({ message, line });
        }
    }, [mode, resume.portrait]);

    /**
     * 外部データ（文字列またはオブジェクト）を読み込み、履歴書Stateを更新する
     * 読み込み中は `isImporting` フラグを立て、エディタへの書き戻しループを防ぐ
     * @param data インポートするデータ（JSON/YAML文字列、またはResumeConfigオブジェクト）
     * @param type データの形式 ('json', 'yaml', 'auto')
     */
    const importData = useCallback((data: string | ResumeConfig, type: 'json' | 'yaml' | 'auto') => {
        isImporting.current = true;

        // 処理の完了を待たずにフラグを戻すと競合のリスクがあるため、
        // Reactの更新サイクルを考慮して少し遅延させるか、確実に更新が終わるまでガードする。
        // ここでは単純に処理後のタイムアウトで戻す（簡易的な対策）
        setTimeout(() => { isImporting.current = false; }, 500);

        if (typeof data === 'string') {
            const newMode: EditorMode = type === 'auto' ? (data.trim().startsWith('{') ? 'json' : 'yaml') : type;
            setMode(newMode);
            setRawText(data);
            try {
                const parsed = newMode === 'json' ? JSON.parse(data) : yaml.load(data, { schema: yaml.JSON_SCHEMA });
                if (parsed && typeof parsed === 'object') {
                    const normalized = normalizeResumeData(parsed as Partial<ResumeConfig>);
                    const portrait = (parsed as { portrait?: string }).portrait || resume.portrait;
                    const merged = { ...normalized, portrait } as ResumeConfig;
                    setResumeState(merged);
                    setParseError(null);
                }
            } catch (e: unknown) {
                setParseError({ message: e instanceof Error ? e.message : String(e) });
            }
        } else {
            const normalized = normalizeResumeData(data);
            const portrait = (data as { portrait?: string }).portrait || resume.portrait;
            const merged = { ...normalized, portrait } as ResumeConfig;
            setResumeState(merged);
            setRawText(serializeResume(merged, mode));
            setParseError(null);
        }
    }, [mode, resume.portrait]);

    const addTemplates = useCallback(async (files: File[]) => {
        const needsLimit = checkNeedsLimit();
        const MAX_TEMPLATES_OF_MOBILE = 5;

        const currentFiles = [...templates];
        const toRemoveIds: string[] = [];
        const newEntries: TemplateEntry[] = [];

        for (const file of files) {
            const dup = currentFiles.find(t => t.name === file.name);
            if (dup) toRemoveIds.push(dup.id);
        }

        const targetCount = (currentFiles.length - toRemoveIds.length) + files.length;
        if (needsLimit && targetCount > MAX_TEMPLATES_OF_MOBILE) {
            const overCount = targetCount - MAX_TEMPLATES_OF_MOBILE;
            const remaining = currentFiles.filter(f => !toRemoveIds.includes(f.id));
            const extra = remaining.slice(0, overCount);
            extra.forEach(e => toRemoveIds.push(e.id));
        }

        try {
            // IndexedDBの操作
            for (const id of toRemoveIds) {
                await templateFileStore.delete(id);
            }

            let lastId: string | null = null;
            let lastFormat: 'word' | 'excel' | null = null;

            for (const file of files) {
                let format: 'word' | 'excel' | 'other' = 'other';
                if (file.name.endsWith('.docx')) format = 'word';
                else if (file.name.endsWith('.xlsx')) format = 'excel';
                if (format === 'other') continue;

                const id = generateUUID();
                const buffer = await file.arrayBuffer();
                await templateFileStore.set(id, { url: '', name: file.name, type: file.type, data: buffer });

                const entry = {
                    id,
                    name: file.name,
                    format: format as 'word' | 'excel',
                    checked: true
                };
                setTemplates(prev => [...prev.filter(p => !toRemoveIds.includes(p.id)), entry]);

                lastId = id;
                lastFormat = format;

                await new Promise(resolve => setTimeout(resolve, 50));
            }

            if (lastId) {
                setSelectedTemplateId(lastId);
                setSourceFormat(lastFormat);
                flushPreview();
            }
        } catch (error) {
            console.error("Critical error in addTemplates:", error);
        }
    }, [templates, flushPreview]);

    const removeTemplate = useCallback(async (id: string) => {
        await templateFileStore.delete(id);
        setTemplates(prev => prev.filter(t => t.id !== id));
        if (selectedTemplateId === id) setSelectedTemplateId(null);
    }, [selectedTemplateId]);

    const toggleTemplateCheck = useCallback((id: string) => {
        setTemplates(prev => {
            const next = prev.map(t => t.id === id ? { ...t, checked: !t.checked } : t);
            if (id === selectedTemplateId) {
                const target = next.find(t => t.id === id);
                if (target && !target.checked) {
                    const alt = next.find(t => t.checked);
                    if (alt) {
                        // 状態更新中に別の状態更新を行うため、レンダリングサイクルをまたぐように遅延させる
                        setTimeout(() => setSelectedTemplateId(alt.id), 0);
                    }
                }
            }
            return next;
        });
    }, [selectedTemplateId]);

    const handleSetResume = useCallback((r: ResumeConfig) => importData(r, mode), [importData, mode]);

    /**
     * 現在のエディタ上のテキスト（rawText）を現在のモードに基づいて再フォーマットする
     */
    const reformat = useCallback(async () => {
        try {
            let currentData: unknown;
            if (mode === 'json') {
                currentData = JSON.parse(rawText);
                setRawText(JSON.stringify(currentData, null, 2));
            } else {
                currentData = yaml.load(rawText, { schema: yaml.JSON_SCHEMA });
                if (currentData) {
                    const formatted = yaml.dump(currentData, {
                        lineWidth: -1,
                        noRefs: true,
                        quotingType: '"',
                        indent: 2
                    });
                    setRawText(formatted);
                }
            }
            setParseError(null);
        } catch (e) {
            console.error('Reformat failed:', e);
            setParseError({ message: '整形に失敗しました: ' + (e instanceof Error ? e.message : String(e)) });
        }
    }, [mode, rawText]);

    /**
     * エディタのモード（JSON/YAML）を切り替える
     * 現在のエディタ上のテキスト（rawText）をパースし、新しい形式に変換して表示する。
     * 内部Stateではなく表示テキストを正とすることで、編集内容の消失（先祖返り）を防ぐ。
     * @param targetMode 切り替え先のモード
     */
    const handleSetMode = useCallback((targetMode: EditorMode) => {
        if (mode === targetMode) return;

        // モード切替時は、現在の rawText を正として変換を行う
        // これにより、resume state の更新ラグや競合による「先祖返り」を防ぐ
        try {
            let currentResume: ResumeConfig;
            // 現在のテキストをパース
            if (mode === 'json') {
                currentResume = JSON.parse(rawText);
            } else {
                currentResume = yaml.load(rawText, { schema: yaml.JSON_SCHEMA }) as ResumeConfig;
            }

            // 正規化してステート更新（念のため）
            const normalized = normalizeResumeData(currentResume);
            const portrait = (currentResume as { portrait?: string }).portrait || resume.portrait;
            const merged = { ...normalized, portrait } as ResumeConfig;
            setResumeState(merged);

            // 新しいモードでシリアライズ
            const newText = serializeResume(merged, targetMode);
            setMode(targetMode);
            setRawText(newText);
            setParseError(null);
        } catch (e: unknown) {
            console.error('Mode switch failed:', e);
            // パースエラーがある場合はモード切り替えを許可しないか、あるいは強制的に切り替えるか。
            // ユーザー体験としては「エラーがあります」と出して切り替えないのが安全。
            setParseError({ message: '構文エラーがあるためモードを切り替えられません: ' + (e instanceof Error ? e.message : String(e)) });
        }
    }, [mode, rawText, resume.portrait]);

    const handleSetPortraitFile = useCallback((file: File | null) => {
        // 前の Blob URL を解放してメモリを還す
        if (resume.portrait && resume.portrait.startsWith('blob:')) {
            URL.revokeObjectURL(resume.portrait);
        }

        setPortraitFileState(file);
        if (!file) {
            setResumeState(prev => ({ ...prev, portrait: '' }));
            return;
        }

        // 巨大な文字列(Base64)ではなく、参照(Blob URL)に置き換える
        const blobUrl = URL.createObjectURL(file);
        setResumeState(prev => ({ ...prev, portrait: blobUrl }));
    }, [resume.portrait]);

    const resetToSample = useCallback(() => {
        try {
            const parsed = yaml.load(sampleYaml, { schema: yaml.JSON_SCHEMA });
            if (parsed && typeof parsed === 'object') {
                const normalized = normalizeResumeData(parsed as Partial<ResumeConfig>);
                const merged = { ...normalized } as ResumeConfig;
                // MEMO: サンプルデータには画像がない想定だが、もしあればここでセット。現状は portrait の維持はしない（「破棄」なので）

                setResumeState(merged);
                setParseError(null);

                // 現在のモードに合わせてテキストを設定
                if (mode === 'json') {
                    setRawText(JSON.stringify(merged, null, 2));
                } else {
                    setRawText(sampleYaml);
                }
            }
        } catch (e) {
            console.error('Failed to reset to sample:', e);
            setParseError({ message: 'サンプルデータの読み込みに失敗しました' });
        }
    }, [mode]);

    const contextValue = useMemo(() => ({
        resume,
        setResume: handleSetResume,
        rawText,
        setRawText: handleSetRawText,
        mode,
        setMode: handleSetMode,
        parseError,
        importData,
        reformat,
        sourceFormat,
        templates,
        // インライン関数をやめて、既存の addTemplates をラップしたものを定義
        addTemplate: async (f: File) => addTemplates([f]),
        addTemplates,
        removeTemplate,
        toggleTemplateCheck,
        selectedTemplateId,
        setSelectedTemplateId,
        exportOptions,
        setExportOptions,
        previewMode,
        setPreviewMode,
        portraitFile,
        setPortraitFile: handleSetPortraitFile,
        resetToSample,
        flushPreview,
        flushCount
    }), [
        // ステート類
        resume, rawText, mode, parseError, sourceFormat, templates,
        selectedTemplateId, exportOptions, previewMode, portraitFile, flushCount,
        // useCallback で保護された各関数
        handleSetResume, handleSetRawText, handleSetMode, importData, reformat,
        addTemplates, removeTemplate, toggleTemplateCheck, handleSetPortraitFile,
        resetToSample, flushPreview
    ]);

    return (
        <ResumeContext.Provider value={contextValue}>
            {children}
        </ResumeContext.Provider>
    );
};
