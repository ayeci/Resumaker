/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */
import { useRef, useState, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import {
    Box,
    Typography,
    IconButton,
    Tooltip,
    ToggleButton,
    ToggleButtonGroup,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Button
} from '@mui/material';
import {
    AlignLeft,
    FileSymlink,
    Type,
    Download
} from 'lucide-react';
import { saveAs } from 'file-saver';
import { useResume } from '../context/ResumeHooks';
import { PortraitUpload } from './PortraitUpload';
import styles from './Editor.module.scss';
import { resumeSchema } from '../constants/resumeSchema';
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import NumberSpinner from './NumberSpinner';

// monaco-yaml のためにローカルの monaco インスタンスを使用するように設定
loader.config({ monaco });

// JSONの場合は組み込みの機能を設定
// @ts-expect-error: jsonDefaults の型定義不足を回避
monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    schemas: [{
        uri: 'http://myserver/resume-schema.json',
        fileMatch: ['*'],
        schema: resumeSchema
    }]
});

interface ResumeEditorProps {
    fontSize: number;
    setFontSize: (size: number) => void;
}

/**
 * JSON/YAML形式での直接編集、ファイルインポート、証明写真のアップロード機能を提供する
 */
export const ResumeEditor: React.FC<ResumeEditorProps> = ({ fontSize, setFontSize }) => {
    const { mode, setMode, rawText, setRawText, parseError, resetToSample, reformat, flushPreview } = useResume();

    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [reloadDialogOpen, setReloadDialogOpen] = useState(false);

    const handleReloadClick = () => setReloadDialogOpen(true);
    const handleReloadConfirm = () => {
        resetToSample();
        setReloadDialogOpen(false);
    };
    const handleReloadCancel = () => setReloadDialogOpen(false);

    // モバイル判定（App.tsx と同期させるために 768px を閾値とする）
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

    /**
     * エディタの内容が変更された際のハンドラ
     * ユーザー入力による変更のみをContextに反映させる。
     * プログラムによる値の注入（flush）時はState更新をスキップし、無限ループやデータ競合を防ぐ。
     */
    const handleEditorChange = (value: string | undefined, event: monaco.editor.IModelContentChangedEvent) => {
        // プログラムによる変更（isFlush）の場合は、Contextへの書き戻しを行わない
        if (event.isFlush) {
            return;
        }
        setRawText(value || '');
    };

    const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
    const editorDomRef = useRef<HTMLElement | null>(null);
    const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
        editorRef.current = editor;
        editorDomRef.current = editor.getDomNode();
    };

    // IME確定・英語Enter・blur時にプレビュー即時更新シグナルを送信
    const flushRef = useRef(flushPreview);
    useEffect(() => { flushRef.current = flushPreview; }, [flushPreview]);

    const handleCompositionEnd = useCallback(() => {
        flushRef.current();
    }, []);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // IME入力中のEnterは除外し、英語入力の改行Enterのみ即時更新
        if (e.key === 'Enter' && !e.isComposing) {
            flushRef.current();
        }
    }, []);

    const handleBlur = useCallback(() => {
        flushRef.current();
    }, []);

    useEffect(() => {
        const dom = editorDomRef.current;
        if (!dom) return;

        dom.addEventListener('compositionend', handleCompositionEnd);
        dom.addEventListener('keydown', handleKeyDown);
        dom.addEventListener('blur', handleBlur, true); // blur は capture で捕捉

        return () => {
            dom.removeEventListener('compositionend', handleCompositionEnd);
            dom.removeEventListener('keydown', handleKeyDown);
            dom.removeEventListener('blur', handleBlur, true);
        };
    }, [handleCompositionEnd, handleKeyDown, handleBlur]);

    /**
     * エディタの内容を手動でフォーマット（整形）する
     */
    const handleFormat = async () => {
        // コンテキストの整形関数を使用（エディタインスタンス外からの呼び出しにも対応）
        await reformat();
        setStatusMessage('整形完了');
        setTimeout(() => setStatusMessage(null), 2000);
    };

    /**
     * 現在のエディタの内容をそのままファイルとして保存する
     */
    const handleSaveRaw = (format: 'yaml' | 'json') => {
        const blob = new Blob([rawText], { type: 'text/plain;charset=utf-8' });
        saveAs(blob, `resume.${format}`);
        setStatusMessage(`${format.toUpperCase()}保存完了`);
        setTimeout(() => setStatusMessage(null), 2000);
    };

    return (
        <Box className={styles.editorRoot}>
            {!isMobile && (
                <Box className={styles.editorToolbar}>
                    <Tooltip title="モード切替（YAML/JSONを自動変換します）" arrow>
                        <Box className={styles.editorLabelSection}>
                            <ToggleButtonGroup
                                value={mode}
                                exclusive
                                onChange={(_, newMode) => newMode && setMode(newMode)}
                                size="small"
                                sx={{ height: 24, ml: 1 }}
                            >
                                <ToggleButton value="yaml" sx={{ fontSize: 10, px: 1 }}>YAML</ToggleButton>
                                <ToggleButton value="json" sx={{ fontSize: 10, px: 1 }}>JSON</ToggleButton>
                            </ToggleButtonGroup>
                        </Box>
                    </Tooltip>
                    <Tooltip title="フォントサイズ変更" arrow>
                        <Box className={styles.editorFontSize}>
                            <Type size={18} color="#64748b" />
                            <NumberSpinner
                                className={styles.editorFontSizeSpinner}
                                value={fontSize}
                                onValueChange={(val) => {
                                    if (val !== null) setFontSize(val);
                                }}
                                min={10}
                                max={30}
                                step={1}
                                size="small"
                                aria-label="文字サイズ"
                            />
                        </Box>
                    </Tooltip>
                    <Box className={styles.toolbarActions}>
                        <Tooltip title="データ整形" arrow>
                            <IconButton size="small" onClick={handleFormat} className={styles.toolbarIconBtn}>
                                <AlignLeft size={18} />
                            </IconButton>
                        </Tooltip>
                        <PortraitUpload variant="icon" />
                        <Tooltip title="サンプルデータ再読込" arrow>
                            <IconButton size="small" onClick={handleReloadClick} className={styles.toolbarIconBtn}>
                                <FileSymlink size={18} />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title={`${mode.toUpperCase()}形式で保存`} arrow>
                            <IconButton
                                size="small"
                                onClick={() => handleSaveRaw(mode)}
                                className={styles.toolbarIconBtn}
                            >
                                <Download size={18} />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Box>
            )}

            <Dialog
                open={reloadDialogOpen}
                onClose={handleReloadCancel}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
            >
                <DialogTitle id="alert-dialog-title">
                    {"サンプルデータ再読込"}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText id="alert-dialog-description">
                        現在の内容を破棄して、サンプルデータを読み直しますか？
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleReloadCancel}>やめる</Button>
                    <Button onClick={handleReloadConfirm} autoFocus>
                        はい
                    </Button>
                </DialogActions>
            </Dialog>

            <Box className={styles.editorTextareaContainer}>
                <Editor
                    height="100%"
                    defaultLanguage="yaml"
                    language={mode}
                    value={rawText}
                    onChange={handleEditorChange}
                    onMount={handleEditorDidMount}
                    options={{
                        minimap: { enabled: false },
                        fontSize,
                        mouseWheelZoom: false,
                        wordWrap: 'on',
                        automaticLayout: true,
                        scrollBeyondLastLine: false,
                        lineNumbers: 'on',
                        glyphMargin: false,
                        folding: true,
                        lineDecorationsWidth: 0,
                        lineNumbersMinChars: 0,
                        insertSpaces: true,
                        tabSize: 2,
                        detectIndentation: false,
                        trimAutoWhitespace: false,
                    }}
                />
            </Box>

            <Box className={styles.editorStatusBar}>
                {parseError ? (
                    <Typography variant="caption" className={styles.editorErrorText}>
                        {parseError.line ? `Line ${parseError.line}: ` : ''}{parseError.message}
                    </Typography>
                ) : (
                    <Typography variant="caption" className={styles.editorStatusText}>
                        {statusMessage || `${rawText.length} 文字 | UTF-8 | Schema Validated`}
                    </Typography>
                )}
            </Box>
        </Box>
    );
};
