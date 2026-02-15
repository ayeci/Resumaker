/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */
import { useState, useRef, useEffect } from 'react';
import { Box, AppBar, Toolbar, Typography, Button, IconButton, ToggleButton, ToggleButtonGroup, CircularProgress, Menu, MenuItem, ButtonGroup, Checkbox, ListItemText, ListItemIcon, Divider } from '@mui/material';
import { Settings, Printer, ChevronLeft, ChevronRight, FileText, LayoutTemplate, FileUp, Upload, ChevronDown, Eye, EyeOff, Github, Shield, Menu as MenuIcon, Edit3 } from 'lucide-react';
import { ResumeEditor } from './components/Editor';
import { Preview } from './components/Preview';
import { useResume } from './context/ResumeHooks';
import { generateWordBlob, generateExcelBlob } from './utils/exporter';
import { ExportOptionDialog } from './components/ExportOptionDialog';
import { MobileMenu } from './components/MobileMenu';
import { PortraitUpload } from './components/PortraitUpload';
import styles from './App.module.scss';
import clsx from 'clsx';
import { dump } from 'js-yaml';
import PizZip from 'pizzip';
import { saveAs } from 'file-saver';

/**
 * アプリケーションのルートコンポーネント
 * レイアウトの構築、モード切り替え、エクスポート機能の呼び出しを行う
 */
