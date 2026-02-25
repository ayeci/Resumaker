/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */

import React from 'react';
import { Box, Typography, Paper, createTheme, ThemeProvider } from '@mui/material';
import clsx from 'clsx';
import type { ResumeConfig, ExportOptions, HistoryItem } from '../types/resume';
import { formatDob, formatDate } from '../utils/date';
import { buildCombinedHistory } from '../utils/history';
import styles from './StandardPreview.module.scss';

// 標準テンプレート時のA4用紙設定
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
const PAGE_MARGIN_MM = 10;
const MM_TO_PX = 3.78;
const CONTENT_HEIGHT_PX = (A4_HEIGHT_MM - (PAGE_MARGIN_MM * 2)) * MM_TO_PX - 140;

// 標準テンプレート時の各ブロックの描画高さ (px)
const H_HEADER = 35;
const H_BASIC_INFO = 240;
const H_TABLE_HEADER = 32;
const H_TABLE_ROW = 30;
const H_DIVIDER = 20;
const H_MOTIVATION = 160;
const H_REQUESTS = 140;
const H_COMMUTE = 140;
const H_GAP = 10;

type RenderBlock = {
    id: string;
    height: number;
    content: React.ReactNode;
};

const theme = createTheme({
    typography: {
        fontFamily: '"Noto Serif JP", serif',
        body1: { fontSize: '12px', lineHeight: 1.2 },
        h1: { fontSize: '24px', fontWeight: 700, lineHeight: 1.2 },
        h2: { fontSize: '18px', fontWeight: 700, lineHeight: 1.2 },
        h3: { fontSize: '14px', fontWeight: 700, lineHeight: 1.2 },
    },
});

const HistoryRow = ({ item }: { item: HistoryItem }) => (
    <Box className={styles.historyRow}>
        <Box className={styles.cellYear}>{item.year}</Box>
        <Box className={styles.cellMonth}>{item.month}</Box>
        <Box
            className={clsx(styles.cellContent, {
                [styles.flexCenter]: item.content_align === 'center',
                [styles.flexEnd]: item.content_align === 'right',
                [styles.flexStart]: !item.content_align || item.content_align === 'left'
            })}
        >
            {item.content}
        </Box>
    </Box>
);

const HistoryHeaderBox = ({ title }: { title: string }) => (
    <Box className={styles.historyHeader}>
        <Box className={styles.cellYear}>年</Box>
        <Box className={styles.cellMonth}>月</Box>
        <Box className={clsx(styles.cellContent, styles.flexCenter)}>{title}</Box>
    </Box>
);

interface StandardPreviewProps {
    resume: ResumeConfig;
    exportOptions: ExportOptions;
    onSizeChange?: (size: { fitWidth: number; fitHeight: number; totalWidth: number; totalHeight: number }) => void;
}

