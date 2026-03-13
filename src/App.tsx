/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */

import { useState, useRef, useEffect } from 'react';
import { Box, AppBar, Toolbar, Typography, Button, IconButton, ToggleButton, ToggleButtonGroup, CircularProgress, Menu, MenuItem, ButtonGroup, Checkbox, ListItemText, ListItemIcon, Divider, Tooltip } from '@mui/material';
import { Settings, Printer, ChevronLeft, ChevronRight, FileText, LayoutTemplate, FileUp, Upload, Download, ChevronDown, Eye, EyeOff, Shield, Menu as MenuIcon, Edit3, Trash2 } from 'lucide-react';
import { FaGithub } from "react-icons/fa";
import { ResumeEditor } from './components/Editor';
import { Preview } from './components/Preview';
import { useResume } from './context/ResumeHooks';
import { generateWordBlob, generateExcelBlob } from './utils/exporter';
import { ExportOptionDialog } from './components/ExportOptionDialog';
import { MobileMenu } from './components/MobileMenu';
import { PortraitUpload } from './components/PortraitUpload';
import styles from './App.module.scss';
import clsx from 'clsx';
import PizZip from 'pizzip';
import { saveAs } from 'file-saver';
import { NotificationProvider } from './components/Notification';
import { useNotification } from './components/NotificationContext';
import { templateFileStore } from './store/fileStore';
import { checkIsMobile, checkNeedsLimit } from './utils/device';
import { SESSION_KEYS } from './utils/sessionKeys';

const MAX_TEMPLATES = 5;
/**
 * アプリケーションのルートコンポーネント
 * レイアウトの構築、モード切り替え、エクスポート機能の呼び出しを行う
 */
