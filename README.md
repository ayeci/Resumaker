# Resumaker

**Resumaker** は、YAML/JSONファイル形式で記述された履歴書データをもとに、ExcelおよびWord形式の履歴書を生成するアプリケーションです。
データの管理をテキストベース（YAML or JSON）で行うことで、バージョン管理や修正を容易にし、デザインされたテンプレートへの流し込みを自動化します。

## 特徴

- **YAML/JSONによるデータ管理**: 履歴書の情報を可読性の高いYAML形式で記述します。
- **Excelエクスポート**: 既存のExcelテンプレート（JIS規格等）のレイアウトやスタイル（結合セル、フォント、罫線など）を維持したままデータを出力します。
  - 学歴・職歴欄の統合処理（`history`）
  - 「現在に至る」「以上」などの自動追記、数式内の数値置換対応
- **Wordエクスポート**: Wordテンプレート（Docxtemplater）へのデータ流し込みに対応。
- **プライバシー重視**: クライアントサイド（ブラウザ）完結で動作するため、個人データが外部サーバーに送信されることはありません。
- **リアルタイムプレビュー**: 編集内容を確認しながら作業可能（ファイルアップロードでの読み込みにも対応）。
- **PDF保存・印刷**: ブラウザ標準の印刷機能を使用して、プレビュー通りの高品質なPDF保存や印刷が可能です。

## セキュリティとプライバシー

Resumaker は「クライアントサイド完結型」のアプリケーションです。ユーザーのプライバシーを最優先に設計されています。

- **データはメモリ内のみ**: 入力されたデータはブラウザのメモリ上でのみ処理されます。サーバーへの送信はもちろん、`localStorage` への保存も行いません。ブラウザを閉じるとデータは完全に破棄されます。
- **トラッキングなし**: Cookie や Google Analytics 等の解析ツールは一切使用していません。
- **詳細**: [プライバシーポリシー](./PRIVACY.md) を参照してください。

## 技術スタック

- **Core**:
  - React 19
  - TypeScript
  - Vite 7
- **UI Framework**:
  - Material UI (MUI) v7
- **Styling**:
  - Sass (Dart Sass) / SCSS Modules
  - Emotion
- **Data Import (読込)**:
  - Excel/Text: xlsx (SheetJS)
  - Word: Mammoth
  - PDF: pdfjs-dist
- **Export (出力)**:
  - Excel: PizZip (XML直接操作)
  - Word: Docxtemplater, PizZip
- **Preview (プレビュー)**:
  - Excel: FortuneSheet
  - Word: docx-preview
- **Data Format**:
  - YAML (js-yaml)
  - JSON
- **YAML / JSON Editor**:
  - Monaco Editor
- **Icons**:
  - Lucide React

## テンプレートについて

本アプリに含まれているテンプレートは、あくまで動作確認用の「最小限のサンプル」です。  
実用的な履歴書を作成する場合は、ご自身でテンプレートを用意することを強く推奨します。  
（マーカー埋め込み済みのテンプレートは著作権の関係で公開できないです。すみません……）

