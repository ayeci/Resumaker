/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */
import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    FormGroup,
    FormControlLabel,
    Checkbox,
    Typography,
    Box,
    Divider
} from '@mui/material';
import { useResume } from '../context/ResumeHooks';
import styles from './ExportOptionDialog.module.scss';

/**
 * エクスポートオプションダイアログのProps
 */
interface ExportOptionDialogProps {
    /** ダイアログの表示状態 */
    open: boolean;
    /** ダイアログを閉じる際のハンドラ */
    onClose: () => void;
}

/**
 * エクスポートオプション設定ダイアログ
 * 履歴末尾の「以上」の有無や、年齢の自動付与設定などを変更できる
 */
export const ExportOptionDialog: React.FC<ExportOptionDialogProps> = ({ open, onClose }) => {
    const { exportOptions, setExportOptions } = useResume();

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setExportOptions({
            ...exportOptions,
            [event.target.name]: event.target.checked,
        });
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>テンプレート設定</DialogTitle>
            <DialogContent dividers>
                <Box>
                    <Typography variant="subtitle2" color="primary" className={styles.dialogSectionTitle}>
                        履歴（学歴・職歴・資格）
                    </Typography>
                    <FormGroup>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={exportOptions.isHistoryEndMarker}
                                    onChange={handleChange}
                                    name="isHistoryEndMarker"
                                />
                            }
                            label="全体の末尾に「以上」を付ける"
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={exportOptions.isEducationEndMarker}
                                    onChange={handleChange}
                                    name="isEducationEndMarker"
                                />
                            }
                            label="学歴ブロックの末尾に「以上」を付ける"
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={exportOptions.isWorkEndMarker}
                                    onChange={handleChange}
                                    name="isWorkEndMarker"
                                />
                            }
                            label="職歴ブロックの末尾に「以上」を付ける"
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={exportOptions.isWorkCurrentMarker}
                                    onChange={handleChange}
                                    name="isWorkCurrentMarker"
                                />
                            }
                            label="職歴の末尾に「現在に至る」を付ける"
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={exportOptions.isCertificateEndMarker}
                                    onChange={handleChange}
                                    name="isCertificateEndMarker"
                                />
                            }
                            label="免許・資格の末尾に「以上」を付ける"
                        />
                    </FormGroup>
                </Box>
                <Divider sx={{ my: 2 }} />
                <Box>
                    <Typography variant="subtitle2" color="primary" className={styles.dialogSectionTitle}>
                        基本情報
                    </Typography>
                    <FormGroup>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={exportOptions.hasDobAge}
                                    onChange={handleChange}
                                    name="hasDobAge"
                                />
                            }
                            label="生年月日の後に年齢 (満X歳) を付与する"
                        />
                    </FormGroup>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="primary">
                    閉じる
                </Button>
            </DialogActions>
        </Dialog>
    );
};
