const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

const checkStructure = () => {
    const templatePath = path.join(__dirname, 'テスト用テンプレート.xlsx');
    try {
        const content = fs.readFileSync(templatePath);
        const zip = new PizZip(content);

        console.log("--- XLSX Internal Structure ---");
        const files = Object.keys(zip.files);
        const drawingFiles = files.filter(f => f.includes('drawings') || f.includes('media'));

        if (drawingFiles.length > 0) {
            console.log("Found Drawing/Media files:");
            drawingFiles.forEach(f => console.log(` - ${f}`));
        } else {
            console.log("No drawing/media files found in internal structure.");
        }

    } catch (e) {
        console.error("Error reading xlsx with PizZip:", e.message);
    }
};

checkStructure();