function App() {
  const { resume, templates, addTemplates, selectedTemplateId, setSelectedTemplateId, previewMode, setPreviewMode, exportOptions, importData, toggleTemplateCheck } = useResume();
  const [isExporting, setIsExporting] = useState(false);
  const [optionDialogOpen, setOptionDialogOpen] = useState(false);
  const [editorWidth, setEditorWidth] = useState(500);
  const [showSource, setShowSource] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [templateMenuAnchorEl, setTemplateMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileView, setMobileView] = useState<'editor' | 'preview'>('editor');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const isResizing = useRef(false);
  const templateInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // ウィンドウサイズ監視
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
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
        alert('出力対象のテンプレートが選択されていません。');
        return;
      }

      if (targets.length === 1) {
        const t = targets[0];
        const blob = t.format === 'word'
          ? await generateWordBlob(resume, t.arrayBuffer, exportOptions)
          : await generateExcelBlob(resume, t.arrayBuffer, exportOptions);
        saveAs(blob, `resume_${t.name}`);
      } else {
        const zip = new PizZip();
        for (const t of targets) {
          const blob = t.format === 'word'
            ? await generateWordBlob(resume, t.arrayBuffer, exportOptions)
            : await generateExcelBlob(resume, t.arrayBuffer, exportOptions);
          const buffer = await blob.arrayBuffer();
          zip.file(t.name, buffer);
        }
        const content = zip.generate({ type: 'blob', compression: 'DEFLATE' });
        saveAs(content, 'resumes.zip');
      }
    } catch (e) {
      console.error(e);
      alert('エクスポートに失敗しました。');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportClick = (format?: 'template' | 'json' | 'yaml') => {
    handleMenuClose();
    if (!format) return;

    if (format === 'template') {
      handleExportTemplates();
      return;
    }

    if (format === 'json' || format === 'yaml') {
      const data = format === 'json' ? JSON.stringify(resume, null, 2) : dump(resume);
      const blob = new Blob([data], { type: 'text/plain' });
      saveAs(blob, `resume.${format}`);
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

  return (
    <Box className={styles.appContainer}>
      <AppBar position="static" color="default" elevation={1} className={clsx(styles.appHeader, "print-hidden")}>
        <Toolbar className={styles.headerToolbar}>
          <Box className={styles.headerLogoSection}>
            <LayoutTemplate size={24} className={styles.logoBefore} />
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

            <Button
              variant="outlined"
              size="small"
              startIcon={<Upload size={16} />}
              onClick={() => importInputRef.current?.click()}
              sx={{ height: '36.5px' }}
            >
              データ読込
            </Button>

            <Button
              variant="outlined"
              size="small"
              startIcon={<FileUp size={16} />}
              endIcon={templates.length > 0 ? <ChevronDown size={16} /> : null}
              onClick={(e) => templates.length === 0 ? handleLoadNewTemplate() : handleTemplateMenuOpen(e)}
              sx={{ height: '36.5px' }}
            >
              テンプレート読込
            </Button>
            <Menu
              anchorEl={templateMenuAnchorEl}
              open={Boolean(templateMenuAnchorEl)}
              onClose={handleTemplateMenuClose}
            >
              <MenuItem onClick={handleLoadNewTemplate}>
                <ListItemIcon><FileUp size={16} /></ListItemIcon>
                <ListItemText>新規読込</ListItemText>
              </MenuItem>
              {templates.length > 0 && <Divider />}
              {templates.map((t) => (
                <MenuItem key={t.id} onClick={() => toggleTemplateCheck(t.id)}>
                  <Checkbox checked={t.checked} size="small" />
                  <ListItemText primary={t.name} />
                </MenuItem>
              ))}
            </Menu>

            <ToggleButtonGroup value={previewMode} exclusive onChange={(_, mode) => mode && setPreviewMode(mode)} size="small" className={styles.modeToggleGroup} sx={{ height: '36.5px' }}>
              <ToggleButton value="standard" className={clsx(styles.modeToggleBtn, previewMode === 'standard' ? styles.active : styles.inactive)}><FileText size={16} className={styles.buttonIcon} />標準</ToggleButton>
              <ToggleButton value="template" className={clsx(styles.modeToggleBtn, previewMode === 'template' ? styles.active : styles.inactive)}><LayoutTemplate size={16} className={styles.buttonIcon} />テンプレート</ToggleButton>
            </ToggleButtonGroup>

            <ButtonGroup variant="contained" ref={anchorEl ? null : null} sx={{ height: '36.5px', boxShadow: 'none' }}>
              <Button startIcon={isExporting ? <CircularProgress size={16} color="inherit" /> : <Printer size={16} />} onClick={() => window.print()} disabled={isExporting}>PDF保存/印刷</Button>
              <Button size="small" onClick={handleMenuClick}>
                <ChevronDown size={16} />
              </Button>
            </ButtonGroup>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
            >
              <MenuItem onClick={() => handleExportClick('template')} sx={templates.filter(t => t.checked).length <= 0 ? { display: 'none' } : {}}>
                {`テンプレート形式で保存 (${templates.filter(t => t.checked).length}件)`}
              </MenuItem>
              <MenuItem onClick={() => handleExportClick('json')}>JSON形式で保存</MenuItem>
              <MenuItem onClick={() => handleExportClick('yaml')}>YAML形式で保存</MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      <Box className={styles.mainContent}>
        {(!isMobile || mobileView === 'editor') && showSource && (
          <>
            <Box className={clsx(styles.editorPane, "print-hidden")} style={{ width: isMobile ? '100%' : editorWidth }}>
              <ResumeEditor />
            </Box>
            {!isMobile && (
              <Box className={clsx(styles.resizeHandle, "print-hidden", isResizing.current ? styles.dragging : styles.default)} onMouseDown={startResizing} />
            )}
          </>
        )}
        {(!isMobile || mobileView === 'preview') && (
          <Box className={styles.previewPane}>
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
        <a href="https://github.com/AyeBee/Resumaker" target="_blank" rel="noopener noreferrer">
          <Github size={16} />
          <span>GitHub</span>
        </a>
        <a href="/PRIVACY.md" target="_blank" rel="noopener noreferrer">
          <Shield size={16} />
          <span>Privacy Policy</span>
        </a>
        <Typography variant="caption" sx={{ color: 'inherit' }}>© ayeci</Typography>
      </Box>

      {/* モバイル版フッター（タブバー） */}
      <Box className={clsx(styles.mobileFooter, "print-hidden")}>
        <PortraitUpload variant="tab" />
        <Box
          className={clsx(styles.mobileTabItem, mobileView === 'editor' && styles.active)}
          onClick={() => setMobileView('editor')}
        >
          <Edit3 size={24} />
          <Typography variant="caption">エディタ</Typography>
        </Box>
        <Box
          className={clsx(styles.mobileTabItem, mobileView === 'preview' && styles.active)}
          onClick={() => setMobileView('preview')}
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
        />
      )}

      <ExportOptionDialog open={optionDialogOpen} onClose={() => setOptionDialogOpen(false)} />
      <input type="file" title="テンプレートをロード" ref={templateInputRef} className={styles.hiddenInput} accept=".docx,.xlsx" multiple onChange={(e) => {
        if (e.target.files && e.target.files.length > 0) {
          addTemplates(Array.from(e.target.files));
          setPreviewMode('template');
        }
        e.target.value = '';
      }} />
      <input type="file" title="データを読み込む" ref={importInputRef} className={styles.hiddenInput} accept=".json,.yaml,.yml" onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const content = ev.target?.result as string;
            if (content) importData(content, 'auto');
          };
          reader.readAsText(file);
        }
        e.target.value = '';
      }} />
    </Box>
  );
}

export default App;
