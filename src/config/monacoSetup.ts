/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */

/**
 * Monaco Editor の初期設定モジュール
 * JSONC 言語登録、YAML ワーカー設定、スキーマバリデーション等を一括で行う
 */
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { resumeSchema } from '../constants/resumeSchema';

// monaco-yaml のためにローカルの monaco インスタンスを使用するように設定
loader.config({ monaco });

// JSONC (JSON with Comments) を Monaco に手動登録
// ESM バンドルには jsonc が未登録のため、JSON のトークナイザーを共有する
monaco.languages.register({
    id: 'jsonc',
    extensions: ['.jsonc'],
    aliases: ['JSON with Comments', 'jsonc'],
    mimetypes: ['application/json']
});

// コメント対応の JSON シンタックスハイライト用 Monarch トークナイザー
monaco.languages.setMonarchTokensProvider('jsonc', {
    tokenizer: {
        root: [
            // コメント
            [/\/\/.*$/, 'comment'],
            [/\/\*/, 'comment', '@comment'],
            // 文字列（キーと値の両方）
            [/"(?:[^"\\]|\\.)*"(?=\s*:)/, 'string.key.json'],
            [/"(?:[^"\\]|\\.)*"/, 'string.value.json'],
            // 数値
            [/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, 'number.json'],
            // ブール・null
            [/\b(?:true|false)\b/, 'keyword.json'],
            [/\bnull\b/, 'keyword.json'],
            // 括弧
            [/[{}[\]]/, '@brackets'],
            // カンマ・コロン
            [/[,:]/, 'delimiter'],
        ],
        comment: [
            [/\*\//, 'comment', '@pop'],
            [/./, 'comment']
        ]
    }
});

// JSONC 言語の括弧・コメント・自動補完設定
monaco.languages.setLanguageConfiguration('jsonc', {
    comments: {
        lineComment: '//',
        blockComment: ['/*', '*/']
    },
    brackets: [
        ['{', '}'],
        ['[', ']']
    ],
    autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '"', close: '"' }
    ]
});

// JSON/JSONC 共通のスキーマバリデーション設定
// @ts-expect-error: jsonDefaults の型定義不足を回避
monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    allowComments: true, // JSONC ではコメントを許可
    trailingCommas: 'ignore', // 末尾カンマも許容
    schemas: [{
        uri: 'http://myserver/resume-schema.json',
        fileMatch: ['*'],
        schema: resumeSchema
    }]
});

export { monaco };
