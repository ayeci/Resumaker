/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */

import React, { useEffect } from 'react';

import NumberSpinner from './NumberSpinner';
import { Box, Typography, IconButton, Checkbox, Divider } from '@mui/material';
import { X, Printer, Download, LayoutTemplate, Upload, Settings, Shield, AlignLeft, FileSymlink, Type, Trash2 } from 'lucide-react';
import { FaGithub } from "react-icons/fa";
import { useResume } from '../context/ResumeHooks';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import styles from './MobileMenu.module.scss';
import clsx from 'clsx';

interface MobileMenuProps {
    onClose: () => void;
    onPrint: () => void;
    onExport: (format: 'template' | 'jsonc' | 'yaml') => void;
    onImport: () => void;
    onLoadTemplate: () => void;
    onOpenSettings: () => void;
    editorFontSize: number;
    setEditorFontSize: (size: number) => void;
}

export const MobileMenu: React.FC<MobileMenuProps> = ({
    onClose,
    onPrint,
    onExport,
    onImport,
    onLoadTemplate,
    onOpenSettings,
    editorFontSize,
    setEditorFontSize
}) => {
    const {
        templates,
        toggleTemplateCheck,
        setSelectedTemplateId,
        setPreviewMode,
        removeTemplate,
        mode,
        setMode,
        reformat,
        resetToSample,
        flushCount
    } = useResume();

    useEffect(() => {
        // flushCount が変わるたびにここが走るが、何もしなくても
        // 「依存配列に入っている」ことで React が再レンダリングを検討します
        console.log("Templates updated, flushing menu...");
    }, [flushCount, templates]);

    const handleFormat = async () => {
        await reformat();
    };

    const handleReload = () => {
        if (window.confirm('現在の内容を破棄してサンプルデータを読み直しますか？')) {
            resetToSample();
        }
    };

    return (
        <Box className={styles.menuOverlay} onClick={onClose}>
            <Box className={styles.menuContent} onClick={(e) => e.stopPropagation()}>
                <Box className={styles.menuHeader}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#111827' }}>メニュー</Typography>
                    <IconButton onClick={onClose} size="small" sx={{ color: '#374151' }}>
                        <X size={24} />
                    </IconButton>
                </Box>

                {/* 1. エディタ操作（新規追加・統合） */}
                <Box className={clsx(styles.menuGroup, styles.editorSection)}>
                    <Box className={styles.modeToggleContainer}>
                        <ToggleButtonGroup
                            value={mode}
                            exclusive
                            onChange={(_, newMode) => newMode && setMode(newMode)}
                            size="small"
                            fullWidth
                        >
                            <ToggleButton value="yaml">YAML</ToggleButton>
                            <ToggleButton value="jsonc">JSONC</ToggleButton>
                        </ToggleButtonGroup>
                    </Box>

                    {/* 2. 文字サイズ変更 */}
                    <Box className={styles.menuItem} sx={{ cursor: 'default' }}>
                        <Type size={20} />
                        <Typography className={styles.menuLabel}>文字サイズ</Typography>
                        <NumberSpinner
                            value={editorFontSize}
                            onValueChange={(val) => {
                                if (val !== null) setEditorFontSize(val);
                            }}
                            min={10}
                            max={30}
                            step={1}
                            size="small"
                            aria-label="文字サイズ"
                        />
                    </Box>

                    {/* 3. データ整形 */}
                    <Box className={styles.menuItem} onClick={() => { handleFormat(); onClose(); }}>
                        <AlignLeft size={20} />
                        <Typography className={styles.menuLabel}>データ整形</Typography>
                    </Box>

                    {/* 4. データ読込 */}
                    <Box className={styles.menuItem} onClick={() => { onImport(); onClose(); }}>
                        <Upload size={20} />
                        <Typography className={styles.menuLabel}>履歴データを開く</Typography>
                    </Box>

                    {/* 5. サンプルデータ再読込 */}
                    <Box className={styles.menuItem} onClick={() => { handleReload(); onClose(); }}>
                        <FileSymlink size={20} />
                        <Typography className={styles.menuLabel}>サンプルデータ再読込</Typography>
                    </Box>

                    {/* 6. テンプレート読込 */}
                    <Divider className={styles.divider} />
                    <Box className={styles.menuItem} onClick={() => { onLoadTemplate(); onClose(); }}>
                        <LayoutTemplate size={20} />
                        <Typography className={styles.menuLabel}>テンプレートを開く</Typography>
                    </Box>

                    {/* 7. 設定・表示切り替え（オプション系） */}
                    <Box className={styles.menuItem} onClick={() => { onOpenSettings(); onClose(); }}>
                        <Settings size={20} />
                        <Typography className={styles.menuLabel}>テンプレート設定</Typography>
                    </Box>
                </Box>

                <Divider className={styles.divider} />

                {/* 8. 出力 */}
                <Box className={clsx(styles.menuGroup, styles.actionGroup)}>
                    <Box className={styles.menuItem} onClick={() => { onPrint(); onClose(); }}>
                        <Printer size={20} />
                        <Typography className={styles.menuLabel}>PDF保存 / 印刷</Typography>
                    </Box>
                    <Box className={styles.menuItem} onClick={() => { onExport('template'); onClose(); }}>
                        <Download size={20} />
                        <Typography className={styles.menuLabel}>テンプレート形式で保存</Typography>
                    </Box>
                    <Box className={styles.menuItem} onClick={() => { onExport(mode); onClose(); }}>
                        <Download size={20} />
                        <Typography className={styles.menuLabel}>履歴データを保存</Typography>
                    </Box>
                </Box>

                <Divider className={styles.divider} />

                {/* 9. 各テンプレートの表示・出力切り替え */}
                <Box className={styles.menuGroup}>
                    <Typography variant="caption" sx={{ px: 2, py: 1, display: 'block', color: '#6b7280', fontWeight: 600 }}>
                        テンプレート選択
                    </Typography>
                    {templates && templates.length > 0 ? templates.map((t) => (
                        <Box key={t.id} className={styles.menuItem} sx={{ pr: 1 }}>
                            <Checkbox
                                checked={t.checked}
                                size="small"
                                className={styles.checkbox}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleTemplateCheck(t.id);
                                }}
                            />
                            <Typography
                                className={styles.menuLabel}
                                sx={{ color: '#374151', flexGrow: 1, cursor: 'pointer' }}
                                onClick={() => {
                                    setSelectedTemplateId(t.id);
                                    setPreviewMode('template');
                                    onClose();
                                }}
                            >
                                {t.name}
                            </Typography>
                            <IconButton
                                size="small"
                                color="error"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeTemplate(t.id);
                                }}
                            >
                                <Trash2 size={18} />
                            </IconButton>
                        </Box>
                    )) : (
                        <Typography variant="body2" sx={{ px: 2, py: 1, color: '#9ca3af', fontStyle: 'italic' }}>
                            テンプレートが読み込まれていません
                        </Typography>
                    )}
                </Box>

                {/* 10. アプリ情報 */}
                <Box className={styles.footerInfo}>
                    <Box className={styles.appName}>
                        <img src={import.meta.env.BASE_URL + 'favicon.svg'} title="Resumaker logo" alt="Resumaker logo" className={styles.logoBefore} />
                        <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
                            <span className={styles.logoPrimary}>Resu</span>
                            <span className={styles.logoSecondary}>maker</span>
                        </Typography>
                    </Box>
                    <Box className={styles.footerLinks}>
                        <a href="https://github.com/ayeci/Resumaker" target="_blank" rel="noopener noreferrer">
                            <FaGithub size={16} />
                            <span>GitHub</span>
                        </a>
                        <a href="https://github.com/ayeci/Resumaker/blob/main/PRIVACY.md" target="_blank" rel="noopener noreferrer">
                            <Shield size={16} />
                            <span>Privacy Policy</span>
                        </a>
                    </Box>
                    <Typography className={styles.credit}>© 2026 ayeci</Typography>

                    <Divider className={styles.divider} />

                    <Box className={styles.footerLinks}>
                        <a href="https://github.com/ayeci/Resumaker/raw/refs/heads/main/example/sample.zip" target="_blank" rel="noopener noreferrer">
                            <Download size={16} />
                            <span>サンプルファイルをダウンロード</span>
                        </a>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};