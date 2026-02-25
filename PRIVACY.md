# Privacy Policy

**Effective Date:** February 24, 2026

## 1. Client-Side Only (ブラウザ完結型)

Resumaker is a "client-side only" application. This means that all processing related to your resume data happens entirely within your web browser.
Resumaker は「クライアントサイド完結型」のアプリケーションです。履歴書データに関するすべての処理は、ユーザーのウェブブラウザ内でのみ実行されます。

## 2. No Data Collection (データ収集なし)

We do not collect, store, or transmit any of your personal data to our servers or any third-party servers.
私たちは、ユーザーの個人情報をサーバーや第三者のサーバーに収集・保存・送信することは一切ありません。

## 3. No Tracking (トラッキングなし)

We do not use cookies or any third-party tracking tools (such as Google Analytics).
Cookie や、Google Analytics 等のサードパーティ製トラッキングツールは一切使用しておりません。

## 4. Data Persistence & Security (データの保存とセキュリティについて)

Your resume text data exists only in your browser's memory. We do not use `localStorage` or `sessionStorage` to persist your personal information.
ユーザーが入力した履歴書のテキストデータは、ブラウザのメモリ上にのみ存在します。個人情報を `localStorage` や `sessionStorage` に保存することはありません。

To prevent browser crashes due to memory limitations on mobile devices, uploaded **Template Files** are temporarily saved to the browser's internal storage (`IndexedDB`). However, we employ a strict **Volatile Encryption** mechanism to ensure zero-knowledge security:
モバイル端末等のメモリ不足によるブラウザのクラッシュを防ぐため、アップロードされた **「テンプレートファイル」** に限り、ブラウザの内部ストレージ（`IndexedDB`）へ一時的に退避保存しています。しかし、完全なセキュリティを保証するため、以下の **揮発性暗号化** メカニズムを採用しています：

- A one-time, throwaway encryption key (AES-GCM 256-bit) is generated in the RAM every time you open the app.
  アプリを開くたびに、メモリ（RAM）上に今回限りの使い捨て暗号化キー（AES-GCM 256bit）が生成されます。
- Template files are strongly encrypted with this key before being written to the storage.
  テンプレートファイルは、ストレージに書き込まれる直前にこのキーで強力に暗号化されます。
- **The moment you close the browser tab or refresh the page, the encryption key is permanently destroyed.**
  **ブラウザのタブを閉じるかページを更新した瞬間、この暗号化キーは電子的に完全に消滅します。**
- Any encrypted data remaining in the storage becomes mathematically impossible to decrypt, turning into useless random noise. It poses zero risk of data leakage, even on a shared device. The residual data is automatically cleaned up the next time the app is launched.
  ストレージに残された暗号化データは数学的に復元不可能（ただの乱数のゴミ）となるため、共有端末であっても情報漏洩のリスクは一切ありません。残存データは次回のアプリ起動時に自動的にクリーンアップされます。

## 5. PWA & Service Worker Cache (PWAとService Workerキャッシュについて)

Resumaker is a PWA (Progressive Web App). A Service Worker automatically caches the app's static files (HTML, CSS, JavaScript, etc.) to enable offline usage.
Resumaker はPWA（Progressive Web App）です。Service Worker がアプリの静的ファイル（HTML、CSS、JavaScript等）を自動的にキャッシュし、オフラインでの利用を可能にしています。

- The cache contains **only the application code itself**. Your personal resume data is never written to the Service Worker cache.
  キャッシュに保存されるのは **アプリケーションのコード（プログラム）のみ** であり、ユーザーの履歴書データがService Workerのキャッシュに書き込まれることは一切ありません。
- The cache is automatically updated when a new version of the app is deployed.
  キャッシュはアプリの新しいバージョンがデプロイされた際に自動的に更新されます。
- You can clear the cache at any time via your browser's settings (Site Settings → Clear Data).
  キャッシュはブラウザの設定（サイト設定 → データを削除）からいつでも消去できます。

## 6. Contact (お問い合わせ)

If you have any questions about this Privacy Policy, please contact us via the GitHub repository.
本プライバシーポリシーに関するご質問は、GitHubリポジトリを通じてお問い合わせください。

[https://github.com/ayeci/Resumaker](https://github.com/ayeci/Resumaker)
