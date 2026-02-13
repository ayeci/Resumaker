const ExcelJS = require('exceljs');
const path = require('path');

const compare = async () => {
    const wbResult = new ExcelJS.Workbook();
    const wbExpected = new ExcelJS.Workbook();

    try {
        await wbResult.xlsx.readFile(path.join(__dirname, 'result.xlsx'));
        await wbExpected.xlsx.readFile(path.join(__dirname, '想定結果.xlsx'));
    } catch (e) {
        console.error("Error reading files:", e);
        return;
    }

    const wsResult = wbResult.worksheets[0];
    const wsExpected = wbExpected.worksheets[0];

    console.log("--- Comparison Start ---");
    let mismatchCount = 0;

    // Iterate over the Expected sheet's rows/cells as the source of truth
    wsExpected.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        row.eachCell({ includeEmpty: true }, (expectedCell, colNumber) => {
            const resultCell = wsResult.getRow(rowNumber).getCell(colNumber);

            // Normalize values: treat null/undefined as empty string
            const getVal = (cell) => {
                if (!cell.value) return "";
                if (typeof cell.value === 'object' && 'richText' in cell.value) return cell.text;
                return String(cell.value);
            };

            const valExpected = getVal(expectedCell).trim();
            const valResult = getVal(resultCell).trim();

            if (valExpected !== valResult) {
                // Ignore if both are effectively empty (one might be null, other empty string)
                if (valExpected === "" && valResult === "") return;

                console.log(`Mismatch at Row: ${rowNumber}, Col: ${colNumber}`);
                console.log(`  Expected: "${valExpected}"`);
                console.log(`  Actual:   "${valResult}"`);
                mismatchCount++;
            }
        });
    });

    // reverse check? (if result has extra stuff) -> maybe later if needed.

    if (mismatchCount === 0) {
        console.log("SUCCESS: Content matches exactly!");
    } else {
        console.log(`FAILURE: Found ${mismatchCount} mismatches.`);
    }
    console.log("--- Comparison End ---");
};

compare();
