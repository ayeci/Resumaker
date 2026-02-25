/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */

import { useState, useCallback, type ReactNode, useRef, useMemo, useEffect } from 'react';
import yaml from 'js-yaml';
import * as jsonc from 'jsonc-parser';
import { DEFAULT_RESUME, type ResumeConfig, DEFAULT_EXPORT_OPTIONS, type ExportOptions, type TemplateEntry } from '../types/resume';
import { ResumeContext, type EditorMode } from './ResumeHooks';
import { normalizeResumeData } from '../utils/importer';
import sampleYaml from '../../example/sample.yaml?raw'; // サンプルデータを読み込む
import { generateUUID } from '../utils/uuid';
import { templateFileStore, clearTemplateFileStore } from '../store/fileStore';
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
 * HistoryItem オブジェクトを短縮文字列 (year/month/content) に逆変換する
 * normalizeHistoryItem の逆操作。標準フィールドのみのアイテムをスラッシュ区切りに圧縮する。
 * @param item HistoryItem オブジェクト（id 除去済み）
 * @returns 短縮文字列、または変換不可能な場合はそのままのオブジェクト
 */
const compactHistoryItem = (item: Record<string, unknown>): string | Record<string, unknown> => {
    const { _shorthand, year, month, day, dow, content, ...extra } = item;

    // _shorthand マーカーがない場合はオブジェクト表記を維持（_shorthand だけ除去して返す）
    if (!_shorthand) return item;

    // 標準フィールド以外がある場合はオブジェクトのまま返す
    if (Object.keys(extra).length > 0) {
        const { _shorthand: _, ...rest } = item;
        return rest;
    }

    // content がない場合はオブジェクトのまま
    if (!content && content !== '') {
        const { _shorthand: _, ...rest } = item;
        return rest;
    }

    const y = year ? String(year) : '';
    const m = month ? String(month) : '';
    const d = day ? String(day) : '';
    const dw = dow ? String(dow) : '';
    const c = content ? String(content) : '';

    // パターンに応じて短縮文字列を生成（normalizeHistoryItem の逆）
    if (dw || d) {
        if (dw) return `${y}/${m}/${d}/${dw}/${c}`;
        return `${y}/${m}/${d}/${c}`;
    }
    if (m) return `${y}/${m}/${c}`;
    if (y) return `${y}/${c}`;
    return c;
};

/**
 * エディタ表示用に履歴書データを整形する
 * 証明写真データを除外し、リスト項目を短縮文字列に圧縮する
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
                    // 標準フィールドのみなら短縮文字列に戻す
                    return compactHistoryItem(itemRest);
                }
                return item;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            }) as any;
        }
    });

    return removeEmptyProperties(cleaned);
};

/**
 * YAML テキストから `#` コメントを抽出し、`//` 形式に変換して JSON テキストに挿入する
 * キーの前にあるコメントを対応する JSON キーの前に配置する
 * @param yamlText 元の YAML テキスト
 * @param jsonText 変換後の JSON テキスト
 * @returns コメント付き JSONC テキスト
 */
const convertYamlCommentsToJsonc = (yamlText: string, jsonText: string): string => {
    const yamlLines = yamlText.split('\n');
    // キーとその前のコメントを収集
    const commentMap = new Map<string, string[]>();
    let pendingComments: string[] = [];

    for (const line of yamlLines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#')) {
            // YAML コメント行 → JSONC 形式に変換
            pendingComments.push(trimmed.replace(/^#+\s*/, '// '));
        } else if (trimmed && pendingComments.length > 0) {
            // コメント直後の最初のキーを取得
            const keyMatch = trimmed.match(/^([\w_-]+)\s*:/);
            if (keyMatch) {
                commentMap.set(keyMatch[1], [...pendingComments]);
            }
            pendingComments = [];
        } else if (!trimmed) {
            // 空行でもコメントを保持
        } else {
            pendingComments = [];
        }
    }

    // JSON テキストにコメントを挿入
    const jsonLines = jsonText.split('\n');
    const result: string[] = [];
    for (const jsonLine of jsonLines) {
        // JSON キーを検出（"key": 形式）
        const jsonKeyMatch = jsonLine.match(/^(\s*)"([\w_-]+)"\s*:/);
        if (jsonKeyMatch) {
            const [, indent, key] = jsonKeyMatch;
            const comments = commentMap.get(key);
            if (comments) {
                for (const comment of comments) {
                    result.push(`${indent}${comment}`);
                }
                commentMap.delete(key);
            }
        }
        result.push(jsonLine);
    }

    return result.join('\n');
};

/**
 * JSONC テキストから `//` コメントを抽出し、`#` 形式に変換して YAML テキストに挿入する
 * @param jsoncText 元の JSONC テキスト
 * @param yamlText 変換後の YAML テキスト
 * @returns コメント付き YAML テキスト
 */
const convertJsoncCommentsToYaml = (jsoncText: string, yamlText: string): string => {
    const jsoncLines = jsoncText.split('\n');
    const commentMap = new Map<string, string[]>();
    let pendingComments: string[] = [];

    for (const line of jsoncLines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('//')) {
            pendingComments.push(trimmed.replace(/^\/\/\s*/, '# '));
        } else if (trimmed && pendingComments.length > 0) {
            const keyMatch = trimmed.match(/^"([\w_-]+)"\s*:/);
            if (keyMatch) {
                commentMap.set(keyMatch[1], [...pendingComments]);
            }
            pendingComments = [];
        } else if (!trimmed) {
            // 空行
        } else {
            pendingComments = [];
        }
    }

    const yamlLines = yamlText.split('\n');
    const result: string[] = [];
    for (const yamlLine of yamlLines) {
        const yamlKeyMatch = yamlLine.match(/^(\s*)([\w_-]+)\s*:/);
        if (yamlKeyMatch) {
            const [, indent, key] = yamlKeyMatch;
            const comments = commentMap.get(key);
            if (comments) {
                for (const comment of comments) {
                    result.push(`${indent}${comment}`);
                }
                commentMap.delete(key);
            }
        }
        result.push(yamlLine);
    }

    return result.join('\n');
};

