/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */
import { useRef, useState } from 'react';
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
    FileCode,
    AlignLeft,
    FileSymlink
} from 'lucide-react';
import { useResume } from '../context/ResumeHooks';
import { PortraitUpload } from './PortraitUpload';
import styles from './Editor.module.scss';
import { resumeSchema } from '../constants/resumeSchema';
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

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

/**
 * JSON/YAML形式での直接編集、ファイルインポート、証明写真のアップロード機能を提供する
 */
export const ResumeEditor = () => {
    const { mode, setMode, rawText, setRawText, parseError, resetToSample, reformat } = useResume();

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

    const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
        editorRef.current = editor;
    };

    /**
     * エディタの内容を手動でフォーマット（整形）する
     */
    const handleFormat = async () => {
        // コンテキストの整形関数を使用（エディタインスタンス外からの呼び出しにも対応）
        await reformat();
        setStatusMessage('整形完了');
        setTimeout(() => setStatusMessage(null), 2000);
    };

    return (
        <Box className={styles.editorRoot}>
            {!isMobile && (
                <Box className={styles.editorToolbar}>
                    <Box className={styles.editorLabelSection}>
                        <FileCode size={18} color="#64748b" />
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
                    <Box className={styles.toolbarActions}>
                        <Tooltip title="データ整形">
                            <IconButton size="small" onClick={handleFormat} className={styles.toolbarIconBtn}>
                                <AlignLeft size={18} />
                            </IconButton>
                        </Tooltip>
                        <PortraitUpload variant="icon" />
                        <Tooltip title="サンプルデータ再読込">
                            <IconButton size="small" onClick={handleReloadClick} className={styles.toolbarIconBtn}>
                                <FileSymlink size={18} />
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
                        fontSize: 14,
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
