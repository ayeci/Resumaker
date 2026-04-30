import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Box, Button, Typography } from '@mui/material';

interface Props {
    children?: ReactNode;
    fallback?: ReactNode;
    message?: string;
    onReset?: () => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

// 旧版SWのキャッシュと新デプロイのチャンクハッシュ不一致で
// dynamic import が失敗した際、タブ単位で 1 回だけ自動リロードを行う。
// フラグはタブの寿命中保持し、無限リロードループを防ぐ。
const CHUNK_RELOAD_FLAG = 'resumaker:chunk-load-reload-attempted';

const isChunkLoadError = (error: Error | null | undefined): boolean => {
    if (!error) return false;
    const message = error.message || '';
    const name = error.name || '';
    return (
        name === 'ChunkLoadError' ||
        /Failed to fetch dynamically imported module/i.test(message) ||
        /Importing a module script failed/i.test(message) ||
        /Loading chunk \d+ failed/i.test(message) ||
        /error loading dynamically imported module/i.test(message)
    );
};

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        // 次回のレンダリングでフォールバックUIを表示するように状態を更新します
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // エラーレポートサービスにエラーを記録することもできます
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        if (isChunkLoadError(error)) {
            try {
                if (sessionStorage.getItem(CHUNK_RELOAD_FLAG)) return;
                sessionStorage.setItem(CHUNK_RELOAD_FLAG, '1');
                window.location.reload();
            } catch {
                // sessionStorage 不可の環境では自動リロードしない（ループ回避）
            }
        }
    }

    private handleManualReload = () => {
        // 手動リロードは sessionStorage フラグを触らない（自動リロードの再発火を防ぐ）
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }
            const chunkError = isChunkLoadError(this.state.error);
            const headline = this.props.message
                || (chunkError
                    ? '新しいバージョンへの更新が必要です。'
                    : 'プレビューの表示中にエラーが発生しました。');
            const detail = chunkError
                ? 'アプリの更新が配信されたため、古いリソースを取得できませんでした。再読み込みしてください。'
                : (this.state.error?.message ?? '');
            return (
                <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', bgcolor: '#fff3f3', color: '#d32f2f', borderRadius: 2, textAlign: 'center' }}>
                    <Typography variant="h6" gutterBottom>
                        {headline}
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', mt: 2, p: 2, bgcolor: '#ffeded', borderRadius: 1 }}>
                        {detail}
                    </Typography>
                    {chunkError && (
                        <Button onClick={this.handleManualReload} variant="contained" color="error" sx={{ mt: 2 }}>
                            再読み込み
                        </Button>
                    )}
                </Box>
            );
        }

        return this.props.children;
    }
}
