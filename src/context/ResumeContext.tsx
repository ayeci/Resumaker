/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */
import { useState, type ReactNode, useRef } from 'react';
import yaml from 'js-yaml';
import { DEFAULT_RESUME, type ResumeConfig, DEFAULT_EXPORT_OPTIONS, type ExportOptions, type TemplateEntry } from '../types/resume';
import { ResumeContext, type EditorMode } from './ResumeHooks';
import { normalizeResumeData } from '../utils/importer';
import sampleYaml from '../../example/sample.yaml?raw'; // サンプルデータを読み込む

/**
 * オブジェクトから空の値（null, undefined, 空文字）を再帰的に削除する
 * 配列内の空要素も削除される
 * @param obj 対象オブジェクト
 * @returns クリーンアップされたオブジェクト
 */
const removeEmptyProperties = (obj: any): any => {
    if (Array.isArray(obj)) {
        return obj.map(v => removeEmptyProperties(v)).filter(v => v !== null && v !== undefined && v !== '');
    }
    if (typeof obj === 'object' && obj !== null) {
        const newObj: any = {};
        Object.keys(obj).forEach(key => {
            const val = removeEmptyProperties(obj[key]);
            if (val !== null && val !== undefined && val !== '') {
                // 再帰的に空のオブジェクトになった場合も削除したい場合はここを調整
                // 現在は { nested: {} } のように空オブジェクトは残る仕様
                // もし { year: "" } -> {} となり、それを親から消したいなら:
                if (typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length === 0) {
                    // 厳密なクリーンアップが必要な場合は空のオブジェクトを無視する
                    // ただし、空のオブジェクトが有効な場合もある（厳密な構造など）。履歴書の場合、通常は維持しても削除しても問題なし。
                }
                newObj[key] = val;
            }
        });
        return newObj;
    }
    return obj;
};

/**
 * エディタ表示用に履歴書データを整形する
 * 証明写真データを除外し、リスト項目のIDを削除する
 * @param resume 履歴書データ
 * @returns エディタ用オブジェクト
 */
