/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */
import React, { useRef, type ChangeEvent } from 'react';
import { Box, Avatar, IconButton, Tooltip, Typography } from '@mui/material';
import { Camera, X } from 'lucide-react';
import { useResume } from '../context/ResumeHooks';
import styles from './PortraitUpload.module.scss';
import clsx from 'clsx';

interface PortraitUploadProps {
    variant?: 'icon' | 'tab';
}

/**
 * 証明写真のアップロード・表示・削除ロジックをカプセル化した共通コンポーネント
 */
export const PortraitUpload: React.FC<PortraitUploadProps> = ({ variant = 'icon' }) => {
    const { resume, setPortraitFile } = useResume();
    const inputRef = useRef<HTMLInputElement>(null);

    const onTrigger = () => {
        if (inputRef.current) {
            inputRef.current.click();
        }
    };

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPortraitFile(file);
        }
        e.target.value = '';
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        setPortraitFile(null);
    };

    const isTab = variant === 'tab';

    return (
        <Box className={clsx(styles.portraitContainer, isTab && styles.tabVariant)}>
            {resume.portrait ? (
                <Box className={styles.portraitWrapper}>
                    <Avatar
                        src={resume.portrait}
                        variant="rounded"
                        className={clsx(styles.portraitAvatar, isTab && styles.tabAvatar)}
                        onClick={onTrigger}
                    />
                    <IconButton
                        size="small"
                        className={styles.portraitDeleteBtn}
                        onClick={handleDelete}
                        title="写真を削除"
                    >
                        <X size={12} />
                    </IconButton>
                    {isTab && <Typography variant="caption" className={styles.tabLabel}>写真</Typography>}
                </Box>
            ) : (
                <Box
                    className={clsx(isTab ? styles.mobileTabItem : styles.iconBtnWrapper)}
                    onClick={onTrigger}
                >
                    {isTab ? (
                        <>
                            <Camera size={24} />
                            <Typography variant="caption" className={styles.tabLabel}>写真</Typography>
                        </>
                    ) : (
                        <Tooltip title="写真をアップロード">
                            <IconButton size="small" className={styles.toolbarIconBtn}>
                                <Camera size={18} />
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>
            )}
            <input
                type="file"
                ref={inputRef}
                className={styles.hiddenInput}
                accept="image/*"
                onChange={handleChange}
                title="証明写真をアップロード"
            />
        </Box>
    );
};
