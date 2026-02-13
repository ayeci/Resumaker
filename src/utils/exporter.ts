import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { type ResumeConfig, DEFAULT_RESUME, type HistoryItem, type ExportOptions, DEFAULT_EXPORT_OPTIONS } from "../types/resume";
import { saveAs } from 'file-saver';
import { formatDob, formatDate, calculateAge } from './date';
import { buildCombinedHistory, processHistory } from './history';
import { formatCustomDate } from './date_formatter';

const toArrayBuffer = async (template: File | ArrayBuffer): Promise<ArrayBuffer> => {
    if (template instanceof ArrayBuffer) return template;
    return template.arrayBuffer();
};

/**
 * 履歴書データをWord形式のBlobとして生成する
 * テンプレートファイルのタグを、履歴書データで置換する
 * @param resume 履歴書データ
 * @param templateFile テンプレートファイル (File or ArrayBuffer)
 * @param options エクスポートオプション
 * @returns 生成されたWordファイルのBlob
 */
export const generateWordBlob = async (resume: ResumeConfig, templateFile: File | ArrayBuffer, options: ExportOptions = DEFAULT_EXPORT_OPTIONS): Promise<Blob> => {
    const arrayBuffer = await toArrayBuffer(templateFile);
    const zip = new PizZip(arrayBuffer);

    const parser = (tag: string) => {
        return {
            get: (scope: Record<string, unknown>) => {
                const trimmedTag = tag.trim();
                const dobMatch = trimmedTag.match(/^dob\s+["'](.+?)["']$/);
                if (dobMatch) return formatCustomDate(resume.dob, dobMatch[1]);

                if (trimmedTag.indexOf(".") !== -1) {
                    const parts = trimmedTag.split(".");
                    let value: unknown = scope;
                    for (const part of parts) {
                        if (value && typeof value === 'object') {
                            value = (value as Record<string, unknown>)[part];
                        }
                    }
                    return value;
                }
                return scope[trimmedTag];
            }
        };
    };

    const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        parser: parser
    });

    const ageValue = calculateAge(resume.dob);
    const dobData = {
        year: '',
        month: '',
        day: '',
        full: resume.dob,
        japan: options.hasDobAge ? formatDob(resume.dob) : formatDate(resume.dob)
    };
    if (resume.dob) {
        const d = new Date(resume.dob);
        if (!isNaN(d.getTime())) {
            dobData.year = String(d.getFullYear());
            dobData.month = String(d.getMonth() + 1);
            dobData.day = String(d.getDate());
        }
    }

    const data = {
        name: resume.name,
        name_kana: resume.name_kana,
        dob: dobData,
        age: ageValue,
        zip: resume.zip,
        address: resume.address,
        address_kana: resume.address_kana,
        email: resume.email,
        phone: resume.tel,
        tel: resume.tel,
        mobile: resume.tel_mobile,
        motivation: resume.motivation,
        skills: resume.skills,
        commute_time: resume.commute_time,
        requests: resume.requests,
        remarks: resume.remarks || '',
        spouse: resume.spouse,
        number_of_dependents: resume.number_of_dependents,

        education: resume.education.map(item => ({
            year: item.year,
            month: item.month,
            content: item.content
        })),
        work: processHistory(resume.work_experience, 'work', options.isWorkCurrentMarker).map(item => ({
            year: item.year,
            month: item.month,
            content: item.content
        })),
        certificates: resume.certificates.map(item => ({
            year: item.year,
            month: item.month,
            content: item.content
        }))
    };

    doc.render(data);

    return doc.getZip().generate({
        type: "blob",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
};

/**
 * 履歴書データをWordファイルとしてダウンロードする
 * @param resume 履歴書データ
 * @param templateFile テンプレートファイル
 * @param options エクスポートオプション
 */
export const exportToWord = async (resume: ResumeConfig, templateFile: File | ArrayBuffer, options: ExportOptions = DEFAULT_EXPORT_OPTIONS) => {
    const blob = await generateWordBlob(resume, templateFile, options);
    saveAs(blob, "resume.docx");
};

export interface ExportData {
    values: Record<string, string | number | undefined>;
    lists: Record<string, HistoryItem[]>;
    portrait?: string;
}

/**
 * 履歴書データをエクスポート用に整形する
 * フラットなキーバリューペアと、リストデータに分離する
 * @param resume 履歴書データ
 * @param options エクスポートオプション
 * @returns 整形済みエクスポートデータ
 */
export const prepareResumeData = (resume: ResumeConfig, options: ExportOptions = DEFAULT_EXPORT_OPTIONS): ExportData => {
    const values: Record<string, string | number | undefined> = {};
    const lists: Record<string, HistoryItem[]> = {};

    const resumeObj = resume as unknown as Record<string, unknown>;
    Object.keys(resumeObj).forEach(key => {
        const val = resumeObj[key];
        if (Array.isArray(val)) {
            const list: HistoryItem[] = [];
            val.forEach(item => {
                if (typeof item === 'object' && item !== null) {
                    list.push(item as HistoryItem);
                }
            });
            lists[key] = list;
        } else if (typeof val !== 'object' || val === null) {
            values[key] = val as string | number | undefined;
        } else if (val instanceof Date) {
            values[key] = val.toISOString();
        }
    });

    (Object.keys(DEFAULT_RESUME) as Array<keyof ResumeConfig>).forEach(key => {
        if (values[key] === undefined && !lists[key]) {
            const defVal = DEFAULT_RESUME[key];
            if (!Array.isArray(defVal) && typeof defVal !== 'object') {
                values[key] = defVal as string | number | undefined;
            }
        }
    });

    if (resume.dob) {
        values['dob'] = options.hasDobAge ? formatDob(resume.dob) : formatDate(resume.dob);
        values['dob.full'] = resume.dob;
        values['dob.japan'] = values['dob'];

        const d = new Date(resume.dob);
        if (!isNaN(d.getTime())) {
            values['dob.year'] = String(d.getFullYear());
            values['dob.month'] = String(d.getMonth() + 1);
            values['dob.day'] = String(d.getDate());
        } else {
            values['dob.year'] = '';
            values['dob.month'] = '';
            values['dob.day'] = '';
        }
    }

    values['age'] = calculateAge(resume.dob);
    values['updated'] = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' }) + '\u3000現在';

    const history = buildCombinedHistory(resume, options);
    lists['history'] = history;

    const certs: HistoryItem[] = Array.isArray(resume.certificates) ? resume.certificates : [];
    const certList: HistoryItem[] = [];
    certs.forEach(item => certList.push({ ...item }));
    if (certList.length > 0 && options.isCertificateEndMarker) {
        certList.push({ id: 'c-e', year: '', month: '', content: '以上', content_align: 'right' });
    }
    lists['certificate'] = certList;

    return { values, lists, portrait: resume.portrait || undefined };
};

/**
 * 整形済みデータとテンプレートを用いてExcelファイルを生成する
 * sharedStrings.xmlや各シートのXMLを直接操作して置換を行う
 * @param data 整形済みエクスポートデータ
 * @param templateFile テンプレートファイル
 * @returns 生成されたExcelファイルのBlob
 */
export const generateExcelFromData = async (data: ExportData, templateFile: File | ArrayBuffer): Promise<Blob> => {
    const arrayBuffer = await toArrayBuffer(templateFile);
    const zip = new PizZip(arrayBuffer);

    const sharedStringsXml = zip.file('xl/sharedStrings.xml')?.asText();
    if (!sharedStringsXml) throw new Error('sharedStrings.xml missing');

    const sharedStrings: string[] = [];
    const siRegex = /<si>(.*?)<\/si>/gs;
    let siMatch;
    while ((siMatch = siRegex.exec(sharedStringsXml)) !== null) {
        const siContent = siMatch[1].replace(/<rPh[^>]*>.*?<\/rPh>/gs, '');
        const tPattern = /<t[^>]*>(.*?)<\/t>/gs;
        let fullText = '';
        let tMatch;
        while ((tMatch = tPattern.exec(siContent)) !== null) {
            fullText += tMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
        }
        sharedStrings.push(fullText);
    }

    const alignmentMap = new Map<string, 'left' | 'center' | 'right'>();
    const ssReplacements = new Map<number, string>();
    const worksheetFiles = Object.keys(zip.files).filter(f => f.startsWith('xl/worksheets/sheet') && f.endsWith('.xml'));

    for (const sheetPath of worksheetFiles) {
        const sheetFile = zip.file(sheetPath);
        if (!sheetFile) continue;
        let sheetXml = sheetFile.asText();
        let sheetUpdated = false;

        const cellWithS = /<c r="([A-Z]+\d+)"[^>]* t="s"[^>]*><v>(\d+)<\/v><\/c>/g;
        let cellMatch;
        while ((cellMatch = cellWithS.exec(sheetXml)) !== null) {
            const addr = cellMatch[1];
            const idx = parseInt(cellMatch[2], 10);
            if (idx < sharedStrings.length) {
                const text = sharedStrings[idx];
                if (text.includes('{')) {
                    const replaced = text.replace(/{([^}]+)}/g, (_: string, key: string) => {
                        const tk = key.trim();
                        if (data.values[tk] !== undefined) return String(data.values[tk]);
                        const idxMatch = tk.match(/^([a-zA-Z0-9_]+)\[(\d+)\]\.([a-zA-Z0-9_]+)$/);
                        if (idxMatch) {
                            const list = data.lists[idxMatch[1]];
                            const i = parseInt(idxMatch[2], 10);
                            const f = idxMatch[3].toLowerCase();
                            if (list && i < list.length) {
                                const item = list[i];
                                if (f === 'content' && item.content_align) alignmentMap.set(`${sheetPath}:${addr}`, item.content_align);
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                const val = (item as any)[f];
                                return val !== undefined ? String(val) : '';
                            }
                        }
                        return '';
                    });
                    if (replaced !== text) ssReplacements.set(idx, replaced);
                }
            }
        }

        sheetXml = sheetXml.replace(/<f([^>]*)>(.*?)<\/f>/gs, (match: string, attrs: string, formula: string) => {
            if (formula.includes('{')) {
                const unescaped = formula.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
                let first = '';
                const replaced = unescaped.replace(/{([^}]+)}/g, (_: string, key: string) => {
                    const tk = key.trim();
                    const val = data.values[tk] !== undefined ? String(data.values[tk]) : '';
                    if (!first) first = val;
                    return val;
                });
                if (replaced !== unescaped) {
                    sheetUpdated = true;
                    const escF = replaced.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
                    const escV = first.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
                    return `<f${attrs}>${escF}</f><v>${escV}</v>`;
                }
            }
            return match;
        });

        const relevantAligns = Array.from(alignmentMap.entries()).filter(([k]) => k.startsWith(`${sheetPath}:`));
        if (relevantAligns.length > 0) {
            const stylesFile = zip.file('xl/styles.xml');
            let stylesXml = stylesFile?.asText();
            if (stylesXml) {
                const xfsMatch = stylesXml.match(/<cellXfs count="(\d+)">/);
                const xfsContent = stylesXml.match(/<cellXfs[^>]*>(.*?)<\/cellXfs>/s);
                if (xfsMatch && xfsContent && xfsContent[1]) {
                    const count = parseInt(xfsMatch[1]);
                    const elements = xfsContent[1].match(/<xf\s[^>]*?(?:\/>|>(?:[\s\S]*?)<\/xf>)/g) || [];

                    const newXfs: string[] = [];

                    const idxMap = new Map<string, number>();

                    for (const [key, al] of relevantAligns) {
                        const addr = key.split(':')[1];

                        // s属性がある場合とない場合の両方を考慮してスタイルインデックスを取得
                        const cellRegex = new RegExp(`<c r="${addr}"[^>]*>`, 'g');
                        const cellMatch = cellRegex.exec(sheetXml);
                        if (cellMatch) {
                            const cellTag = cellMatch[0];
                            const sMatch = cellTag.match(/ s="(\d+)"/);
                            const curIdx = sMatch ? parseInt(sMatch[1], 10) : 0; // s属性がない場合は0


                            if (curIdx < elements.length) {
                                const xf = elements[curIdx];

                                let newXf = xf;
                                if (xf.includes('<alignment')) {
                                    newXf = xf.replace(/<alignment[^>]*\/>/g, (m) => {
                                        const vM = m.match(/vertical="([^"]*)"/);
                                        return `<alignment horizontal="${al}" vertical="${vM ? vM[1] : 'top'}" indent="0"/>`;
                                    });
                                } else {
                                    // alignmentがない場合、閉じる直前に挿入
                                    if (xf.endsWith('/>')) {
                                        // 自己終了タグの場合 (<xf ... />)
                                        newXf = xf.replace('/>', `><alignment horizontal="${al}" vertical="top" indent="0"/></xf>`);
                                    } else {
                                        // 通常の閉じタグの場合 (</xf>)
                                        newXf = xf.replace('</xf>', `<alignment horizontal="${al}" vertical="top" indent="0"/></xf>`);
                                    }
                                }

                                newXfs.push(newXf);
                                const newIdx = count + newXfs.length - 1;
                                idxMap.set(addr, newIdx);

                            }
                        }
                    }
                    if (newXfs.length > 0) {

                        stylesXml = stylesXml.replace(/<cellXfs count="\d+">/, `<cellXfs count="${count + newXfs.length}">`);
                        const pos = stylesXml.indexOf('</cellXfs>');
                        if (pos !== -1) {
                            stylesXml = stylesXml.substring(0, pos) + newXfs.join('') + stylesXml.substring(pos);
                            zip.file('xl/styles.xml', stylesXml);
                            idxMap.forEach((nI, a) => {
                                // s属性がある場合は置換、ない場合は追加
                                const sAttrRegex = new RegExp(`(<c r="${a}"[^>]*) s="\\d+"`);
                                if (sAttrRegex.test(sheetXml)) {
                                    sheetXml = sheetXml.replace(sAttrRegex, `$1 s="${nI}"`);
                                } else {
                                    // s属性がない場合、<c r="XX" ...> の中に s="nI" を挿入する
                                    // 属性の順序は問わないが、> の前に入れる必要がある
                                    // 簡易的に <c r="XX" の直後に追加する
                                    const cTagRegex = new RegExp(`(<c r="${a}")`);
                                    sheetXml = sheetXml.replace(cTagRegex, `$1 s="${nI}"`);
                                }
                            });
                            sheetUpdated = true;
                        }
                    }
                }
            }
        }
        if (sheetUpdated) {
            sheetXml = sheetXml.replace(/(<f[^>]*>.*?<\/f>)\s*<v>(.*?)<\/v>\s*<v>.*?<\/v>/gs, '$1<v>$2</v>');
            zip.file(sheetPath, sheetXml);
        }
    }

    if (ssReplacements.size > 0) {
        let i = 0;
        const newSSXml = sharedStringsXml.replace(/<si>.*?<\/si>/gs, (m) => {
            const n = ssReplacements.get(i++);
            if (n !== undefined) {
                const e = n.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
                return `<si><t xml:space="preserve">${e}</t></si>`;
            }
            return m;
        });
        zip.file('xl/sharedStrings.xml', newSSXml);
    }

    if (data.portrait) {
        const dUM = data.portrait.match(/^data:(image\/(png|jpeg|jpg|gif|tiff));base64,(.+)$/);
        if (dUM) {
            const ext = dUM[2] === 'jpg' ? 'jpeg' : dUM[2];
            const bin = atob(dUM[3]);
            const b = new Uint8Array(bin.length);
            for (let j = 0; j < bin.length; j++) b[j] = bin.charCodeAt(j);
            zip.file(`xl/media/portrait1.${ext}`, b);

            let ctXml = zip.file('[Content_Types].xml')?.asText();
            if (ctXml && !ctXml.includes(`Extension="${ext}"`)) {
                ctXml = ctXml.replace('</Types>', `<Default Extension="${ext}" ContentType="${dUM[1]}"/></Types>`);
                zip.file('[Content_Types].xml', ctXml);
            }

            const drFiles = Object.keys(zip.files).filter(f => f.match(/^xl\/drawings\/drawing\d+\.xml$/));
            for (const dp of drFiles) {
                const drawingFile = zip.file(dp);
                let dXml = drawingFile?.asText();
                if (dXml && dXml.includes('{portrait}')) {
                    const aP = /<xdr:twoCellAnchor[^>]*>[\s\S]*?<\/xdr:twoCellAnchor>/g;
                    let aM;
                    while ((aM = aP.exec(dXml)) !== null) {
                        if (aM[0].includes('{portrait}')) {
                            const fM = aM[0].match(/<xdr:from>[\s\S]*?<\/xdr:from>/);
                            const tM = aM[0].match(/<xdr:to>[\s\S]*?<\/xdr:to>/);
                            const lSM = aM[0].match(/<a:ln[^>]*(?:\/>|>[\s\S]*?<\/a:ln>)/);
                            const eM = aM[0].match(/<a:ext\s+cx="(\d+)"\s+cy="(\d+)"/);
                            if (fM && tM) {
                                const pXml = `<xdr:twoCellAnchor>${fM[0]}${tM[0]}<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="9999" name="P"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rIdP1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${eM ? eM[1] : '914400'}" cy="${eM ? eM[2] : '1219200'}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${lSM ? '\n    ' + lSM[0] : ''}</xdr:spPr></xdr:pic><xdr:clientData/></xdr:twoCellAnchor>`;
                                dXml = dXml.replace(aM[0], pXml);
                            }
                        }
                    }
                    zip.file(dp, dXml);
                    const dN = dp.split('/').pop();
                    const rP = `xl/drawings/_rels/${dN}.rels`;
                    let rXml = zip.file(rP)?.asText() || `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
                    if (!rXml.includes('rIdP1')) {
                        rXml = rXml.replace('</Relationships>', `<Relationship Id="rIdP1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/portrait1.${ext}"/></Relationships>`);
                        zip.file(rP, rXml);
                    }
                }
            }
        }
    }

    zip.remove('xl/calcChain.xml');
    let wbXml = zip.file('xl/workbook.xml')?.asText();
    if (wbXml) {
        if (wbXml.includes('<calcPr')) wbXml = wbXml.replace('<calcPr', '<calcPr fullCalcOnLoad="1"');
        else wbXml = wbXml.replace('</workbook>', '<calcPr fullCalcOnLoad="1"/></workbook>');
        zip.file('xl/workbook.xml', wbXml);
    }

    return zip.generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

/**
 * 履歴書データをExcel形式のBlobとして生成する (ラッパー関数)
 * @param resume 履歴書データ
 * @param templateFile テンプレートファイル
 * @param options エクスポートオプション
 * @returns 生成されたExcelファイルのBlob
 */
export const generateExcelBlob = async (resume: ResumeConfig, templateFile: File | ArrayBuffer | null | undefined, options: ExportOptions = DEFAULT_EXPORT_OPTIONS): Promise<Blob> => {
    if (!templateFile) throw new Error("Template required");
    return generateExcelFromData(prepareResumeData(resume, options), templateFile);
};

/**
 * 履歴書データをExcelファイルとしてダウンロードする
 * @param resume 履歴書データ
 * @param templateFile テンプレートファイル
 * @param options エクスポートオプション
 */
export const exportToExcel = async (resume: ResumeConfig, templateFile?: File | ArrayBuffer | null, options: ExportOptions = DEFAULT_EXPORT_OPTIONS) => {
    const blob = await generateExcelBlob(resume, templateFile, options);
    saveAs(blob, "resume.xlsx");
};
