/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */
import { useRef, useState, type ChangeEvent } from 'react';
import Editor from '@monaco-editor/react';
import yaml from 'js-yaml';
import {
    Box,
    Typography,
    IconButton,
    Tooltip,
    Avatar,
    ToggleButton,
    ToggleButtonGroup
} from '@mui/material';
import {
    FileCode,
    Camera,
    X,
    AlignLeft,
    FileSymlink
} from 'lucide-react';
import { useResume } from '../context/ResumeHooks';
import styles from './Editor.module.scss';
import { resumeSchema } from '../constants/resumeSchema';
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Button } from '@mui/material';

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
    const { resume, mode, setMode, rawText, setRawText, setPortraitFile, parseError, resetToSample } = useResume();
    const portraitInputRef = useRef<HTMLInputElement>(null);

    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [reloadDialogOpen, setReloadDialogOpen] = useState(false);

    const handleReloadClick = () => setReloadDialogOpen(true);
    const handleReloadConfirm = () => {
        resetToSample();
        setReloadDialogOpen(false);
    };
    const handleReloadCancel = () => setReloadDialogOpen(false);

    /**
     * エディタの内容が変更された際のハンドラ
     * ユーザー入力による変更のみをContextに反映させる。
     * プログラムによる値の注入（flush）時はState更新をスキップし、無限ループやデータ競合を防ぐ。
     */
    const handleEditorChange = (value: string | undefined, event: monaco.editor.IModelContentChangedEvent) => {
        // プログラムによる変更（isFlush）の場合は、Contextへの書き戻しを行わない
        // これにより、データロード時の意図しない上書き（キャッシュ戻り）を防ぐ
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
     * JSONモード: Monaco Editor標準のフォーマッタを使用
     * YAMLモード: js-yamlを使用してダンプし直し、スペース2つのインデントを適用する
     * （monaco-yamlのWorkerが無効化されているため、手動実装している）
     */
    const handleFormat = async () => {
        if (editorRef.current) {

            if (mode === 'yaml') {
                // monaco-yamlが無効化されているため、js-yamlを使用して手動フォーマットを行う
                try {
                    const currentValue = editorRef.current.getValue();
                    const parsed = yaml.load(currentValue, { schema: yaml.JSON_SCHEMA });
                    if (parsed) {
                        const formatted = yaml.dump(parsed, {
                            lineWidth: -1,
                            noRefs: true,
                            quotingType: '"',
                            indent: 2
                        });
                        // カーソル位置を維持しようとすると複雑になるため、単純に値を更新する
                        // pushEditOperationsを使うとUndoスタックが維持される
                        const model = editorRef.current.getModel();
                        if (model) {
                            editorRef.current.pushUndoStop();
                            editorRef.current.executeEdits('format', [{
                                range: model.getFullModelRange(),
                                text: formatted,
                                forceMoveMarkers: true
                            }]);
                            editorRef.current.pushUndoStop();
                        }
                    }
                } catch (e) {
                    console.error('YAML Format failed:', e);
                    setStatusMessage('Format Failed');
                    setTimeout(() => setStatusMessage(null), 2000);
                    return;
                }
            } else {
                // JSONの場合は組み込みのFormatterを使用
                await editorRef.current.getAction('editor.action.formatDocument')?.run();
            }

            setStatusMessage('Formatted');
            setTimeout(() => setStatusMessage(null), 2000);
        } else {
            console.warn('Editor instance not found');
        }
    };



    const handlePortraitClick = () => {
        portraitInputRef.current?.click();
    };

    const handlePortraitChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPortraitFile(file);
        }
        // 同じファイルを再度アップロードできるように入力をリセット
        e.target.value = '';
    };

    const handleDeletePortrait = () => {
        setPortraitFile(null);
        // inputの状態もリセットしておく
        if (portraitInputRef.current) {
            portraitInputRef.current.value = '';
        }
    };

    return (
        <Box className={styles.editorRoot}>
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
                    <Tooltip title="ドキュメントを整形">
                        <IconButton size="small" onClick={handleFormat} className={styles.toolbarIconBtn}>
                            <AlignLeft size={18} />
                        </IconButton>
                    </Tooltip>
                    <Box className={styles.portraitWrapper}>
                        {resume.portrait ? (
                            <Box sx={{ position: 'relative' }}>
                                <Avatar
                                    src={resume.portrait}
                                    variant="rounded"
                                    className={styles.portraitAvatar}
                                    onClick={handlePortraitClick}
                                />
                                <IconButton
                                    size="small"
                                    className={styles.portraitDeleteBtn}
                                    onClick={handleDeletePortrait}
                                >
                                    <X size={10} />
                                </IconButton>
                            </Box>
                        ) : (
                            <Tooltip title="写真をアップロード">
                                <IconButton size="small" onClick={handlePortraitClick} className={styles.toolbarIconBtn}>
                                    <Camera size={18} />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Box>
                    <Tooltip title="サンプルデータの再読み込み">
                        <IconButton size="small" onClick={handleReloadClick} className={styles.toolbarIconBtn}>
                            <FileSymlink size={18} />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            <Dialog
                open={reloadDialogOpen}
                onClose={handleReloadCancel}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
            >
                <DialogTitle id="alert-dialog-title">
                    {"サンプルデータの再読み込み"}
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
                        // YAML用にスペースインデントを強制
                        insertSpaces: true,
                        tabSize: 2,
                        detectIndentation: false,
                        // 空行のインデントが削除されるのを防ぐ（マルチライン文字列対策）
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


            <input
                type="file"
                title="ポートレート写真を指定"
                ref={portraitInputRef}
                className={styles.hiddenInput}
                accept="image/*"
                onChange={handlePortraitChange}
            />
        </Box>
    );
};
