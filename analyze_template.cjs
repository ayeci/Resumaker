const ExcelJS = require('exceljs');
const path = require('path');

const analyze = async () => {
    const workbook = new ExcelJS.Workbook();
    try {
        await workbook.xlsx.readFile(path.join(__dirname, 'テスト用テンプレート.xlsx'));
    } catch (e) {
        console.error("Failed to read file:", e);
        return;
    }

    const worksheet = workbook.worksheets[0];
    const markerRegex = /\{([^}]+)\}/g;

    console.log("--- Analyzing Markers ---");

    worksheet.eachRow((row, rowNumber) => {
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const val = cell.value && typeof cell.value === 'object' && 'richText' in cell.value ? cell.text : (cell.value ? String(cell.value) : '');

            markerRegex.lastIndex = 0;
            let match;
            while ((match = markerRegex.exec(val)) !== null) {
                const label = match[1].trim();
                console.log(`Row: ${rowNumber}, Col: ${colNumber}, Marker: ${label}, Value: "${val}"`);
            }
        });
    });
    console.log("--- End Analysis ---");
};

analyze();
