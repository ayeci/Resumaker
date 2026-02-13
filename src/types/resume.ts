/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */
/**
 * 履歴書データ構造定義
 */
export interface ResumeConfig {
    /** 氏名 */
    name: string;
    /** 氏名（ふりがな） */
    name_kana: string;
    /** 生年月日 (yyyy-mm-dd形式) */
    dob: string;
    /** 郵便番号 (ハイフンなし7桁推奨) */
    zip: string;
    /** 住所 */
    address: string;
    /** 住所（ふりがな） */
    address_kana: string;
    /** メールアドレス */
    email: string;
    /** 電話番号（自宅） */
    tel: string;
    /** 電話番号（携帯） */
    tel_mobile: string;
    /** 性別 */
    gender: string;
    /** 配偶者の有無 */
    spouse: string;
    /** 扶養親族の数（配偶者を除く） */
    number_of_dependents: number;
    /** 学歴リスト */
    education: HistoryItem[];
    /** 職歴リスト */
    work_experience: HistoryItem[];
    /** 免許・資格リスト */
    certificates: HistoryItem[];
    /** 趣味・特技・スキル */
    skills: string;
    /** 志望動機 */
    motivation: string;
    /** 本人希望記入欄 */
    requests: string;
    /** 備考 */
    remarks: string;
    /** 通勤時間 */
    commute_time: string;
    /** 証明写真（Base64データURL形式） */
    portrait?: string;
}

/**
 * テンプレートファイル管理エントリ
 */
export interface TemplateEntry {
    /** 一意のID (UUID v4等) */
    id: string;
    /** アップロードされたファイルオブジェクト */
    file: File;
    /** ファイルのArrayBuffer (キャッシュ用。File参照切れ対策) */
    arrayBuffer: ArrayBuffer;
    /** ファイル名 */
    name: string;
    /** テンプレートのフォーマット ('word' | 'excel') */
    format: 'word' | 'excel';
    /** エクスポート対象として選択されているか */
    checked: boolean;
}

/**
 * 履歴項目（学歴、職歴、資格など）
 */
export interface HistoryItem {
    /** リストレンダリング用の一意なID */
    id: string;
    /** 年 */
    year?: string | '';
    /** 月 */
    month?: string | '';
    /** 日 (現状未使用) */
    day?: string | '';
    /** 曜日 (現状未使用) */
    dow?: string | '';
    /** 内容（学校名、会社名、資格名など） */
    content?: string | '';
    /** 内容の配置属性 ('left' | 'center' | 'right') */
    content_align?: 'left' | 'center' | 'right';
}

/**
 * 新規作成時の履歴書デフォルト値
 */
export const DEFAULT_RESUME: ResumeConfig = {
    name: "",
    name_kana: "",
    dob: "",
    zip: "",
    address: "",
    address_kana: "",
    email: "",
    tel: "",
    tel_mobile: "",
    gender: "男性",
    spouse: "なし",
    number_of_dependents: 0,
    education: [],
    work_experience: [],
    certificates: [],
    skills: "",
    motivation: "",
    requests: "貴社の規定に従います。",
    remarks: "特になし",
    commute_time: "",
    portrait: "",
};

/**
 * エクスポートオプション設定
 */
export interface ExportOptions {
    /** 履歴（学歴・職歴・資格すべて）の最後に「以上」を入れるか */
    isHistoryEndMarker: boolean;
    /** 学歴の最後に「以上」を入れるか */
    isEducationEndMarker: boolean;
    /** 職歴の最後に「以上」を入れるか */
    isWorkEndMarker: boolean;
    /** 職歴の末尾に「現在に至る」を入れるか */
    isWorkCurrentMarker: boolean;
    /** 免許・資格リストの最後に「以上」を入れるか */
    isCertificateEndMarker: boolean;
    /** 生年月日に年齢を含めるか */
    hasDobAge: boolean;
}

/**
 * エクスポートオプションのデフォルト値
 */
export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
    isHistoryEndMarker: true,
    isEducationEndMarker: false,
    isWorkEndMarker: false,
    isWorkCurrentMarker: true,
    isCertificateEndMarker: true,
    hasDobAge: true,
};