const StandardPreview: React.FC<StandardPreviewProps> = ({ resume, exportOptions, onSizeChange }) => {
    const historyItems = React.useMemo(() => {
        const list = buildCombinedHistory(resume, exportOptions);
        while (list.length < 19) {
            list.push({ id: `empty-history-${list.length}`, year: '', month: '', content: '' });
        }
        return list;
    }, [resume, exportOptions]);

    const certificateItems = React.useMemo(() => {
        const list: HistoryItem[] = [...resume.certificates];
        if (list.length > 0 && exportOptions.isCertificateEndMarker) {
            list.push({ id: 'certificate-end', content: '以上', content_align: 'right' });
        } else if (list.length === 0) {
            list.push({ id: 'certificate-empty', content: '特になし' });
        }
        while (list.length < 10) {
            list.push({ id: `empty-certificate-${list.length}`, year: '', month: '', content: '' });
        }
        return list;
    }, [resume.certificates, exportOptions.isCertificateEndMarker]);

    const allBlocks: RenderBlock[] = [
        {
            id: 'header', height: H_HEADER, content: (
                <Box className={styles.headerBox}>
                    <Typography variant="h1" className={styles.letterSpacingWide}>履歴書</Typography>
                    <Typography variant="body2">
                        {resume.updated ? formatDate(resume.updated) : new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })} 現在
                    </Typography>
                </Box>
            )
        },
        {
            id: 'basic-info', height: H_BASIC_INFO, content: (
                <Box className={styles.basicInfo}>
                    <Box className={styles.row}>
                        <Box className={styles.mainCol}>
                            <Box className={styles.kanaRow}>
                                <Typography className={styles.label}>ふりがな</Typography>
                                <Typography className={styles.value}>{resume.name_kana}</Typography>
                            </Box>
                            <Box className={styles.nameRow}>
                                <Typography className={styles.label}>氏 名</Typography>
                                <Typography className={styles.value}>{resume.name}</Typography>
                            </Box>
                        </Box>
                        <Box className={styles.photoBox}>
                            {resume.portrait ? (
                                <img src={resume.portrait} alt="証明写真" className={styles.portraitImg} />
                            ) : (
                                <>写真は貼付<br />(任意)</>
                            )}
                        </Box>
                    </Box>
                    <Box className={styles.dobBox}>
                        <Box className={styles.dobRow}>
                            <Box className={styles.label}>生年月日</Box>
                            <Box className={styles.valDob}>{exportOptions.hasDobAge ? formatDob(resume.dob) : formatDate(resume.dob)}</Box>
                        </Box>
                        <Box className={styles.genderRow}>
                            <Box className={styles.label}>性別</Box>
                            <Box className={styles.valGender}>{resume.gender}</Box>
                        </Box>
                    </Box>
                    <Box className={styles.addressBox}>
                        <Box className={styles.kanaRow}>
                            <Box className={styles.label}>ふりがな</Box>
                            <Box className={styles.value}>{resume.address_kana}</Box>
                        </Box>
                        <Box className={styles.mainRow}>
                            <Box className={styles.label}>現住所</Box>
                            <Box className={clsx(styles.value, styles.addressCol)}>
                                <Typography className={styles.addressZip}>〒 {resume.zip}</Typography>
                                <Typography className={styles.addressText}>{resume.address}</Typography>
                            </Box>
                        </Box>
                    </Box>
                    <Box className={styles.contactBox}>
                        <Box className={styles.col}>
                            <Box className={styles.row}>
                                <Box className={styles.label}>電話</Box>
                                <Box className={styles.value}>{resume.tel}</Box>
                            </Box>
                            <Box className={styles.rowLast}>
                                <Box className={styles.label}>携帯</Box>
                                <Box className={styles.value}>{resume.tel_mobile}</Box>
                            </Box>
                        </Box>
                        <Box className={styles.col}>
                            <Box className={styles.rowEmail}>
                                <Box className={styles.labelEmail}>Email</Box>
                                <Box className={styles.valueEmail}>{resume.email}</Box>
                            </Box>
                        </Box>
                    </Box>
                </Box>
            )
        },
        { id: 'gap-basic-history', height: H_GAP, content: <Box style={{ height: H_GAP }} /> },
        { id: 'history-header', height: H_TABLE_HEADER, content: <HistoryHeaderBox title="学歴・職歴" /> },
        ...historyItems.map((item, idx) => ({ id: `history-row-${idx}`, height: H_TABLE_ROW, content: <HistoryRow item={item} /> })),
        { id: 'history-close', height: H_DIVIDER, content: <Box className={styles.borderTopThick} /> },
        { id: 'certificate-header', height: H_TABLE_HEADER, content: <HistoryHeaderBox title="免許・資格" /> },
        ...certificateItems.map((item, idx) => ({ id: `certificate-row-${idx}`, height: H_TABLE_ROW, content: <HistoryRow item={item} /> })),
        { id: 'certificate-close', height: H_DIVIDER, content: <Box className={styles.borderTopThin} /> },
        {
            id: 'motivation', height: H_MOTIVATION, content: (
                <Box className={styles.motivationBox}>
                    <Typography className={styles.boxTitle}>志望の動機、特技、好きな学科、アピールポイントなど</Typography>
                    <Typography className={styles.boxContent}>{resume.motivation}</Typography>
                    <Typography className={styles.boxTitle}>趣味・特技など</Typography>
                    <Typography className={styles.boxContent}>{resume.skills}</Typography>
                </Box>
            )
        },
        { id: 'gap-motivation-requests', height: H_GAP, content: <Box style={{ height: H_GAP }} /> },
        {
            id: 'requests', height: H_REQUESTS, content: (
                <Box className={styles.requestsBox}>
                    <Typography className={styles.boxTitle}>本人希望記入欄</Typography>
                    <Typography className={styles.boxContent}>{resume.requests || "貴社の規定に従います。"}</Typography>
                </Box>
            )
        },
        { id: 'gap-requests-commute', height: H_GAP, content: <Box style={{ height: H_GAP }} /> },
        {
            id: 'commute', height: H_COMMUTE, content: (
                <Box className={styles.commuteBox}>
                    <Box className={styles.timeCol}>
                        <Typography className={styles.boxTitle}>通勤時間</Typography>
                        <Typography className={styles.boxContent}>{resume.commute_time}</Typography>
                    </Box>
                    <Box className={styles.infoCol}>
                        <Box className={styles.familyRow}>
                            <Box className={styles.half}>
                                <Typography className={styles.label}>扶養家族数</Typography>
                                <Typography className={styles.value}>{resume.number_of_dependents || 0} 人</Typography>
                            </Box>
                            <Box className={styles.half}>
                                <Typography className={styles.label}>配偶者</Typography>
                                <Typography className={styles.value}>{resume.spouse || "なし"}</Typography>
                            </Box>
                        </Box>
                        <Box className={styles.remarks}>
                            <Typography className={styles.label}>備考</Typography>
                            <Typography className={styles.value}>{resume.remarks || "特になし"}</Typography>
                        </Box>
                    </Box>
                </Box>
            )
        }
    ];

    const pages: RenderBlock[][] = [];
    let currentPage: RenderBlock[] = [];
    let currentHeight = 0;

    allBlocks.forEach(block => {
        if (currentHeight + block.height > CONTENT_HEIGHT_PX) {
            pages.push(currentPage);
            currentPage = [];
            currentHeight = 0;
        }
        currentPage.push(block);
        currentHeight += block.height;
    });
    if (currentPage.length > 0) pages.push(currentPage);

    // サイズが確定したら親に通知
    React.useEffect(() => {
        if (onSizeChange) {
            const fitWidth = A4_WIDTH_MM * MM_TO_PX;
            const fitHeight = A4_HEIGHT_MM * MM_TO_PX;
            onSizeChange({
                fitWidth,
                fitHeight,
                totalWidth: fitWidth,
                totalHeight: fitHeight * pages.length + (pages.length - 1) * 32 // ページ間の余白(2rem相当)を考慮
            });
        }
    }, [pages.length, onSizeChange]);

    return (
        <ThemeProvider theme={theme}>
            <Box className="standard-preview-root" sx={{ display: 'flex', flexDirection: 'column', gap: '2rem', overflow: 'visible' }}>
                {pages.map((pageBlocks, pgIdx) => (
                    <Paper key={`page-${pgIdx}`} elevation={3} className={styles.sheet}>
                        {pageBlocks.map(block => (
                            <React.Fragment key={block.id}>{block.content}</React.Fragment>
                        ))}
                    </Paper>
                ))}
            </Box>
        </ThemeProvider>
    );
};

export default StandardPreview;
