export const resumeSchema = {
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    title: "Resume Config",
    description: "履歴書データの構造定義",
    additionalProperties: true, // ユーザー定義のフィールドを許容
    properties: {
        name: {
            type: "string",
            description: "氏名"
        },
        name_kana: {
            type: "string",
            description: "氏名（ふりがな）"
        },
        dob: {
            type: "string",
            pattern: "^\\d{4}-\\d{2}-\\d{2}$",
            description: "生年月日 (YYYY-MM-DD形式)"
        },
        zip: {
            type: "string",
            pattern: "^\\d{3}-?\\d{4}$",
            description: "郵便番号 (ハイフンなし7桁推奨)"
        },
        address: {
            type: "string",
            description: "住所"
        },
        address_kana: {
            type: "string",
            description: "住所（ふりがな）"
        },
        email: {
            type: "string",
            format: "email",
            description: "メールアドレス"
        },
        tel: {
            type: "string",
            description: "電話番号（自宅）"
        },
        tel_mobile: {
            type: "string",
            description: "電話番号（携帯）"
        },
        gender: {
            type: "string",
            description: "性別"
        },
        spouse: {
            type: "string",
            description: "配偶者の有無"
        },
        number_of_dependents: {
            type: "number",
            description: "扶養親族の数（配偶者を除く）"
        },
        education: {
            type: "array",
            description: "学歴リスト",
            items: {
                $ref: "#/definitions/historyItem"
            }
        },
        work_experience: {
            type: "array",
            description: "職歴リスト",
            items: {
                $ref: "#/definitions/historyItem"
            }
        },
        certificates: {
            type: "array",
            description: "免許・資格リスト",
            items: {
                $ref: "#/definitions/historyItem"
            }
        },
        skills: {
            type: "string",
            description: "趣味・特技・スキル"
        },
        motivation: {
            type: "string",
            description: "志望動機"
        },
        requests: {
            type: "string",
            description: "本人希望記入欄"
        },
        remarks: {
            type: "string",
            description: "備考"
        },
        commute_time: {
            type: "string",
            description: "通勤時間"
        },
        portrait: {
            type: "string",
            description: "証明写真（Base64データURL形式）"
        }
    },
    definitions: {
        historyItem: {
            type: "object",
            additionalProperties: true,
            properties: {
                year: {
                    type: ["string", "number"],
                    description: "年"
                },
                month: {
                    type: ["string", "number"],
                    description: "月"
                },
                content: {
                    type: "string",
                    description: "内容（学校名、会社名、資格名など）"
                }
            }
        }
    }
};
