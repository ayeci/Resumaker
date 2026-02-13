
/**
 * 日付を指定されたパターンに従ってフォーマットする
 * 和暦、英名月、曜日などのカスタムトークンに対応
 * @param dateStr 日付文字列
 * @param pattern フォーマットパターン (例: "yyyy年mm月dd日", "gggee年mm月dd日")
 * @returns フォーマットされた日付文字列
 */
export const formatCustomDate = (dateStr: string, pattern: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = date.getDay();

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthShortNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayShortNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayJpNames = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];
    const dayJpShortNames = ["日", "月", "火", "水", "木", "金", "土"];

    // 和暦の計算
    const getEra = (d: Date) => {
        const time = d.getTime();
        if (time >= new Date("2019-05-01").getTime()) return { g: "R", gg: "令", ggg: "令和", offset: 2018 };
        if (time >= new Date("1989-01-08").getTime()) return { g: "H", gg: "平", ggg: "平成", offset: 1988 };
        if (time >= new Date("1926-12-25").getTime()) return { g: "S", gg: "昭", ggg: "昭和", offset: 1925 };
        if (time >= new Date("1912-07-30").getTime()) return { g: "T", gg: "大", ggg: "大正", offset: 1911 };
        if (time >= new Date("1868-10-23").getTime()) return { g: "M", gg: "明", ggg: "明治", offset: 1867 };
        return { g: "", gg: "", ggg: "", offset: 0 };
    };

    const era = getEra(date);
    const eraYear = year - era.offset;
    const eraYearStr = eraYear === 1 ? "元" : String(eraYear);
    const eraYearZeroStr = eraYear === 1 ? "元" : String(eraYear).padStart(2, '0');

    const tokens: Record<string, string> = {
        "yyyy": String(year),
        "yy": String(year).slice(-2),
        "mmmm": monthNames[month - 1],
        "mmm": monthShortNames[month - 1],
        "mmmmm": monthNames[month - 1][0],
        "mm": String(month).padStart(2, '0'),
        "m": String(month),
        "dddd": dayNames[dayOfWeek],
        "ddd": dayShortNames[dayOfWeek],
        "dd": String(day).padStart(2, '0'),
        "d": String(day),
        "aaaa": dayJpNames[dayOfWeek],
        "aaa": dayJpShortNames[dayOfWeek],
        "ggg": era.ggg,
        "gg": era.gg,
        "g": era.g,
        "ee": eraYearZeroStr,
        "e": eraYearStr
    };

    // 長いトークンから順にマッチさせるためにソート
    const tokenKeys = Object.keys(tokens).sort((a, b) => b.length - a.length);

    // 単純な置換ロジック
    let result = pattern;

    // Excel等でのエスケープロジックは複雑なため（クォート使用など）、
    // ここでは単純なトークン置換を行います。
    // 既に置換されたトークンの一部が再置換されるのを防ぐため、プレースホルダー戦略を使用します。

    const placeholders: Record<string, string> = {};
    let pCount = 0;

    tokenKeys.forEach(t => {
        const regex = new RegExp(t, 'g');
        result = result.replace(regex, (match) => {
            const p = `__P${pCount}__`;
            placeholders[p] = tokens[match];
            pCount++;
            return p;
        });
    });

    Object.keys(placeholders).forEach(p => {
        result = result.replace(p, placeholders[p]);
    });

    return result;
};
