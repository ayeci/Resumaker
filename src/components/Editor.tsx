import { useRef, type ChangeEvent } from 'react';
import Editor from '@monaco-editor/react';
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
    X
} from 'lucide-react';
import { useResume } from '../context/ResumeHooks';
import styles from './Editor.module.scss';

/**
 * JSON/YAML形式での直接編集、ファイルインポート、証明写真のアップロード機能を提供する
 */
export const ResumeEditor = () => {
    const { resume, setResume, mode, setMode, rawText, setRawText, setPortraitFile } = useResume();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const portraitInputRef = useRef<HTMLInputElement>(null);

    const handleEditorChange = (value: string | undefined) => {
        setRawText(value || '');
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
                </Box>
            </Box>

            <Box className={styles.editorTextareaContainer}>
                <Editor
                    height="100%"
                    defaultLanguage="yaml"
                    language={mode}
                    value={rawText}
                    onChange={handleEditorChange}
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
                    }}
                />
            </Box>

            <Box className={styles.editorStatusBar}>
                <Typography variant="caption" className={styles.editorStatusText}>
                    {rawText.length} 文字 | UTF-8
                </Typography>
            </Box>

            <input
                type="file"
                ref={fileInputRef}
                className={styles.hiddenInput}
                title="対象のファイル"
                accept=".json"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            try {
                                const json = JSON.parse(event.target?.result as string);
                                setResume(json);
                            } catch {
                                alert('不正なJSONファイルです');
                            }
                        };
                        reader.readAsText(file);
                    }
                }}
            />
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
