import React, { Suspense } from 'react';
import { useResume } from '../context/ResumeHooks';
import { formatDob, formatDate } from '../utils/date';
import { buildCombinedHistory } from '../utils/history';
import {
    Box,
    Typography,
    Paper,
    createTheme,
    ThemeProvider
} from '@mui/material';
import styles from './Preview.module.scss';
import clsx from 'clsx';
import WordPreview from './WordPreview';
import type { HistoryItem } from '../types/resume';

// ExcelPreviewを遅延ロード
const ExcelPreview = React.lazy(() => import('./ExcelPreview'));

// 標準テンプレート時のA4用紙設定
const A4_HEIGHT_MM = 297;
const PAGE_MARGIN_MM = 10;
const MM_TO_PX = 3.78; // 96dpiにおける1mmあたりのピクセル数 (約3.78px)
const CONTENT_HEIGHT_PX = (A4_HEIGHT_MM - (PAGE_MARGIN_MM * 2)) * MM_TO_PX - 140; // 余白調整

// 標準テンプレート時の各ブロックの描画高さ (px)
const H_HEADER = 35;
const H_BASIC_INFO = 240;
const H_TABLE_HEADER = 32;
const H_TABLE_ROW = 30; // MUIデフォルトに合わせて調整
const H_DIVIDER = 20;
const H_MOTIVATION = 160;
const H_REQUESTS = 140;
const H_COMMUTE = 140;
const H_GAP = 10;

// 描画ブロックの型定義
type RenderBlock = {
    id: string;
    height: number;
    content: React.ReactNode;
};

// 印刷用カスタムテーマ
const theme = createTheme({
    typography: {
        fontFamily: '"Noto Serif JP", serif',
        body1: {
            fontSize: '12px', // 標準テキストサイズ
            lineHeight: 1.2,
        },
        h1: {
            fontSize: '24px',
            fontWeight: 700,
            lineHeight: 1.2,
        },
        h2: {
            fontSize: '18px',
            fontWeight: 700,
            lineHeight: 1.2,
        },
        h3: {
            fontSize: '14px',
            fontWeight: 700,
            lineHeight: 1.2,
        },
    },
    components: {
        MuiTableCell: {
            styleOverrides: {
                root: {
                    padding: '4px 8px',
                    borderBottom: '1px solid black',
                    borderRight: '1px solid black',
                    '&:last-child': {
                        borderRight: 'none',
                    },
                    fontSize: '12px',
                    fontFamily: '"Noto Serif JP", serif',
                },
                head: {
                    fontWeight: 700,
                    backgroundColor: '#f3f4f6', // グレー
                    borderBottom: '1px solid black !important',
                }
            }
        },
        MuiTableContainer: {
            styleOverrides: {
                root: {
                    border: '1px solid black', // 外枠はコンテナ側で制御
                    borderRadius: 0,
                    boxShadow: 'none',
                }
            }
        }
    }
});

// -- Helper Components -- (削除)

/**
 * 履歴項目行レンダリング用コンポーネント
 * @param item 履歴項目
 */
