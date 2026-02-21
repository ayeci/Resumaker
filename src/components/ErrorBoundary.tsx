import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Box, Typography } from '@mui/material';

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
    }

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }
            return (
                <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', bgcolor: '#fff3f3', color: '#d32f2f', borderRadius: 2, textAlign: 'center' }}>
                    <Typography variant="h6" gutterBottom>
                        {this.props.message || 'プレビューの表示中にエラーが発生しました。'}
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', mt: 2, p: 2, bgcolor: '#ffeded', borderRadius: 1 }}>
                        {this.state.error?.message}
                    </Typography>
                </Box>
            );
        }

        return this.props.children;
    }
}
