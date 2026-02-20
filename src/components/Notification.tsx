/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */

import type { ReactNode } from "react";
import { Alert } from "@mui/material";
import styles from "./Notification.module.scss";
import { NotificationContext, useNotificationState } from "./NotificationContext";

/**
 * 通知機能を提供するプロバイダー
 * アプリケーションのルートで使用する
 */
export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { notifications, notify, handleClose } = useNotificationState();

    return (
        <NotificationContext.Provider value={{ notify }}>
            {children}
            {/* 通知表示エリア */}
            <aside className={styles.notification}>
                {[...notifications.values()].map((notif) => (
                    <Alert
                        key={notif.id}
                        severity={notif.severity}
                        onClose={() => handleClose(notif.id)}
                        sx={{ mb: 1, boxShadow: 3 }}
                        variant="filled"
                    >
                        {notif.message}
                    </Alert>
                ))}
            </aside>
        </NotificationContext.Provider>
    );
};