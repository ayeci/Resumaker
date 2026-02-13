
const removeEmptyProperties = (obj: any): any => {
    if (Array.isArray(obj)) {
        return obj.map(v => removeEmptyProperties(v)).filter(v => v !== null && v !== undefined && v !== '');
    }
    if (typeof obj === 'object' && obj !== null) {
        const newObj: any = {};
        Object.keys(obj).forEach(key => {
            const val = removeEmptyProperties(obj[key]);
            if (val !== null && val !== undefined && val !== '') {
                newObj[key] = val;
            }
        });
        return newObj;
    }
    return obj;
};

const testData = {
    name: "Test User",
    emptyField: "",
    nullField: null,
    undefinedField: undefined,
    nested: {
        valid: "value",
        empty: "",
        nestedEmpty: {
            val: ""
        }
    },
    list: [
        { id: "1", content: "item1", year: "", month: "" },
        { id: "2", content: "item2", year: "2020", month: "04" },
        ""
    ]
};

const cleaned = removeEmptyProperties(testData);
console.log(JSON.stringify(cleaned, null, 2));

if (cleaned.emptyField !== undefined) console.error("FAILED: emptyField remains");
if (cleaned.list[0].year !== undefined) console.error("FAILED: list[0].year remains");
if (cleaned.list[0].content !== "item1") console.error("FAILED: list[0].content missing");
if (cleaned.list[1].year !== "2020") console.error("FAILED: list[1].year missing");
if (Object.keys(cleaned.nested.nestedEmpty).length !== 0) console.error("FAILED: nestedEmpty not empty");
