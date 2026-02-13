import { useState, type ReactNode } from 'react';
import yaml from 'js-yaml';
import { DEFAULT_RESUME, type ResumeConfig, DEFAULT_EXPORT_OPTIONS, type ExportOptions, type TemplateEntry } from '../types/resume';
import { ResumeContext, type EditorMode } from './ResumeHooks';
import { normalizeResumeData } from '../utils/importer';

/**
 * エディタ表示用に履歴書データを整形する
 * 証明写真データを除外し、リスト項目のIDを削除する
 * @param resume 履歴書データ
 * @returns エディタ用オブジェクト
 */
const prepareResumeForEditor = (resume: ResumeConfig): Record<string, unknown> => {
    const { portrait: _, ...rest } = resume;
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
    return cleaned;
};

/**
 * 履歴書データを指定された形式の文字列にシリアライズする
 * @param resume 履歴書データ
 * @param mode シリアライズ形式 ('json' | 'yaml')
 * @returns シリアライズされた文字列
 */
const serializeResume = (resume: ResumeConfig, mode: EditorMode): string => {
    const data = prepareResumeForEditor(resume);
    return mode === 'json' ? JSON.stringify(data, null, 2) : yaml.dump(data);
};

/**
 * 履歴書データ管理プロバイダー
 * アプリケーション全体で履歴書の状態を共有する
 */
export const ResumeProvider = ({ children }: { children: ReactNode }) => {
    const [resume, setResumeState] = useState<ResumeConfig>(DEFAULT_RESUME);
    const [mode, setMode] = useState<EditorMode>('yaml');
    const [rawText, setRawText] = useState<string>(() => serializeResume(DEFAULT_RESUME, 'yaml'));
    const [parseError, setParseError] = useState<string | null>(null);
    const [sourceFormat, setSourceFormat] = useState<'word' | 'excel' | 'pdf' | 'other' | null>(null);
    const [templateFiles, setTemplateFiles] = useState<TemplateEntry[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [exportOptions, setExportOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
    const [previewMode, setPreviewMode] = useState<'standard' | 'template'>('standard');
    const [portraitFile, setPortraitFileState] = useState<File | null>(null);

    const handleSetRawText = (text: string) => {
        setRawText(text);
        try {
            const parsed = mode === 'json' ? JSON.parse(text) : yaml.load(text);
            if (parsed && typeof parsed === 'object') {
                const normalized = normalizeResumeData(parsed as Partial<ResumeConfig>);
                setResumeState({ ...normalized, portrait: resume.portrait } as ResumeConfig);
                setParseError(null);
            }
        } catch (e) {
            setParseError(e instanceof Error ? e.message : String(e));
        }
    };

    const importData = (data: string | ResumeConfig, type: 'json' | 'yaml' | 'auto') => {
        if (typeof data === 'string') {
            const newMode: EditorMode = type === 'auto' ? (data.trim().startsWith('{') ? 'json' : 'yaml') : type;
            setMode(newMode);
            setRawText(data);
            try {
                const parsed = newMode === 'json' ? JSON.parse(data) : yaml.load(data);
                if (parsed && typeof parsed === 'object') {
                    const normalized = normalizeResumeData(parsed as Partial<ResumeConfig>);
                    const merged = { ...normalized, portrait: (normalized as any).portrait || resume.portrait } as ResumeConfig;
                    setResumeState(merged);
                    setParseError(null);
                    setRawText(serializeResume(merged, newMode));
                }
            } catch (e) {
                setParseError(e instanceof Error ? e.message : String(e));
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
    const handleSetMode = (m: EditorMode) => { setMode(m); setRawText(serializeResume(resume, m)); };
    const handleSetPortraitFile = (file: File | null) => {
        setPortraitFileState(file);
        if (!file) { setResumeState(prev => ({ ...prev, portrait: '' })); return; }
        const r = new FileReader();
        r.onload = (e) => { const d = e.target?.result as string; if (d) setResumeState(prev => ({ ...prev, portrait: d })); };
        r.readAsDataURL(file);
    };

    return (
        <ResumeContext.Provider value={{
            resume, setResume: handleSetResume, rawText, setRawText: handleSetRawText, mode, setMode: handleSetMode, parseError, importData,
            sourceFormat, templates: templateFiles, addTemplate: async (f, _fm) => addTemplates([f]), addTemplates, removeTemplate,
            toggleTemplateCheck, selectedTemplateId, setSelectedTemplateId, exportOptions, setExportOptions, previewMode, setPreviewMode,
            portraitFile, setPortraitFile: handleSetPortraitFile
        }}>
            {children}
        </ResumeContext.Provider>
    );
};