const HistoryRow = ({ item }: { item: HistoryItem }) => (
    <Box className={styles.historyRow}>
        <Box className={styles.cellYear}>
            {item.year}
        </Box>
        <Box className={styles.cellMonth}>
            {item.month}
        </Box>
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

/**
 * 履歴項目ヘッダーレンダリング用コンポーネント
 * @param title ヘッダータイトル（学歴・職歴など）
 */
const HistoryHeaderBox = ({ title }: { title: string }) => (
    <Box className={styles.historyHeader}>
        <Box className={styles.cellYear}>年</Box>
        <Box className={styles.cellMonth}>月</Box>
        <Box className={styles.cellContent + ' ' + styles.flexCenter}>{title}</Box>
    </Box>
);


/**
 * 履歴書プレビューコンポーネント
 * 標準プレビュー（HTML/CSS）とテンプレートプレビュー（Word/Excel）の切り替え表示を行う
 * A4サイズでのページ分割（標準プレビュー時）や、Excel/WordからのHTML変換結果の表示（テンプレートプレビュー時）を担当
 */
export const Preview: React.FC = () => {
    const { resume, templates, selectedTemplateId, previewMode, exportOptions } = useResume();

    // 選択中のテンプレートを取得
    const selectedTemplate = templates.find(t => t.id === selectedTemplateId) ?? null;

    /** 学歴・職歴・各種マーカーを含む統合履歴リスト */
    const historyItems = React.useMemo(() => {
        // 共通ロジックでリストを構築
        const list = buildCombinedHistory(resume, exportOptions);

        // プレビュー用に空行を補充 (最大19行)
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

    // 描画ブロック定義
    const allBlocks: RenderBlock[] = [
        // ヘッダー
        {
            id: 'header', height: H_HEADER, content: (
                <Box className={styles.headerBox}>
                    <Typography variant="h1" className={styles.letterSpacingWide}>履歴書</Typography>
                    <Typography variant="body2">
                        {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })} 現在
                    </Typography>
                </Box>
            )
        },
        // 基本情報
        {
            id: 'basic-info', height: H_BASIC_INFO, content: (
                <Box className={styles.basicInfo}>
                    {/* 上段: 氏名と写真 */}
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
                        {/* 写真 */}
                        <Box className={styles.photoBox}>
                            {resume.portrait ? (
                                <img
                                    src={resume.portrait}
                                    alt="証明写真"
                                    className={styles.portraitImg}
                                />
                            ) : (
                                <>写真は貼付<br />(任意)</>
                            )}
                        </Box>
                    </Box>

                    {/* 生年月日と性別 */}
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

                    {/* 住所 */}
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

                    {/* 電話番号 / メールアドレス */}
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
        // 余白 (Basic - History)
        { id: 'gap-basic-history', height: H_GAP, content: <Box style={{ height: H_GAP }} /> },
        // History Header
        {
            id: 'history-header', height: H_TABLE_HEADER, content: (
                <Box className={styles.historyHeader}>
                    <Box className={styles.cellYear}>年</Box>
                    <Box className={styles.cellMonth}>月</Box>
                    <Box className={clsx(styles.cellContent, styles.flexCenter)}>学歴・職歴</Box>
                </Box>
            )
        },
        // 履歴行
        ...historyItems.map((item, idx) => ({
            id: `history-row-${idx}`,
            height: H_TABLE_ROW,
            content: <HistoryRow item={item} />
        })),
        // 履歴終了線 (太線)
        {
            id: 'history-close', height: H_DIVIDER, content: <Box className={styles.borderTopThick} />
        },
        // 資格ヘッダー
        {
            id: 'certificate-header', height: H_TABLE_HEADER, content: (
                <HistoryHeaderBox title="免許・資格" />
            )
        },
        // 資格行
        ...certificateItems.map((item, idx) => ({
            id: `certificate-row-${idx}`,
            height: H_TABLE_ROW,
            content: <HistoryRow item={item} />
        })),
        // 資格終了線 (細線/余白調整)
        {
            id: 'certificate-close', height: H_DIVIDER, content: <Box className={styles.borderTopThin} />
        },

        // 志望動機
        {
            id: 'motivation', height: H_MOTIVATION, content: (
                <Box className={styles.motivationBox}>
                    <Typography className={styles.boxTitle}>
                        志望の動機、特技、好きな学科、アピールポイントなど
                    </Typography>
                    <Typography className={styles.boxContent}>
                        {resume.motivation}
                    </Typography>
                    <Typography className={clsx(styles.boxTitle, styles.mt2)}>
                        趣味・特技など
                    </Typography>
                    <Typography className={styles.boxContent}>
                        {resume.skills}
                    </Typography>
                </Box>
            )
        },
        // 余白 (Motivation - Requests)
        { id: 'gap-motivation-requests', height: H_GAP, content: <Box style={{ height: H_GAP }} /> },
        // 本人希望記入欄
        {
            id: 'requests', height: H_REQUESTS, content: (
                <Box className={styles.requestsBox}>
                    <Typography className={styles.boxTitle}>
                        本人希望記入欄（特に給料・職種・勤務時間・勤務地・その他についての希望があれば記入）
                    </Typography>
                    <Typography className={styles.boxContent}>
                        {resume.requests || "貴社の規定に従います。"}
                    </Typography>
                </Box>
            )
        },
        // 余白 (Requests - Commute)
        { id: 'gap-requests-commute', height: H_GAP, content: <Box style={{ height: H_GAP }} /> },
        // 通勤時間・扶養家族
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
                                <Typography className={styles.value}>
                                    {resume.number_of_dependents !== undefined ? resume.number_of_dependents : 0} 人
                                </Typography>
                                <Typography className={styles.subText}>（配偶者を除く）</Typography>
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

    // ページ分割処理
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

    // テンプレートモード時の表示
    if (previewMode === 'template' && selectedTemplate) {
        if (selectedTemplate.format === 'excel') {
            return (
                <Suspense fallback={<div>Loading Excel Preview...</div>}>
                    <ExcelPreview templateBuffer={selectedTemplate.arrayBuffer} resume={resume} />
                </Suspense>
            );
        } else if (selectedTemplate.format === 'word') {
            return (
                <WordPreview templateBuffer={selectedTemplate.arrayBuffer} resume={resume} />
            );
        } else {
            return <div>サポートされていないフォーマットです</div>;
        }
    }

    // 標準プレビュー（Standard）
    return (
        <Box className={styles.wrapper} sx={{ '@media print': { boxShadow: 'none !important' } }}>
            <ThemeProvider theme={theme}>
                {pages.map((pageBlocks, pgIdx) => (
                    <Paper
                        key={`page-${pgIdx}`}
                        elevation={3}
                        className={styles.sheet}
                        sx={{
                            fontFamily: '"Noto Serif JP", serif', // フォント継承
                        }}
                    >
                        {pageBlocks.map(block => (
                            <React.Fragment key={block.id}>
                                {block.content}
                            </React.Fragment>
                        ))}
                    </Paper>
                ))}
            </ThemeProvider>
        </Box>
    );
};

