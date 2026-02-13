/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */
import * as pdfjsLib from 'pdfjs-dist';
// ワーカソースの定義 - Viteでは慎重に扱う必要があります。
// 今のところ標準的なインポートが機能すると仮定するか、CDNやローカルファイルを指す必要があるかもしれません。
// 通常: pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
// または、可能であればワーカーのエントリーポイントをインポートする方が良いですが、開発用には明示的なCDNが最も安全な場合が多いです。
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { DEFAULT_RESUME, type ResumeConfig, type HistoryItem } from '../types/resume';

/**
 * テキストデータをResumeConfigにマッピングする（簡易実装）
 * 現状は抽出したテキストをすべて「備考」欄に追記するのみ。
 * @param text抽出されたテキスト
 * @returns マッピングされたResumeConfig
 */
const mapTextToResume = (text: string): ResumeConfig => {
    const config = { ...DEFAULT_RESUME };
    config.remarks = `【Imported extracted text】\n${text}\n\n` + config.remarks;
    return config;
};

/**
 * ファイルを読み込み、テキストデータまたはResumeConfigオブジェクトに変換する
 * @param file アップロードされたファイル (JSON, YAML, PDF, Excel, Word)
 * @returns 解析されたテキストまたはResumeConfigオブジェクト
 */
export const parseFile = async (file: File): Promise<string | ResumeConfig> => {
    const extension = file.name.split('.').pop()?.toLowerCase();

    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        if (extension === 'json' || extension === 'yaml' || extension === 'yml') {
            reader.onload = (e) => {
                resolve(e.target?.result as string);
            };
            reader.readAsText(file);
        }
        else if (extension === 'pdf') {
            reader.onload = async (e) => {
                try {
                    if (!e.target?.result) return;
                    const typedarray = new Uint8Array(e.target.result as ArrayBuffer);
                    const pdf = await pdfjsLib.getDocument(typedarray).promise;
                    let fullText = '';

                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const strings = textContent.items.map((item: any) => item.str);
                        fullText += strings.join(' ') + '\n';
                    }
                    resolve(mapTextToResume(fullText));
                } catch (err) {
                    reject(err);
                }
            };
            reader.readAsArrayBuffer(file);
        }
        else if (extension === 'xlsx' || extension === 'xls') {
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    let fullText = '';
                    workbook.SheetNames.forEach(sheetName => {
                        const sheet = workbook.Sheets[sheetName];
                        fullText += XLSX.utils.sheet_to_txt(sheet) + '\n';
                    });
                    resolve(mapTextToResume(fullText));
                } catch (err) {
                    reject(err);
                }
            };
            reader.readAsArrayBuffer(file);
        }
        else if (extension === 'docx') {
            reader.onload = async (e) => {
                try {
                    const arrayBuffer = e.target?.result as ArrayBuffer;
                    const result = await mammoth.extractRawText({ arrayBuffer });
                    resolve(mapTextToResume(result.value));
                } catch (err) {
                    reject(err);
                }
            };
            reader.readAsArrayBuffer(file);
        }
        else {
            reject(new Error('Unsupported file format'));
        }
    });
};



/**
 * 文字列またはオブジェクトを受け取り、HistoryItem型のオブジェクトに正規化する
 * スラッシュ区切りの文字列を解析し、要素数に応じてフィールドを割り当てる
 * @param item 文字列またはHistoryItemの一部
 * @returns 正規化されたHistoryItem
 */
const normalizeHistoryItem = (item: string | Partial<HistoryItem>): HistoryItem => {
    if (typeof item !== 'string') {
        if (typeof item === 'object' && item !== null) {
            return {
                id: (item as HistoryItem).id || crypto.randomUUID(),
                ...item
            } as HistoryItem;
        }
        return { id: crypto.randomUUID(), content: String(item) } as HistoryItem;
    }

    const parts = item.split('/').map(p => p.trim());
    const result: HistoryItem = {
        id: crypto.randomUUID(),
        content: ''
    };

    // 要素数に応じたマッピング
    // 1: 内容
    // 2: 年, 内容
    // 3: 年, 月, 内容
    // 4: 年, 月, 日, 内容
    // 5: 年, 月, 日, 曜日, 内容
    switch (parts.length) {
        case 1:
            result.content = parts[0];
            break;
        case 2:
            result.year = parts[0];
            result.content = parts[1];
            break;
        case 3:
            result.year = parts[0];
            result.month = parts[1];
            result.content = parts[2];
            break;
        case 4:
            result.year = parts[0];
            result.month = parts[1];
            result.day = parts[2];
            result.content = parts[3];
            break;
        case 5:
        default:
            result.year = parts[0];
            result.month = parts[1];
            result.day = parts[2];
            result.dow = parts[3];
            result.content = parts[4];
            break;
    }

    return result;
};

/**
 * 履歴書データ全体のリスト項目（学歴・職歴・資格）を正規化する
 * 各項目が文字列の場合は構造化オブジェクトに変換し、IDを付与する。
 * @param data 部分的なResumeConfigデータ
 * @returns 正規化されたResumeConfig
 */
export const normalizeResumeData = (data: Partial<ResumeConfig>): ResumeConfig => {
    if (!data || typeof data !== 'object') return data as ResumeConfig;

    const listKeys: (keyof ResumeConfig)[] = ['education', 'work_experience', 'certificates'];
    const result = { ...data } as Record<string, unknown>;

    listKeys.forEach(key => {
        const val = result[key];
        if (Array.isArray(val)) {
            result[key] = val.map((item: unknown) => normalizeHistoryItem(item as string | Partial<HistoryItem>));
        }
    });

    return result as unknown as ResumeConfig;
};