- **公式様式**: [厚生労働省の履歴書様式例](https://www.hellowork.mhlw.go.jp/member/career_doc01.html) などからExcelファイルをダウンロードしてください。
- **作成方法**: ダウンロードしたファイルに、以下のガイドに従ってマーカー（例: `{name}`）を書き込むことで、あなた専用のテンプレートを作成できます。

## テンプレート作成ガイド

### 1. 単一の値（Placeholders）

YAML/JSONデータのキーに対応する値を埋め込みます。(サンプル: `example/sample.xlsx`)  

**予約語以外でも、YAMLで定義した任意のキーを `{key}` で参照可能です。**

#### 主要なマーカー予約語

| カテゴリ | マーカー (例) | 説明 |
| :--- | :--- | :--- |
| **基本情報** | `name`, `email`, `tel`, `tel_mobile` | 氏名、メール、電話等 |
| **住所** | `zip`, `address`, `address_kana` | 郵便番号、住所等 |
| **日付(和暦対応)** | `dob.japan`, `date.japan` | 和暦フォーマット（令和x年...） |
| **日付(分割)** | `dob.year`, `dob.month`, `dob.day` | 年・月・日を個別に出力 |
| **日付(元号)** | `dob.era` | 元号のみ（令和、平成等） |
| **年齢・現在** | `age`, `updated` | 自動計算された年齢、今日の日付 |
| **学歴・職歴1** | `education`, `work_experience` | 学歴リスト、職歴リスト |
| **学歴・職歴2** | `history` | 学歴と職歴を統合したリスト。学歴と職歴それぞれのブロックの上に「学歴」「職歴」の見出しを付与して一連のリストとして出力(詳細後述) |
| **免許・資格** | `certificate` | 資格リスト |
| **その他** | `motivation`, `skills`, `portrait` | 志望動機、特技、証明写真(画像) |

- **カスタム日付**: 日付項目は `{dob "yyyy/MM/dd"}` のようにダブルクォーテーションで囲んでフォーマットを指定できます。

### 2. リストデータ（Loops）

「学歴（`education`）・職歴（`work_experience`）」および「免許・資格（`certificate`）」は自動的にリストとして処理されます。  
「学歴」と「職歴」は`history`にまとめて出力することも可能です。  
リストの項目は、リストの開始行から終了行までのすべての行を`{key[index].property_name}`のフォーマットのマーカーで埋めることで、自動的に先頭から値を埋め込むことが可能です。
例えば履歴書の学歴・職歴欄のように記入するブロックが離れていても index を参照して自動的にブロックを移りながら埋め込みます。  

#### Wordテンプレート

Docxtemplaterの標準記法を使用します。

- **学歴・職歴（統合）**: `{#history} ... {/history}`
- **免許・資格**: `{#certificate} ... {/certificate}`
- 内部では `year`, `month`, `content` フィールドが使用可能です。

#### Excelテンプレート

テンプレートにあらかじめ用意されたセルにインデックスを指定して埋め込む形式です。

- **書式**: `{listName[index].propertyName}`
- **例**: `{history[0].year}`, `{history[1].content}`, `{certificate[0].year}`
- **インデックスなし**: `{listName.propertyName}` と書くと、自動的に 0 番目の要素が参照されます。

#### リストの仕様

- **history**: `education`（学歴）と `work_experience`（職歴）を統合したリストです。オプションで「全体の末尾に「以上」を付ける」を有効にした場合、自動的に「学歴」「職歴」のヘッダー行や、「現在に至る」「以上」の行が適切な位置に挿入されます。
- **certificate**: `certificates` のリストです。末尾に「以上」が自動で挿入されます。

※ オプションで無効化できます。

##### e.g. 「学歴・職歴」の例

###### ExcelTemplate.xlsx

<table style="border-collapse: collapse; width: 100%;">
  <thead>
    <tr>
      <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">年</th>
      <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">月</th>
      <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">学歴・職歴</th>
      <th style="border: 1px solid #ccc; padding: 8px; border-left: none; border-right: none;">　</th>
      <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">年</th>
      <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">月</th>
      <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">学歴・職歴</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{history[0].year}</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{history[0].month}</td>
      <td style="border: 1px solid #ccc; padding: 8px;">{history[0].content}</td>
      <td style="border: 1px solid #ccc; padding: 8px; border-left: none; border-right: none;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{history[12].year}</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{history[12].month}</td>
      <td style="border: 1px solid #ccc; padding: 8px;">{history[12].content}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{history[1].year}</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{history[1].month}</td>
      <td style="border: 1px solid #ccc; padding: 8px;">{history[1].content}</td>
      <td style="border: 1px solid #ccc; padding: 8px; border-left: none; border-right: none;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{history[13].year}</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{history[13].month}</td>
      <td style="border: 1px solid #ccc; padding: 8px;">{history[13].content}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{history[2].year}</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{history[2].month}</td>
      <td style="border: 1px solid #ccc; padding: 8px;">{history[2].content}</td>
      <td style="border: 1px solid #ccc; padding: 8px; border-left: none; border-right: none;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{history[14].year}</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{history[14].month}</td>
      <td style="border: 1px solid #ccc; padding: 8px;">{history[14].content}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{history[3].year}</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{history[3].month}</td>
      <td style="border: 1px solid #ccc; padding: 8px;">{history[3].content}</td>
      <td style="border: 1px solid #ccc; padding: 8px; border-left: none; border-right: none;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{history[15].year}</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{history[15].month}</td>
      <td style="border: 1px solid #ccc; padding: 8px;">{history[15].content}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{history[4].year}</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{history[4].month}</td>
      <td style="border: 1px solid #ccc; padding: 8px;">{history[4].content}</td>
      <td style="border: 1px solid #ccc; padding: 8px; border-left: none; border-right: none;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{history[16].year}</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{history[16].month}</td>
      <td style="border: 1px solid #ccc; padding: 8px;">{history[16].content}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{history[5].year}</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{history[5].month}</td>
      <td style="border: 1px solid #ccc; padding: 8px;">{history[5].content}</td>
      <td style="border: 1px solid #ccc; padding: 8px; border-left: none; border-right: none;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{history[17].year}</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{history[17].month}</td>
      <td style="border: 1px solid #ccc; padding: 8px;">{history[17].content}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{history[6].year}</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{history[6].month}</td>
      <td style="border: 1px solid #ccc; padding: 8px;">{history[6].content}</td>
      <td style="border: 1px solid #ccc; padding: 8px; border-left: none; border-right: none;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{history[7].year}</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{history[7].month}</td>
      <td style="border: 1px solid #ccc; padding: 8px;">{history[7].content}</td>
      <td style="border: 1px solid #ccc; padding: 8px; border-left: none; border-right: none;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{history[8].year}</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{history[8].month}</td>
      <td style="border: 1px solid #ccc; padding: 8px;">{history[8].content}</td>
      <td style="border: 1px solid #ccc; padding: 8px; border-left: none; border-right: none;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{history[9].year}</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{history[9].month}</td>
      <td style="border: 1px solid #ccc; padding: 8px;">{history[9].content}</td>
      <td style="border: 1px solid #ccc; padding: 8px; border-left: none; border-right: none;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{history[10].year}</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{history[10].month}</td>
      <td style="border: 1px solid #ccc; padding: 8px;">{history[10].content}</td>
      <td style="border: 1px solid #ccc; padding: 8px; border-left: none; border-right: none;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{history[11].year}</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{history[11].month}</td>
      <td style="border: 1px solid #ccc; padding: 8px;">{history[11].content}</td>
      <td style="border: 1px solid #ccc; padding: 8px; border-left: none; border-right: none;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
    </tr>
  </tbody>
</table>

###### resume.yaml

``` yaml
education:
  - year: 2020
    month: 4
    content: 〇〇高等学校　入学
  - year: 2023
    month: 3
    content: 〇〇高等学校　卒業
  - year: 2023
    month: 4
    content: △△大学　入学
  - year: 2027
    month: 3
    content: △△大学　卒業
work_experience:
  - year: 2027
    month: 4
    content: □□株式会社　入社
  - year: 2030
    month: 3
    content: □□株式会社　退社
  - year: 2030
    month: 4
    content: ××株式会社　入社
  - year:
    month:
    content: 現在に至る
```

あるいは

``` yaml
education:
  - 2020/4/〇〇高等学校　入学
  - 2023/3/〇〇高等学校　卒業
  - 2023/4/△△大学　入学
  - 2027/3/△△大学　卒業
work_experience:
  - 2027/4/□□株式会社　入社
  - 2030/3/□□株式会社　退社
  - 2030/4/××株式会社　入社
  - / /現在に至る
```

###### 出力結果

<table style="border-collapse: collapse; width: 100%; border: 1px solid #ccc;">
  <thead>
    <tr>
      <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">年</th>
      <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">月</th>
      <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">学歴・職歴</th>
      <th style="border: 1px solid #ccc; padding: 8px; border-left: none; border-right: none;"></th>
      <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">年</th>
      <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">月</th>
      <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">学歴・職歴</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="border: 1px solid #ccc; padding: 8px;"></td>
      <td style="border: 1px solid #ccc; padding: 8px;"></td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">学歴</td>
      <td style="border: 1px solid #ccc; padding: 8px; border-left: none; border-right: none;"></td>
      <td style="border: 1px solid #ccc; padding: 8px;"></td>
      <td style="border: 1px solid #ccc; padding: 8px;"></td>
      <td style="border: 1px solid #ccc; padding: 8px;"></td>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">2020</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">4</td>
      <td style="border: 1px solid #ccc; padding: 8px;">〇〇高等学校　入学</td>
      <td style="border: 1px solid #ccc; padding: 8px; border-left: none; border-right: none;"></td>
      <td style="border: 1px solid #ccc; padding: 8px;"></td>
      <td style="border: 1px solid #ccc; padding: 8px;"></td>
      <td style="border: 1px solid #ccc; padding: 8px;"></td>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">2023</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">3</td>
      <td style="border: 1px solid #ccc; padding: 8px;">〇〇高等学校　卒業</td>
      <td style="border: 1px solid #ccc; padding: 8px; border-left: none; border-right: none;"></td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">2023</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">4</td>
      <td style="border: 1px solid #ccc; padding: 8px;">△△大学　入学</td>
      <td style="border: 1px solid #ccc; padding: 8px; border-left: none; border-right: none;"></td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">2027</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">3</td>
      <td style="border: 1px solid #ccc; padding: 8px;">△△大学　卒業</td>
      <td style="border: 1px solid #ccc; padding: 8px; border-left: none; border-right: none;"></td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">職歴</td>
      <td style="border: 1px solid #ccc; padding: 8px; border-left: none; border-right: none;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">2027</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">4</td>
      <td style="border: 1px solid #ccc; padding: 8px;">□□株式会社　入社</td>
      <td style="border: 1px solid #ccc; padding: 8px; border-left: none; border-right: none;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">2030</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">3</td>
      <td style="border: 1px solid #ccc; padding: 8px;">□□株式会社　退社</td>
      <td style="border: 1px solid #ccc; padding: 8px; border-left: none; border-right: none;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">2030</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">4</td>
      <td style="border: 1px solid #ccc; padding: 8px;">××株式会社　入社</td>
      <td style="border: 1px solid #ccc; padding: 8px; border-left: none; border-right: none;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">現在に至る</td>
      <td style="border: 1px solid #ccc; padding: 8px; border-left: none; border-right: none;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: right;">以上</td>
      <td style="border: 1px solid #ccc; padding: 8px; border-left: none; border-right: none;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px; border-left: none; border-right: none;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px; border-left: none; border-right: none;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
      <td style="border: 1px solid #ccc; padding: 8px;">　</td>
    </tr>
  </tbody>
</table>

## 使用方法

### 1. インストール・起動

```bash
npm install
npm run dev
```

#### その他のコマンド

- `npm run build`: 本番用ビルドを作成します。
- `npm run preview`: ビルドしたアプリケーションをプレビューします。
- `npm run lint`: コードの静的解析を実行します。

### 2. データの準備

`resume.yaml` を作成します。（サンプル: `example/sample.yaml`）

- 例えば、Excelテンプレートでの数式利用時、数式内の数値（例：`IF(A1=1, "有", "無")` の `1`）をマーカーで置換することも可能です。
- 写真（`portrait`）は、Shapeの名前や代替テキストに `{portrait}` と記述された箇所に挿入されます。

## 既知の問題 (Excelプレビュー)

Excelプレビュー機能（FortuneSheet）には、ライブラリの仕様により以下の制限があります。これらはプレビュー表示上の問題であり、**エクスポートされたファイルには影響しません**。

- **スクロール**: スクロールの挙動が不安定になる場合があります。
- **画像位置**: 証明写真の位置やサイズがずれて表示されることがあります。
- **フォント**: エクスポート結果と異なるフォントで表示される場合があります。
- **結合セル**: 一部の結合セルの描画が崩れる場合があります。

※ エクスポートにおいては、XMLを直接操作しているため、結合セルや画像位置などは正しく出力されます。

## ライセンス

本プロジェクトは [MIT License](./LICENSE.md) のもとで公開されています。
