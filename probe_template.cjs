const ExcelJS = require('exceljs');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const probe = async () => {
    const templatePath = path.join(__dirname, 'テスト用テンプレート.xlsx');
    console.log(`Probing: ${templatePath}`);

    // --- ExcelJS Probe ---
    console.log('\n--- ExcelJS Probe ---');
    const workbook = new ExcelJS.Workbook();
    try {
        await workbook.xlsx.readFile(templatePath);
        const worksheet = workbook.worksheets[0];

        console.log('Worksheet Images:', worksheet.getImages());

        // Check internal properties that might hold drawing info
        // Note: These are not public API but might exist
        console.log('Worksheet.media:', (worksheet).media);
        console.log('Worksheet.drawing:', (worksheet).drawing);

        // Also check if workbook has media
        console.log('Workbook.media:', (workbook).media);
        console.log('Workbook.model.media:', (workbook).model && (workbook).model.media);

    } catch (e) {
        console.error('ExcelJS Error:', e.message);
    }

    // --- SheetJS (xlsx) Probe ---
    console.log('\n--- SheetJS (xlsx) Probe ---');
    try {
        const wb = XLSX.readFile(templatePath, { cellFormula: false, cellHTML: false, cellNF: false, cellStyles: false, cellText: false, bookDeps: true, bookFiles: true, bookVBA: true }); // Read as much as possible
        console.log('Sheet Names:', wb.SheetNames);
        const ws = wb.Sheets[wb.SheetNames[0]];

        // Check for drawings in sheet
        const keys = Object.keys(ws).filter(k => k.startsWith('!'));
        console.log('Sheet Special Keys:', keys);

        if (keys.includes('!drawing')) {
            console.log('Found !drawing key!');
        }
        if (keys.includes('!images')) {
            console.log('Found !images key!');
        }

    } catch (e) {
        console.error('SheetJS Error:', e.message);
    }
};

probe();
