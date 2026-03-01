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
import { generateUUID } from './uuid';

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

        if (extension === 'json' || extension === 'jsonc' || extension === 'yaml' || extension === 'yml') {
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
                id: (item as HistoryItem).id || generateUUID(),
                ...item
            } as HistoryItem;
        }
        return { id: generateUUID(), content: String(item) } as HistoryItem;
    }

    // 文字列入力 → _shorthand マーカーを付与して元の形式を記憶
    // URL等が含まれる場合に全体が分割されてしまうのを防ぐため、
    // まず最初の最大4つ（年、月、日、曜日）として解釈可能な部分だけを切り出し、残りを結合するアプローチをとる。
    // 日付フィールド（年/月等）は先頭から連続している想定。
    const parts = item.split('/');

    // 日付フィールドとして解釈されるべき部分（基本的に英数字や短い文字列）を見つける
    const dateParts: string[] = [];
    const contentParts: string[] = [];

    // 'http' や 'https' が含まれている場合は特殊扱いにするか、
    // 単純に最初の数要素だけを取り出すか。
    // 現状の仕様 (年/月/内容 -> length 3等) を維持しつつ、
    // URLの ':' の後の '//' や、パスに含まれる '/' を過剰解釈しないようにする。

    // スラッシュが多い場合、最大でも最初から4要素までを「日付・曜日」候補とし、
    // 残りをすべて「content」として再結合する設計に変更。
    // （元の仕様: 1=content, 2=year/content, 3=year/month/content, 4=year/month/day/content, 5=year/month/day/dow/content）

    const maxDateFields = 4; // content より前のフィールドの最大数

    // URLっぽさ（http://）等のせいで過剰分割されている場合は後半をまとめる
    // 単一項目の場合はそのまま
    if (parts.length > 1) {
        // 先頭から順に見て「明らかに年や月ではない（長い文字列など）」が出た時点で、
        // そこから先は全てcontentとして扱う
        let contentStartIndex = 0;
        for (let i = 0; i < parts.length; i++) {
            const p = parts[i].trim();
            // 年,月,日,曜日は比較的短い (1〜10文字程度) と推測。
            // HTTPが含まれる、または長すぎる場合はcontentの始まりとみなす。
            if (i >= maxDateFields || p.length > 15 || p.startsWith('http') || p.includes('://')) {
                contentStartIndex = i;
                break;
            }
            contentStartIndex = i + 1;
        }

        // もし全部が短ければ、最後の1つをcontentとする (元の挙動通り)
        if (contentStartIndex === parts.length) {
            contentStartIndex = parts.length - 1;
        }

        // 最初の数要素を日付系として確保
        for (let i = 0; i < contentStartIndex; i++) {
            dateParts.push(parts[i].trim());
        }

        // 残りを '/' で再度結合して content とする
        const remaining = parts.slice(contentStartIndex).join('/');
        contentParts.push(remaining.trim());
    } else {
        contentParts.push(parts[0].trim());
    }

    const logicalParts = [...dateParts, ...contentParts];

    const result: HistoryItem & { _shorthand?: boolean } = {
        id: generateUUID(),
        content: '',
        _shorthand: true
    };

    // 要素数に応じたマッピング
    // 1: 内容
    // 2: 年, 内容
    // 3: 年, 月, 内容
    // 4: 年, 月, 日, 内容
    // 5: 年, 月, 日, 曜日, 内容
    switch (parts.length) {
        case 1:
            result.content = logicalParts[0];
            break;
        case 2:
            result.year = logicalParts[0];
            result.content = logicalParts[1];
            break;
        case 3:
            result.year = logicalParts[0];
            result.month = logicalParts[1];
            result.content = logicalParts[2];
            break;
        case 4:
            result.year = logicalParts[0];
            result.month = logicalParts[1];
            result.day = logicalParts[2];
            result.content = logicalParts[3];
            break;
        case 5:
        default:
            result.year = logicalParts[0];
            result.month = logicalParts[1];
            result.day = logicalParts[2];
            result.dow = logicalParts[3];
            // 5番目以降はすでにcontentに含まれるように結合済みだが、念のため
            result.content = logicalParts.slice(4).join('/');
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

    const listKeys: (keyof ResumeConfig)[] = ['education', 'work_experience', 'project', 'certificates'];
    const result = { ...data } as Record<string, unknown>;

    listKeys.forEach(key => {
        const val = result[key];
        if (Array.isArray(val)) {
            result[key] = val.map((item: unknown) => normalizeHistoryItem(item as string | Partial<HistoryItem>));
        }
    });

    return result as unknown as ResumeConfig;
};
