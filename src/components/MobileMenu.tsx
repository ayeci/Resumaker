/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */
import React from 'react';
import { Box, Typography, IconButton, Checkbox, Divider } from '@mui/material';
import { X, Printer, Download, FileText, LayoutTemplate, Upload, Settings, Github, Shield, AlignLeft, FileSymlink } from 'lucide-react';
import { useResume } from '../context/ResumeHooks';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import styles from './MobileMenu.module.scss';
import clsx from 'clsx';

interface MobileMenuProps {
    onClose: () => void;
    onPrint: () => void;
    onExport: (format: 'template' | 'json' | 'yaml') => void;
    onImport: () => void;
    onLoadTemplate: () => void;
    onOpenSettings: () => void;
}

export const MobileMenu: React.FC<MobileMenuProps> = ({
    onClose,
    onPrint,
    onExport,
    onImport,
    onLoadTemplate,
    onOpenSettings
}) => {
    const {
        templates,
        previewMode,
        setPreviewMode,
        toggleTemplateCheck,
        mode,
        setMode,
        reformat,
        resetToSample
    } = useResume();

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
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>メニュー</Typography>
                    <IconButton onClick={onClose} size="small">
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
                            <ToggleButton value="json">JSON</ToggleButton>
                        </ToggleButtonGroup>
                    </Box>

                    <Box className={styles.menuItem} onClick={() => { handleFormat(); onClose(); }}>
                        <AlignLeft size={20} />
                        <Typography className={styles.menuLabel}>データ整形</Typography>
                    </Box>

                    <Box className={styles.menuItem} onClick={() => { handleReload(); onClose(); }}>
                        <FileSymlink size={20} />
                        <Typography className={styles.menuLabel}>サンプルデータ再読込</Typography>
                    </Box>
                </Box>

                <Divider className={styles.divider} />

                {/* 2. 出力・インポート */}
                <Box className={clsx(styles.menuGroup, styles.actionGroup)}>
                    <Box className={styles.menuItem} onClick={() => { onPrint(); onClose(); }}>
                        <Printer size={20} />
                        <Typography className={styles.menuLabel}>PDF保存 / 印刷</Typography>
                    </Box>
                    <Box className={styles.menuItem} onClick={() => { onExport('template'); onClose(); }}>
                        <Download size={20} />
                        <Typography className={styles.menuLabel}>テンプレート形式で保存</Typography>
                    </Box>

                    <Box className={styles.menuItem} onClick={() => { onExport('yaml'); onClose(); }}>
                        <Download size={20} />
                        <Typography className={styles.menuLabel}>YAMLで保存</Typography>
                    </Box>
                    <Box className={styles.menuItem} onClick={() => { onExport('json'); onClose(); }}>
                        <Download size={20} />
                        <Typography className={styles.menuLabel}>JSONで保存</Typography>
                    </Box>

                    <Box className={styles.menuItem} onClick={() => { onImport(); onClose(); }}>
                        <Upload size={20} />
                        <Typography className={styles.menuLabel}>データ読み込み</Typography>
                    </Box>

                    <Box className={styles.menuItem} onClick={() => { onLoadTemplate(); onClose(); }}>
                        <LayoutTemplate size={20} />
                        <Typography className={styles.menuLabel}>テンプレート読込</Typography>
                    </Box>
                </Box>

                <Divider className={styles.divider} />

                {/* 2. 設定・表示切り替え（オプション系） */}
                <Box className={clsx(styles.menuGroup, styles.settingsGroup)}>
                    <Box className={styles.menuItem} onClick={() => { onOpenSettings(); onClose(); }}>
                        <Settings size={20} />
                        <Typography className={styles.menuLabel}>テンプレート設定</Typography>
                    </Box>

                    <Box className={styles.menuItem} onClick={() => setPreviewMode(previewMode === 'standard' ? 'template' : 'standard')}>
                        {previewMode === 'standard' ? <LayoutTemplate size={20} /> : <FileText size={20} />}
                        <Typography className={styles.menuLabel}>
                            {previewMode === 'standard' ? 'テンプレート表示へ' : '標準表示へ'}
                        </Typography>
                    </Box>
                </Box>

                <Divider className={styles.divider} />

                {/* 3. 各テンプレートの表示・出力切り替え */}
                <Box className={styles.menuGroup}>
                    <Typography variant="caption" sx={{ px: 2, py: 1, display: 'block', color: '#6b7280' }}>
                        テンプレート選択
                    </Typography>
                    {templates.map((t) => (
                        <Box key={t.id} className={styles.menuItem} onClick={() => toggleTemplateCheck(t.id)}>
                            <Checkbox checked={t.checked} size="small" className={styles.checkbox} />
                            <Typography className={styles.menuLabel}>{t.name}</Typography>
                        </Box>
                    ))}
                </Box>

                {/* 4. アプリ情報 */}
                <Box className={styles.footerInfo}>
                    <Box className={styles.appName}>
                        <LayoutTemplate size={24} className={styles.logoPrimary} />
                        <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
                            <span className={styles.logoPrimary}>Resu</span>
                            <span className={styles.logoSecondary}>maker</span>
                        </Typography>
                    </Box>
                    <Box className={styles.footerLinks}>
                        <a href="https://github.com/AyeBee/Resumaker" target="_blank" rel="noopener noreferrer">
                            <Github size={16} />
                            <span>GitHub</span>
                        </a>
                        <a href="/PRIVACY.md" target="_blank" rel="noopener noreferrer">
                            <Shield size={16} />
                            <span>Privacy Policy</span>
                        </a>
                    </Box>
                    <Typography className={styles.credit}>© 2026 ayeci</Typography>
                </Box>
            </Box>
        </Box>
    );
};