const prepareResumeForEditor = (resume: ResumeConfig): Record<string, unknown> => {
    const { portrait: _, ...rest } = resume;
    // リスト項目のID削除などの処理は removeEmptyProperties に任せることもできるが、
    // 明示的なID削除は維持しつつ、空プロパティ削除を適用する
    const listKeys: (keyof ResumeConfig)[] = ['education', 'work_experience', 'certificates'];
    const cleaned = { ...rest } as Record<string, any>;

    listKeys.forEach(key => {
        const val = cleaned[key];
        if (Array.isArray(val)) {
            cleaned[key] = val.map((item: any) => {
                const { id: __, ...itemRest } = item;
                return itemRest;
            });
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
    const [templateFiles, setTemplateFiles] = useState<TemplateEntry[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [exportOptions, setExportOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
    const [previewMode, setPreviewMode] = useState<'standard' | 'template'>('standard');
    const [portraitFile, setPortraitFileState] = useState<File | null>(null);

    const isImporting = useRef(false);

    const handleSetRawText = (text: string) => {
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
        } catch (e: any) {
            // ... (エラー処理)
            let message = String(e);
            let line: number | undefined;

            if (e.mark && typeof e.mark.line === 'number') {
                line = e.mark.line + 1;
                message = e.reason || e.message;
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
    };

    /**
     * 外部データ（文字列またはオブジェクト）を読み込み、履歴書Stateを更新する
     * 読み込み中は `isImporting` フラグを立て、エディタへの書き戻しループを防ぐ
     * @param data インポートするデータ（JSON/YAML文字列、またはResumeConfigオブジェクト）
     * @param type データの形式 ('json', 'yaml', 'auto')
     */
    const importData = (data: string | ResumeConfig, type: 'json' | 'yaml' | 'auto') => {
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
                    const merged = { ...normalized, portrait: (normalized as any).portrait || resume.portrait } as ResumeConfig;
                    setResumeState(merged);
                    setParseError(null);
                }
            } catch (e: any) {
                setParseError({ message: e instanceof Error ? e.message : String(e) });
            }
        } else {
            const normalized = normalizeResumeData(data);
            const merged = { ...normalized, portrait: (normalized as any).portrait || resume.portrait } as ResumeConfig;
            setResumeState(merged);
            setRawText(serializeResume(merged, mode));
            setParseError(null);
        }
    };

    const addTemplates = async (files: File[]) => {
        const newEntries: TemplateEntry[] = [];
        let lastId = selectedTemplateId;
        let lastFormat: any = sourceFormat;
        for (const file of files) {
            let format: 'word' | 'excel' | 'other' = 'other';
            if (file.name.endsWith('.docx')) format = 'word';
            else if (file.name.endsWith('.xlsx')) format = 'excel';
            if (format === 'other') continue;
            const buffer = await file.arrayBuffer();
            const entry: TemplateEntry = { id: crypto.randomUUID(), file, arrayBuffer: buffer, name: file.name, format: format as 'word' | 'excel', checked: true };
            newEntries.push(entry);
            lastId = entry.id;
            lastFormat = format;
        }
        if (newEntries.length > 0) {
            setTemplateFiles(prev => {
                const names = new Set(newEntries.map(e => e.name));
                return [...prev.filter(t => !names.has(t.name)), ...newEntries];
            });
            setSelectedTemplateId(lastId);
            setSourceFormat(lastFormat);
        }
    };

    const removeTemplate = (id: string) => {
        setTemplateFiles(prev => prev.filter(t => t.id !== id));
        if (selectedTemplateId === id) setSelectedTemplateId(null);
    };

    const toggleTemplateCheck = (id: string) => {
        setTemplateFiles(prev => {
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
    };
    const handleSetResume = (r: ResumeConfig) => importData(r, mode);

    /**
     * エディタのモード（JSON/YAML）を切り替える
     * 現在のエディタ上のテキスト（rawText）をパースし、新しい形式に変換して表示する。
     * 内部Stateではなく表示テキストを正とすることで、編集内容の消失（先祖返り）を防ぐ。
     * @param targetMode 切り替え先のモード
     */
    const handleSetMode = (targetMode: EditorMode) => {
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
            const merged = { ...normalized, portrait: (normalized as any).portrait || resume.portrait } as ResumeConfig;
            setResumeState(merged);

            // 新しいモードでシリアライズ
            const newText = serializeResume(merged, targetMode);
            setMode(targetMode);
            setRawText(newText);
            setParseError(null);
        } catch (e) {
            console.error('Mode switch failed:', e);
            // パースエラーがある場合はモード切り替えを許可しないか、あるいは強制的に切り替えるか。
            // ユーザー体験としては「エラーがあります」と出して切り替えないのが安全。
            setParseError({ message: '構文エラーがあるためモードを切り替えられません: ' + (e instanceof Error ? e.message : String(e)) });
        }
    };

    const handleSetPortraitFile = (file: File | null) => {
        setPortraitFileState(file);
        if (!file) { setResumeState(prev => ({ ...prev, portrait: '' })); return; }
        const r = new FileReader();
        r.onload = (e) => { const d = e.target?.result as string; if (d) setResumeState(prev => ({ ...prev, portrait: d })); };
        r.readAsDataURL(file);
    };

    const resetToSample = () => {
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
    };

    return (
        <ResumeContext.Provider value={{
            resume, setResume: handleSetResume, rawText, setRawText: handleSetRawText, mode, setMode: handleSetMode, parseError, importData,
            sourceFormat, templates: templateFiles, addTemplate: async (f, _fm) => addTemplates([f]), addTemplates, removeTemplate,
            toggleTemplateCheck, selectedTemplateId, setSelectedTemplateId, exportOptions, setExportOptions, previewMode, setPreviewMode,
            portraitFile, setPortraitFile: handleSetPortraitFile, resetToSample
        }}>
            {children}
        </ResumeContext.Provider>
    );
};
