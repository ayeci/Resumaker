/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */
/**
 * 日付文字列を「YYYY年 M月 D日」形式にフォーマットする
 * @param dateStr 日付文字列
 * @returns フォーマット済み日付文字列
 */
export const formatDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getFullYear()}年 ${d.getMonth() + 1}月 ${d.getDate()}日`;
};

/**
 * 生年月日から年齢を計算する
 * @param dob 生年月日文字列
 * @returns 年齢（文字列）
 */
export const calculateAge = (dob: string): string => {
    if (!dob) return '';
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) return '';
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return `${age}`;
};

/**
 * 生年月日を「YYYY年 M月 D日 (満N歳)」形式にフォーマットする
 * @param dob 生年月日文字列
 * @returns フォーマット済み生年月日（年齢付き）
 */
export const formatDob = (dob: string): string => {
    return `${formatDate(dob)}\u3000(満${calculateAge(dob)}歳)`;
};