function AppContent() {
  const { resume, templates, addTemplates, removeTemplate, selectedTemplateId, setSelectedTemplateId, previewMode, setPreviewMode, exportOptions, importData, toggleTemplateCheck, rawText, setPortraitFile } = useResume();



  const [isExporting, setIsExporting] = useState(false);
  const [optionDialogOpen, setOptionDialogOpen] = useState(false);
  const [editorWidth, setEditorWidth] = useState(500);
  const [showSource, setShowSource] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [templateMenuAnchorEl, setTemplateMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileView, setMobileView] = useState<'editor' | 'preview'>('editor');
  // モバイル判定
  const [isMobile, setIsMobile] = useState(checkIsMobile());
  const [editorFontSize, setEditorFontSize] = useState(14);
  const [isDragging, setIsDragging] = useState(false);

  const isResizing = useRef(false);
  const dragCounter = useRef(0);
  const templateInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // 通知フック
  const { notify, closeNotification } = useNotification();

  // OOM（メモリ不足）による強制リロードの検知（生存フラグ方式）
  useEffect(() => {
    const aliveFlag = sessionStorage.getItem(SESSION_KEYS.ALIVE);
    const heavyTaskFlag = sessionStorage.getItem(SESSION_KEYS.HEAVY_TASK);
    const bgKillFlag = sessionStorage.getItem(SESSION_KEYS.BG_KILL);
    const pickingFileFlag = sessionStorage.getItem(SESSION_KEYS.PICKING_FILE);
    const intentionalReloadFlag = sessionStorage.getItem(SESSION_KEYS.INTENTIONAL_RELOAD);

    // ALIVEフラグが残っている = 前回のセッションが正常終了していない
    // かつ、意図的なリロードでもない場合のみクラッシュと判定
    if (aliveFlag && !intentionalReloadFlag) {
      if (heavyTaskFlag) {
        notify("crash-detected", "error", "プレビュー処理中にメモリ限界に達したため、画面が再読み込みされました。");
      } else if (pickingFileFlag) {
        notify("crash-detected", "error", "ファイル読み込み時にメモリ限界に達したため、画面が再読み込みされました。大量のファイルを選択すると発生しやすくなります。");
      } else if (bgKillFlag) {
        notify("bg-kill-detected", "warning", "バックグラウンド待機中にOSによってメモリが解放されたため、画面が初期化されました。");
      }
    }

    // 表示（判定）が終わったらフラグをすべて掃除する
    sessionStorage.removeItem(SESSION_KEYS.HEAVY_TASK);
    sessionStorage.removeItem(SESSION_KEYS.BG_KILL);
    sessionStorage.removeItem(SESSION_KEYS.PICKING_FILE);
    sessionStorage.removeItem(SESSION_KEYS.INTENTIONAL_RELOAD);

    // 生存フラグをセット（次回起動時の判定に使用）
    sessionStorage.setItem(SESSION_KEYS.ALIVE, 'true');

    // --- バックグラウンド・リロード・遷移の検知 ---
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // ファイルピッカーを開く操作をしていなければ、純粋なバックグラウンド移行とみなす
        if (!sessionStorage.getItem(SESSION_KEYS.PICKING_FILE)) {
          sessionStorage.setItem(SESSION_KEYS.BG_KILL, 'true');
        }
      } else {
        // キルされずに無事に戻ってきたらフラグを下ろす
        sessionStorage.removeItem(SESSION_KEYS.BG_KILL);
        // ファイルピッカーフラグも、戻ってきて少し経ったら消す（キャンセル時の対応）
        // 500ms 程度が適切（OSのピッカーが戻る際のタイムラグを考慮）
        setTimeout(() => {
          sessionStorage.removeItem(SESSION_KEYS.PICKING_FILE);
        }, 500);
      }
    };

    const handleBeforeUnload = () => {
      // ユーザー自らリロードや移動をしようとした場合にフラグを立てる
      // ファイル選択中や重い処理中のクラッシュ死に際に呼ばれた場合は、意図的とはみなさない（隠蔽しない）
      if (!sessionStorage.getItem(SESSION_KEYS.PICKING_FILE) && !sessionStorage.getItem(SESSION_KEYS.HEAVY_TASK)) {
        sessionStorage.setItem(SESSION_KEYS.INTENTIONAL_RELOAD, 'true');
      }
    };

    const handlePopState = () => {
      // 戻る/進むボタンでの遷移も意図的な離脱として扱う（将来のルーティング対応）
      sessionStorage.setItem(SESSION_KEYS.INTENTIONAL_RELOAD, 'true');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [notify]);

  // ズーム防止
  useEffect(() => {
    // SafariはCSSのtouch-actionを無視する場合があるため、JSで止める
    const handleGestureStart = (e: Event) => {
      e.preventDefault();
    };

    // トラックパッドのピンチ操作も「Ctrl + ホイール」として判定されることが多い
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };

    // ダブルタップズーム防止（念のため）
    let lastTouchEnd = 0;
    const handleTouchEnd = (e: TouchEvent) => {
      const now = new Date().getTime();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };

    // イベント登録（passive: false が重要）
    // document全体に対して設定
    document.addEventListener('gesturestart', handleGestureStart);
    document.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      // クリーンアップ
      document.removeEventListener('gesturestart', handleGestureStart);
      document.removeEventListener('wheel', handleWheel);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  // テンプレート変更やモード変更時に通知をクリア
  useEffect(() => {
    closeNotification();
  }, [selectedTemplateId, previewMode, closeNotification]);

  // ウィンドウサイズ監視
  useEffect(() => {
    const handleResize = () => {
      const mobile = checkIsMobile();
      setIsMobile(mobile);
      if (!mobile && !showSource) setShowSource(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [showSource]);

  // プレビュー表示対象はチェックが入っているもののみ
  const visibleTemplates = templates.filter(t => t.checked);

  const handleMenuClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleTemplateMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setTemplateMenuAnchorEl(event.currentTarget);
  };

  const handleTemplateMenuClose = () => {
    setTemplateMenuAnchorEl(null);
  };

  const handleLoadNewTemplate = () => {
    handleTemplateMenuClose();
    templateInputRef.current?.click();
  };

  const handleExportTemplates = async () => {
    setIsExporting(true);
    try {
      const targets = templates.filter(t => t.checked);
      if (targets.length === 0) {
        notify("no-template-selected", "error", "出力対象のテンプレートが選択されていません。");
        return;
      }

      const generateTemplateBlob = async (t: typeof templates[0]) => {
        const fileData = await templateFileStore.get(t.id);
        if (!fileData) {
          notify("template-not-found", "error", `テンプレート ${t.name} が見つかりませんでした。`);
          return null;
        }

        let buffer: ArrayBuffer;
        if (fileData.data instanceof ArrayBuffer) {
          buffer = fileData.data;
        } else {
          buffer = await (fileData.data as File | Blob).arrayBuffer();
        }

        return t.format === 'excel'
          ? await generateExcelBlob(resume, buffer, exportOptions)
          : await generateWordBlob(resume, buffer, exportOptions);
      };

      if (targets.length === 1) {
        // 1件のみエクスポートの場合

        const t = targets[0];
        const blob = await generateTemplateBlob(t);
        if (blob) saveAs(blob, `resume_${t.name}`);

      } else {
        // 複数件をZIPでエクスポートの場合

        const zip = new PizZip();
        for (const t of targets) {
          const blob = await generateTemplateBlob(t);
          if (blob) {
            const bufferToUse = await blob.arrayBuffer();
            zip.file(t.name, bufferToUse);
          }
        }
        const content = zip.generate({ type: 'blob', compression: 'DEFLATE' });
        saveAs(content, 'resumes.zip');
      }
    } catch (e) {
      console.error(e);
      notify("export-error", "error", "エクスポートに失敗しました。");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportClick = (format?: 'template' | 'jsonc' | 'yaml') => {
    handleMenuClose();
    if (!format) return;

    if (format === 'template') {
      handleExportTemplates();
      return;
    }

    if (format === 'jsonc' || format === 'yaml') {
      const blob = new Blob([rawText], { type: 'text/plain;charset=utf-8' });
      const ext = format === 'jsonc' ? 'json' : format;
      saveAs(blob, `resume.${ext}`);
    }
  };

  const startResizing = () => {
    isResizing.current = true;
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = e.clientX;
      if (newWidth > 300 && newWidth < window.innerWidth - 300) setEditorWidth(newWidth);
    };
    const stopResizing = () => {
      isResizing.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stopResizing);
      document.body.style.cursor = 'default';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'col-resize';
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const imageFile = files.find(f => f.type.startsWith('image/'));
      const dataFile = files.find(f => /\.(json|jsonc|yaml|yml)$/i.test(f.name));
      const templateFiles = files.filter(f => /\.(docx|xlsx)$/i.test(f.name));

      let processed = false;

      // 画像の処理
      if (imageFile) {
        setPortraitFile(imageFile);
        processed = true;
      }

      // データの処理
      if (dataFile) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const content = ev.target?.result as string;
          if (content) importData(content, 'auto');
        };
        reader.readAsText(dataFile);
        processed = true;
      }

      // テンプレートの処理
      if (templateFiles.length > 0) {
        sessionStorage.setItem(SESSION_KEYS.HEAVY_TASK, 'true');
        setSelectedTemplateId(null);
        setPreviewMode('standard');

        const needsLimit = checkNeedsLimit();
        const filesToProcess = needsLimit && templateFiles.length > MAX_TEMPLATES
          ? templateFiles.slice(0, MAX_TEMPLATES)
          : templateFiles;

        if (needsLimit && templateFiles.length > MAX_TEMPLATES) {
          notify("template-limit-reached", "warning", `先頭の${MAX_TEMPLATES}件のみ読み込みました。モバイル環境ではメモリの制約のため一度に読み込めるテンプレートが制限されます。`);
        }

        try {
          for (let i = 0; i < filesToProcess.length; i++) {
            await addTemplates([filesToProcess[i]]);
            if (needsLimit) {
              await new Promise(r => setTimeout(r, 500));
            }
          }
          setPreviewMode('template');
          if (!needsLimit) {
            setMobileView('preview');
          } else {
            setMobileView('editor');
          }
        } finally {
          // 何もしない
        }
        processed = true;
      }

      if (processed) {
        notify("file-dropped", "success", "ファイルを読み込みました。");
      } else {
        notify("drop-no-match", "warning", "対応していないファイル形式です。");
      }
    }
  };

  return (
    <Box 
      className={styles.appContainer}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <Box className={styles.dragOverlay}>
          <FileUp size={64} className={styles.dragOverlayIcon} />
          <Typography className={styles.dragOverlayText}>
            ファイルをドロップして読み込む
          </Typography>
        </Box>
      )}
      <AppBar position="static" color="default" elevation={1} className={clsx(styles.appHeader, "print-hidden")}>
        <Toolbar className={styles.headerToolbar}>
          <Box className={styles.headerLogoSection}>
            <img src={import.meta.env.BASE_URL + 'favicon.svg'} title="Resumaker logo" alt="Resumaker logo" className={styles.logoBefore} />
            <Typography variant="h6" component="div" sx={{ fontWeight: 700 }}>
              <span className={styles.logoTextBefore}>Resu</span>
              <span className={styles.logoTextAfter}>maker</span>
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <ToggleButton
              value="source"
              selected={showSource}
              onChange={() => setShowSource(!showSource)}
              size="small"
              sx={{ border: 'none', minWidth: '40px', height: '36.5px' }}
            >
              {showSource ? <Eye size={20} /> : <EyeOff size={20} />}
            </ToggleButton>

            <IconButton onClick={() => setOptionDialogOpen(true)} size="small" sx={{ height: '36.5px', width: '36.5px' }}>
              <Settings size={20} />
            </IconButton>

            <Tooltip title="YAML/JSON形式の履歴データを読み込みます" arrow>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Upload size={16} />}
                onClick={() => importInputRef.current?.click()}
                sx={{ height: '36.5px' }}
              >
                履歴データを開く
              </Button>
            </Tooltip>

            <Tooltip title="DOCX/XLSX形式のテンプレートを読み込みます" arrow>
              <Button
                variant="outlined"
                size="small"
                startIcon={<FileUp size={16} />}
                endIcon={templates.length > 0 ? <ChevronDown size={16} /> : null}
                onClick={(e) => templates.length === 0 ? handleLoadNewTemplate() : handleTemplateMenuOpen(e)}
                sx={{ height: '36.5px' }}
              >
                テンプレート{templates.length === 0 ? "を開く" : "を選択"}
              </Button>
            </Tooltip>
            <Menu
              anchorEl={templateMenuAnchorEl}
              open={Boolean(templateMenuAnchorEl)}
              onClose={handleTemplateMenuClose}
            >
              <MenuItem onClick={handleLoadNewTemplate}>
                <ListItemIcon><FileUp size={16} /></ListItemIcon>
                <ListItemText>新規に開く</ListItemText>
              </MenuItem>
              {templates.length > 0 && <Divider />}
              {templates.map((t) => (
                <MenuItem
                  key={t.id}
                  selected={t.id === selectedTemplateId}
                  sx={{ py: 0.5, pr: 1 }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <Checkbox
                      checked={t.checked}
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTemplateCheck(t.id);
                      }}
                    />
                    <Box
                      sx={{ flexGrow: 1, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mr: 1 }}
                      onClick={() => {
                        setSelectedTemplateId(t.id);
                        setPreviewMode('template');
                      }}
                    >
                      <ListItemText
                        primary={t.name}
                        slotProps={{ primary: { variant: 'body2' } }}
                      />
                    </Box>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTemplate(t.id);
                      }}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </Box>
                </MenuItem>
              ))}
            </Menu>

            <Tooltip title={templates.length === 0 ? 'テンプレートを開くと切り替え可能になります' : ''} arrow>
              <ToggleButtonGroup value={previewMode} exclusive onChange={(_, mode) => mode && setPreviewMode(mode)} size="small" className={styles.modeToggleGroup} sx={{ height: '36.5px', ...(templates.length === 0 && { pointerEvents: 'auto', cursor: 'default' }) }}>
                <ToggleButton value="standard" disabled={templates.length === 0} className={clsx(styles.modeToggleBtn, previewMode === 'standard' ? styles.active : styles.inactive)} sx={templates.length === 0 ? { pointerEvents: 'none' } : {}}><FileText size={16} className={styles.buttonIcon} />標準</ToggleButton>
                <ToggleButton value="template" disabled={templates.length === 0} className={clsx(styles.modeToggleBtn, previewMode === 'template' ? styles.active : styles.inactive)} sx={templates.length === 0 ? { pointerEvents: 'none' } : {}}><LayoutTemplate size={16} className={styles.buttonIcon} />テンプレート</ToggleButton>
              </ToggleButtonGroup>
            </Tooltip>

            {templates.length === 0 ? (
              /* テンプレート未読込時は PDF保存がメイン（単一ボタン） */
              <Button
                variant="contained"
                startIcon={isExporting ? <CircularProgress size={16} color="inherit" /> : <Printer size={16} />}
                onClick={() => window.print()}
                disabled={isExporting}
                sx={{ height: '36.5px', boxShadow: 'none' }}
              >
                PDF保存/印刷
              </Button>
            ) : (
              /* テンプレート読込済み時は テンプレート形式で保存がメイン（スプリットボタン） */
              <ButtonGroup variant="contained" sx={{ height: '36.5px', boxShadow: 'none' }}>
                <Button
                  startIcon={isExporting ? <CircularProgress size={16} color="inherit" /> : <Download size={16} />}
                  onClick={() => handleExportTemplates()}
                  disabled={isExporting}
                >
                  テンプレート形式で保存
                </Button>
                <Button
                  size="small"
                  onClick={handleMenuClick}
                  sx={{ px: 1, minWidth: 0 }}
                >
                  <ChevronDown size={16} />
                </Button>
              </ButtonGroup>
            )}

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
              {/* テンプレートがある場合のみプルダウンにPDF保存が入る */}
              {templates.length > 0 && (
                <MenuItem onClick={() => { handleMenuClose(); window.print(); }}>
                  <ListItemIcon><Printer size={18} /></ListItemIcon>
                  <ListItemText primary="PDF保存/印刷" />
                </MenuItem>
              )}
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      <Box className={styles.mainContent}>
        {(!isMobile || mobileView === 'editor') && showSource && (
          <Box
            className={clsx(styles.editorPane, "print-hidden")}
            style={{
              display: 'block',
              width: isMobile ? '100%' : editorWidth
            }}
          >
            <ResumeEditor fontSize={editorFontSize} setFontSize={setEditorFontSize} />
          </Box>
        )}

        {!isMobile && (
          <Box className={clsx(styles.resizeHandle, "print-hidden", isResizing.current ? styles.dragging : styles.default)} onMouseDown={startResizing} />
        )}

        {(!isMobile || mobileView === 'preview') && (
          <Box
            className={styles.previewPane}
            style={{
              display: 'flex'
            }}
          >
            {/* モバイル版: プレビューモード切替トグル */}
            {isMobile && templates.length > 0 && (
              <Box className={clsx(styles.mobilePreviewToggle, "print-hidden")}>
                <Box
                  className={clsx(styles.toggleOption, previewMode === 'standard' && styles.active)}
                  onClick={() => setPreviewMode('standard')}
                >
                  <FileText size={14} />
                  <span>標準</span>
                </Box>
                <Box
                  className={clsx(styles.toggleOption, previewMode === 'template' && styles.active)}
                  onClick={() => setPreviewMode('template')}
                >
                  <LayoutTemplate size={14} />
                  <span>テンプレート</span>
                </Box>
              </Box>
            )}
            {previewMode === 'template' && visibleTemplates.length > 1 && (
              <>
                <div className={styles.templateNavPrevContainer}>
                  <IconButton className={clsx(styles.templateNavBtn, styles.templateNavPrev, "print-hidden")} onClick={() => {
                    const i = visibleTemplates.findIndex(t => t.id === selectedTemplateId);
                    const prevIndex = i === -1 ? 0 : (i - 1 + visibleTemplates.length) % visibleTemplates.length;
                    setSelectedTemplateId(visibleTemplates[prevIndex].id);
                  }}><ChevronLeft /></IconButton>
                </div>
                <div className={styles.templateNavNextContainer}>
                  <IconButton className={clsx(styles.templateNavBtn, styles.templateNavNext, "print-hidden")} onClick={() => {
                    const i = visibleTemplates.findIndex(t => t.id === selectedTemplateId);
                    const nextIndex = i === -1 ? 0 : (i + 1) % visibleTemplates.length;
                    setSelectedTemplateId(visibleTemplates[nextIndex].id);
                  }}><ChevronRight /></IconButton>
                </div>
              </>
            )}
            <Box className={clsx(styles.previewScrollArea, previewMode === 'template' && styles.templateScroll)}>
              <Preview />
            </Box>
          </Box>
        )}
      </Box>

      {/* PC版フッター */}
      <Box component="footer" className={clsx(styles.appFooter, "print-hidden")}>
        <Typography variant="caption" sx={{ color: 'inherit', marginBottom: '-0.2rem' }}>Copyright © 2026 ayeci</Typography>
        <a href="https://github.com/ayeci/Resumaker" target="_blank" rel="noopener noreferrer">
          <FaGithub size={16} />
          <span>GitHub</span>
        </a>
        <a href="https://github.com/ayeci/Resumaker/blob/main/PRIVACY.md" target="_blank" rel="noopener noreferrer">
          <Shield size={16} />
          <span>Privacy Policy</span>
        </a>
        <a href="https://github.com/ayeci/Resumaker/raw/refs/heads/main/example/sample.zip" target="_blank" rel="noopener noreferrer">
          <Download size={16} />
          <span>サンプルファイルをダウンロード</span>
        </a>
      </Box>

      {/* モバイル版フッター（タブバー） */}
      <Box className={clsx(styles.mobileFooter, "print-hidden")}>
        <PortraitUpload variant="tab" />
        <Box
          className={clsx(styles.mobileTabItem, mobileView === 'editor' && styles.active)}
          onClick={() => {
            setMobileView('editor');
            closeNotification();
          }}
        >
          <Edit3 size={24} />
          <Typography variant="caption">エディタ</Typography>
        </Box>
        <Box
          className={clsx(styles.mobileTabItem, mobileView === 'preview' && styles.active)}
          onClick={() => {
            setMobileView('preview');
            closeNotification();
            // FortuneSheetがdisplay:noneから復帰した際に正しく再描画されるようにリサイズイベントを発火
            setTimeout(() => window.dispatchEvent(new Event('resize')), 10);
          }}
        >
          <Eye size={24} />
          <Typography variant="caption">プレビュー</Typography>
        </Box>
        <Box className={styles.mobileTabItem} onClick={() => setMobileMenuOpen(true)}>
          <MenuIcon size={24} />
          <Typography variant="caption">メニュー</Typography>
        </Box>
      </Box>

      {/* モバイルメニューオーバーレイ */}
      {mobileMenuOpen && (
        <MobileMenu
          onClose={() => setMobileMenuOpen(false)}
          onPrint={() => window.print()}
          onExport={handleExportClick}
          onImport={() => importInputRef.current?.click()}
          onLoadTemplate={() => templateInputRef.current?.click()}
          onOpenSettings={() => setOptionDialogOpen(true)}
          editorFontSize={editorFontSize}
          setEditorFontSize={setEditorFontSize}
        />
      )}

      <ExportOptionDialog open={optionDialogOpen} onClose={() => setOptionDialogOpen(false)} />
      <input type="file" title="テンプレートをロード" ref={templateInputRef} className={styles.hiddenInput} accept=".docx,.xlsx" multiple onClick={(e) => {
        (e.target as HTMLInputElement).value = '';
        // ピッカーを開く直前にフラグを立てる
        sessionStorage.setItem(SESSION_KEYS.PICKING_FILE, 'true');
      }} onChange={async (e) => {
        const targetInput = e.target as HTMLInputElement;
        const files = targetInput.files;

        if (!files || files.length === 0) {
          sessionStorage.removeItem(SESSION_KEYS.PICKING_FILE);
          return;
        }

        // File オブジェクトをコピーしてから、DOM の FileList 参照を即座に解放
        // Android Chrome ではファイルピッカーの FileList がメモリを保持し続けるため
        const filesArray: (File | null)[] = Array.from(files);
        targetInput.value = ''; // FileList を解放（処理に先行して実行）

        setSelectedTemplateId(null);
        setPreviewMode('standard');

        sessionStorage.setItem(SESSION_KEYS.HEAVY_TASK, 'true');
        sessionStorage.removeItem(SESSION_KEYS.PICKING_FILE);

        const needsLimit = checkNeedsLimit();

        if (needsLimit && filesArray.length > MAX_TEMPLATES) {
          notify("template-limit-reached", "warning", `先頭の${MAX_TEMPLATES}件のみ読み込みました。モバイル環境ではメモリの制約のため一度に読み込めるテンプレートが制限されます。`);
          filesArray.length = MAX_TEMPLATES; // splice で不要な参照を即座に切る
        }

        try {
          const needsLimitFlag = checkNeedsLimit();

          // 5件一括ではなく、1件ずつaddTemplatesを呼び出すことでクラッシュを防止
          // 理由: 1つの async 関数クロージャ内で全ファイルを処理すると、
          // V8 のアクティベーションレコードがすべてのローカル変数を
          // await 間で保持し続け、GC が効かずメモリスパイクが発生する。
          // 1件ずつ呼び出せば各 async クロージャは return 後に即座に GC 対象になる。
          for (let i = 0; i < filesArray.length; i++) {
            const file = filesArray[i];
            if (!file) continue;
            filesArray[i] = null; // File 参照を先に切断

            await addTemplates([file]);

            // モバイルではGCに十分な時間を与える
            if (needsLimitFlag) {
              await new Promise(r => setTimeout(r, 500));
            }
          }

          setPreviewMode('template');
          if (!needsLimitFlag) {
            setMobileView('preview');
          } else {
            setMobileView('editor');
          }
        } finally {
          filesArray.length = 0;
        }
      }} />
      <input type="file" title="データを読み込む" ref={importInputRef} className={styles.hiddenInput} accept=".json,.jsonc,.yaml,.yml" onClick={(e) => {
        (e.target as HTMLInputElement).value = '';
        // ピッカーを開く直前にフラグを立てる
        sessionStorage.setItem(SESSION_KEYS.PICKING_FILE, 'true');
      }} onChange={(e) => {
        // キャンセルまたは選択完了時に消す
        sessionStorage.removeItem(SESSION_KEYS.PICKING_FILE);

        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const content = ev.target?.result as string;
            if (content) importData(content, 'auto');
          };
          reader.readAsText(file);
        }
      }} />
    </Box>
  );
}

function App() {
  return (
    <NotificationProvider>
      <AppContent />
    </NotificationProvider>
  );
}
export default App;
