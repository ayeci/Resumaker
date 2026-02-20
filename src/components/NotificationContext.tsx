/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */

import { createContext, useContext, useCallback, useState } from "react";

/**
 * 通知メッセージの型定義
 */
export type Message = {
    /** 重複排除用の一意な識別子 */
    id: string;
    severity: "success" | "error" | "warning";
    message: string;
};

/** Context型: 通知の追加関数 */
export interface NotificationContextType {
    /** 通知を追加する（同一IDは上書き） */
    notify: (id: string, severity: Message["severity"], content: string) => void;
}

export const NotificationContext = createContext<NotificationContextType | null>(null);

/**
 * 通知機能にアクセスするフック
 * NotificationProvider の子コンポーネント内で使用する
 * @returns notify(id, severity, content) 関数
 */
export const useNotification = (): NotificationContextType => {
    const ctx = useContext(NotificationContext);
    if (!ctx) {
        throw new Error("useNotification は NotificationProvider 内で使用してください");
    }
    return ctx;
};

/**
 * 通知状態を管理するカスタムフック（Provider内部用）
 */
export const useNotificationState = () => {
    /** 画面上に表示する通知（Mapで重複排除） */
    const [notifications, setNotifications] = useState<Map<string, Message>>(new Map());

    /** 通知を追加する（同一IDは上書き） */
    const notify = useCallback((id: string, severity: Message["severity"], content: string) => {
        setNotifications(prev => {
            const next = new Map(prev);
            next.set(id, { id, severity, message: content });
            return next;
        });
    }, []);

    /** 通知を閉じる */
    const handleClose = useCallback((id: string) => {
        setNotifications(prev => {
            const next = new Map(prev);
            next.delete(id);
            return next;
        });
    }, []);

    return { notifications, notify, handleClose };
};
