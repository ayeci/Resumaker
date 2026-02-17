/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */

/** A, B, C... などの列文字を 0 始まりの数値インデックスに変換する */
export const colToIdx = (col: string): number => {
    let idx = 0;
    for (let i = 0; i < col.length; i++) {
        idx = idx * 26 + (col.charCodeAt(i) - 64);
    }
    return idx - 1;
};

/** 数値インデックスを再び A, B, C... の列文字に戻す（返却用） */
export const idxToCol = (idx: number): string => {
    let col = "";
    while (idx >= 0) {
        col = String.fromCharCode((idx % 26) + 65) + col;
        idx = Math.floor(idx / 26) - 1;
    }
    return col;
};

/**
 * 複数のアドレス文字列（例: ["A1:B10", "D20:E30"]）から
 * 全てを包含する最大の矩形範囲を計算する
 */
export const getMaximumPrintAreaFromList = (areas: string[] | string) => {
    let minR = Infinity, minC = Infinity, maxR = -Infinity, maxC = -Infinity;

    const area = typeof areas === "string" ? areas.split(",") : areas;

    area.forEach(ar => {
        // 正規表現で「開始列・開始行 : 終了列・終了行」を抽出
        const match = ar.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
        if (!match) return;

        const [, sCol, sRow, eCol, eRow] = match;

        // 全ての範囲を比較し、最も外側の座標を更新し続ける
        minR = Math.min(minR, parseInt(sRow));
        minC = Math.min(minC, colToIdx(sCol));
        maxR = Math.max(maxR, parseInt(eRow));
        maxC = Math.max(maxC, colToIdx(eCol));
    });

    if (minR === Infinity) return undefined;

    return {
        sRow: minR,
        sCol: idxToCol(minC),
        eRow: maxR,
        eCol: idxToCol(maxC),
        // FortuneSheet用の 0 始まりインデックス
        r1: minR - 1,
        c1: minC,
        r2: maxR - 1,
        c2: maxC,
        // A1:B10 のようなアドレス文字列
        address: `${idxToCol(minC)}${minR}:${idxToCol(maxC)}${maxR}`
    };
};