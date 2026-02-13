import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

const exampleDir = 'd:/Users/ayebee/source/repos/Resumaker/example';
const files = [
    'format_レバテック.xlsx',
    'format_訓練校書式.xlsx',
    'format_独自書式.xlsx'
];

const markerPattern = /{([^{}]+)}/g;

let output = '';

files.forEach(filename => {
    const filePath = path.join(exampleDir, filename);
    output += `\n--- Analyzing ${filename} ---\n`;

    if (!fs.existsSync(filePath)) {
        output += `File does not exist: ${filePath}\n`;
        return;
    }

    try {
        const data = fs.readFileSync(filePath);
        const workbook = XLSX.read(data, { type: 'buffer' });
        const markers = new Set();

        workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            if (!worksheet) return;

            for (const z in worksheet) {
                if (z[0] === '!') continue;
                const cell = worksheet[z];

                if (cell && cell.v !== undefined && cell.v !== null) {
                    const strV = String(cell.v);
                    let match;
                    while ((match = markerPattern.exec(strV)) !== null) {
                        markers.add(match[1].trim());
                    }
                }
                if (cell && cell.f && typeof cell.f === 'string') {
                    let match;
                    while ((match = markerPattern.exec(cell.f)) !== null) {
                        markers.add(match[1].trim());
                    }
                }
            }
        });

        const sortedMarkers = Array.from(markers).sort();
        if (sortedMarkers.length === 0) {
            output += '(No markers found)\n';
        } else {
            sortedMarkers.forEach(m => output += `${m}\n`);
        }
    } catch (err) {
        output += `Error reading ${filename}: ${err.message}\n`;
    }
});

fs.writeFileSync('markers_output.txt', output);
console.log('Results written to markers_output.txt');