/**
 * 履歴書データを指定された形式の文字列にシリアライズする
 * @param resume 履歴書データ
 * @param mode シリアライズ形式 ('jsonc' | 'yaml')
 * @returns シリアライズされた文字列
 */
const serializeResume = (resume: ResumeConfig, mode: EditorMode): string => {
    const data = prepareResumeForEditor(resume);
    return mode === 'jsonc'
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
    const [editorVersion, setEditorVersion] = useState<number>(0);

    const updateRawTextExternally = useCallback((text: string) => {
        setRawText(text);
        setEditorVersion(v => v + 1);
    }, []);

    useEffect(() => {
        const initTemplateStore = async () => {
            try {
                // まず前セッションのデータを全消去（データ残存防止）
                await clearTemplateFileStore();

                // PC（暗号化有効環境）のみテンプレートの復元を試行
                // モバイル（暗号化なし）では復元しない:
                //   前セッションの揮発性キーは消失しているため暗号化済みデータは復号不可
                //   平文データは意図しない復元を防ぐため読み込まない
                if (!checkNeedsLimit()) {
                    const metadataList = await templateFileStore.getMetadataList();
                    if (metadataList.length > 0) {
                        const restoredTemplates: TemplateEntry[] = metadataList.map(m => ({
                            id: m.id,
                            name: m.name,
                            format: m.name.endsWith('.docx') ? 'word' : 'excel' as const,
                            checked: true
                        }));
                        setTemplates(restoredTemplates);

                        const first = restoredTemplates[0];
                        setSelectedTemplateId(first.id);
                        setSourceFormat(first.format);
                    }
                }
            } catch (error) {
                console.error("Failed to initialize template store:", error);
            }
        };

        initTemplateStore();
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
            const parsed = mode === 'jsonc' ? jsonc.parse(text) : yaml.load(text, { schema: yaml.JSON_SCHEMA });
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
    const importData = useCallback((data: string | ResumeConfig, type: 'jsonc' | 'yaml' | 'auto') => {
        isImporting.current = true;

        // 処理の完了を待たずにフラグを戻すと競合のリスクがあるため、
        // Reactの更新サイクルを考慮して少し遅延させるか、確実に更新が終わるまでガードする。
        // ここでは単純に処理後のタイムアウトで戻す（簡易的な対策）
        setTimeout(() => { isImporting.current = false; }, 500);

        if (typeof data === 'string') {
            const newMode: EditorMode = type === 'auto' ? (data.trim().startsWith('{') ? 'jsonc' : 'yaml') : type;
            setMode(newMode);
            updateRawTextExternally(data);
            try {
                const parsed = newMode === 'jsonc' ? jsonc.parse(data) : yaml.load(data, { schema: yaml.JSON_SCHEMA });
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
            updateRawTextExternally(serializeResume(merged, mode));
            setParseError(null);
        }
    }, [mode, resume.portrait, updateRawTextExternally]);

    /**
     * テンプレートを1件追加する（既存の同名ファイルは自動的に置換される）
     * 複数ファイルの場合はApp.tsx側で1件ずつ呼び出す。
     * これにより各呼び出しのasyncクロージャが完全に解放され、GCが確実に効く。
     */
    const addTemplates = useCallback(async (files: File[]) => {
        const needsLimit = checkNeedsLimit();
        const MAX_TEMPLATES_OF_MOBILE = 5;

        for (const file of files) {
            let format: 'word' | 'excel' | 'other' = 'other';
            if (file.name.endsWith('.docx')) format = 'word';
            else if (file.name.endsWith('.xlsx')) format = 'excel';
            if (format === 'other') continue;

            const id = generateUUID();
            const fileName = file.name;
            const fileType = file.type;

            // ファイル読み込み
            const buffer = await file.arrayBuffer();

            // 保存
            await templateFileStore.set(id, {
                url: '', name: fileName, type: fileType, data: buffer
            });

            // State更新: 同名テンプレートの置換 + 上限管理
            setTemplates(prev => {
                let next = [...prev.filter(t => t.name !== fileName), {
                    id,
                    name: fileName,
                    format: format as 'word' | 'excel',
                    checked: true
                }];
                // モバイルの上限を超えた場合、古いテンプレートを先頭から削除
                if (needsLimit && next.length > MAX_TEMPLATES_OF_MOBILE) {
                    const excess = next.slice(0, next.length - MAX_TEMPLATES_OF_MOBILE);
                    excess.forEach(e => templateFileStore.delete(e.id));
                    next = next.slice(next.length - MAX_TEMPLATES_OF_MOBILE);
                }
                return next;
            });

            setSelectedTemplateId(id);
            setSourceFormat(format as 'word' | 'excel');
        }

        flushPreview();
    }, [flushPreview]);

    const removeTemplate = useCallback(async (id: string) => {
        await templateFileStore.delete(id);

        setTemplates(prev => {
            const index = prev.findIndex(t => t.id === id);
            if (index === -1) return prev;

            const nextTemplates = prev.filter(t => t.id !== id);

            // 削除対象が現在選択中だった場合の切り替えロジック
            if (selectedTemplateId === id) {
                if (nextTemplates.length === 0) {
                    // 全て消えた
                    setSelectedTemplateId(null);
                    setPreviewMode('standard');
                } else {
                    // インデックスを維持しようとする（後ろがあれば後ろ、なければ最後）
                    const nextSelectIndex = index < nextTemplates.length ? index : nextTemplates.length - 1;
                    setSelectedTemplateId(nextTemplates[nextSelectIndex].id);
                }
            }
            return nextTemplates;
        });
    }, [selectedTemplateId, setPreviewMode]);

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
            if (mode === 'jsonc') {
                // jsonc.format() はコメントを保持したまま整形できる
                const edits = jsonc.format(rawText, undefined, { tabSize: 2, insertSpaces: true });
                updateRawTextExternally(jsonc.applyEdits(rawText, edits));
            } else {
                currentData = yaml.load(rawText, { schema: yaml.JSON_SCHEMA });
                if (currentData) {
                    const formatted = yaml.dump(currentData, {
                        lineWidth: -1,
                        noRefs: true,
                        quotingType: '"',
                        indent: 2
                    });
                    updateRawTextExternally(formatted);
                }
            }
            setParseError(null);
        } catch (e) {
            console.error('Reformat failed:', e);
            setParseError({ message: '整形に失敗しました: ' + (e instanceof Error ? e.message : String(e)) });
        }
    }, [mode, rawText, updateRawTextExternally]);

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
            if (mode === 'jsonc') {
                currentResume = jsonc.parse(rawText);
            } else {
                currentResume = yaml.load(rawText, { schema: yaml.JSON_SCHEMA }) as ResumeConfig;
            }

            // 正規化してステート更新（念のため）
            const normalized = normalizeResumeData(currentResume);
            const portrait = (currentResume as { portrait?: string }).portrait || resume.portrait;
            const merged = { ...normalized, portrait } as ResumeConfig;
            setResumeState(merged);

            // 新しいモードでシリアライズ
            let newText = serializeResume(merged, targetMode);

            // コメント変換: 元のテキストからコメントを抽出し、新しいテキストに挿入
            if (mode === 'yaml' && targetMode === 'jsonc') {
                newText = convertYamlCommentsToJsonc(rawText, newText);
            } else if (mode === 'jsonc' && targetMode === 'yaml') {
                newText = convertJsoncCommentsToYaml(rawText, newText);
            }

            setMode(targetMode);
            updateRawTextExternally(newText);
            setParseError(null);
        } catch (e: unknown) {
            console.error('Mode switch failed:', e);
            // パースエラーがある場合はモード切り替えを許可しないか、あるいは強制的に切り替えるか。
            // ユーザー体験としては「エラーがあります」と出して切り替えないのが安全。
            setParseError({ message: '構文エラーがあるためモードを切り替えられません: ' + (e instanceof Error ? e.message : String(e)) });
        }
    }, [mode, rawText, resume.portrait, updateRawTextExternally]);

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
                if (mode === 'jsonc') {
                    updateRawTextExternally(JSON.stringify(merged, null, 2));
                } else {
                    updateRawTextExternally(sampleYaml);
                }
            }
        } catch (e) {
            console.error('Failed to reset to sample:', e);
            setParseError({ message: 'サンプルデータの読み込みに失敗しました' });
        }
    }, [mode, updateRawTextExternally]);

    const contextValue = useMemo(() => ({
        resume,
        setResume: handleSetResume,
        rawText,
        setRawText: handleSetRawText,
        editorVersion,
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
        resume, rawText, editorVersion, mode, parseError, sourceFormat, templates,
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
