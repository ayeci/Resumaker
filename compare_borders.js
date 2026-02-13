const fs = require('fs');
const PizZip = require('pizzip');

// Read both files
const expected = fs.readFileSync('d:/Users/ayebee/source/repos/Resumaker/example/想定結果.xlsx');
const actual = fs.readFileSync('d:/Users/ayebee/source/repos/Resumaker/example/resume (38).xlsx');

const expectedZip = new PizZip(expected);
const actualZip = new PizZip(actual);

const expectedStyles = expectedZip.file('xl/styles.xml').asText();
const actualStyles = actualZip.file('xl/styles.xml').asText();

// Extract borders section
const extractBorders = (xml) => {
    const start = xml.indexOf('<borders');
    const end = xml.indexOf('</borders>') + 10;
    return xml.substring(start, end);
};

const expectedBorders = extractBorders(expectedStyles);
const actualBorders = extractBorders(actualStyles);

// Extract individual border elements
const extractBorderElements = (bordersXml) => {
    const matches = bordersXml.match(/<border>.*?<\/border>/g) || [];
    return matches;
};

const expectedBorderList = extractBorderElements(expectedBorders);
const actualBorderList = extractBorderElements(actualBorders);

console.log('Expected borders count:', expectedBorderList.length);
console.log('Actual borders count:', actualBorderList.length);
console.log('\n=== Expected Border ID 4 ===');
console.log(expectedBorderList[4]);
console.log('\n=== Actual Border ID 4 ===');
console.log(actualBorderList[4]);
console.log('\n=== Expected Border ID 14 ===');
console.log(expectedBorderList[14]);
console.log('\n=== Actual Border ID 14 ===');
console.log(actualBorderList[14]);
console.log('\n=== Expected Border ID 16 ===');
console.log(expectedBorderList[16]);
console.log('\n=== Actual Border ID 16 ===');
console.log(actualBorderList[16]);
