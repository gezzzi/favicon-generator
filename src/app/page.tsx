"use client";

import { useState, useCallback, useRef, type DragEvent, type ChangeEvent } from "react";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

type OutputMode = "nextjs" | "general";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [radius, setRadius] = useState(40);
  const [appName, setAppName] = useState("My App");
  const [shortName, setShortName] = useState("App");
  const [themeColor, setThemeColor] = useState("#6366f1");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<{ nextjs: string; html: string } | null>(null);
  const [outputMode, setOutputMode] = useState<OutputMode>("nextjs");
  const [copied, setCopied] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((selectedFile: File) => {
    setError(null);
    setGeneratedCode(null);

    // ファイルタイプチェック
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"];
    if (!validTypes.includes(selectedFile.type)) {
      setError("PNG、JPG、またはSVGファイルを選択してください");
      return;
    }

    // サイズチェック
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("ファイルサイズは10MB以下にしてください");
      return;
    }

    setFile(selectedFile);
    
    // プレビュー生成
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(selectedFile);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFile(droppedFile);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFile(selectedFile);
    }
  }, [handleFile]);

  const handleGenerate = async () => {
    if (!file) return;

    setIsGenerating(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("radius", radius.toString());
      formData.append("appName", appName);
      formData.append("shortName", shortName);
      formData.append("themeColor", themeColor);

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "生成に失敗しました");
      }

      // ZIPをダウンロード
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().split("T")[0];
      a.href = url;
      a.download = `favicons-${date}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // コードを生成
      setGeneratedCode({
        nextjs: generateNextJsCode(themeColor, appName),
        html: generateHtmlTags(themeColor),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsGenerating(false);
    }
  };

  const generateNextJsCode = (color: string, name: string) => {
    return `// src/app/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "${name}",
  description: "Your app description",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
  },
  other: {
    "theme-color": "${color}",
    "msapplication-TileColor": "${color}",
  },
};`;
  };

  const generateHtmlTags = (color: string) => {
    return `<!-- Favicon -->
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png">

<!-- Apple Touch Icon -->
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">

<!-- Android Chrome -->
<link rel="icon" type="image/png" sizes="192x192" href="/android-chrome-192x192.png">
<link rel="icon" type="image/png" sizes="512x512" href="/android-chrome-512x512.png">

<!-- Web Manifest & OGP -->
<link rel="manifest" href="/site.webmanifest">
<meta property="og:image" content="/opengraph-image.png">

<!-- Theme Color -->
<meta name="theme-color" content="${color}">
<meta name="msapplication-TileColor" content="${color}">`;
  };

  const handleCopy = async () => {
    if (generatedCode) {
      const textToCopy = outputMode === "nextjs" ? generatedCode.nextjs : generatedCode.html;
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    setGeneratedCode(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const nextjsFiles = [
    { name: "src/app/", desc: "App Router用", isFolder: true },
    { name: "├─ icon.png", desc: "32×32 自動認識ファビコン" },
    { name: "├─ apple-icon.png", desc: "180×180 自動認識" },
    { name: "└─ favicon.ico", desc: "マルチサイズICO" },
    { name: "public/", desc: "静的ファイル", isFolder: true },
    { name: "├─ favicon.ico", desc: "16/32/48px マルチサイズ" },
    { name: "├─ favicon-16x16.png", desc: "16×16 PNG" },
    { name: "├─ favicon-32x32.png", desc: "32×32 PNG" },
    { name: "├─ favicon-48x48.png", desc: "48×48 PNG" },
    { name: "├─ apple-touch-icon.png", desc: "180×180 PNG" },
    { name: "├─ android-chrome-192x192.png", desc: "192×192 PNG" },
    { name: "├─ android-chrome-512x512.png", desc: "512×512 PNG" },
    { name: "└─ opengraph-image.png", desc: "1200×630 OGP画像" },
    { name: "site.webmanifest", desc: "PWA マニフェスト" },
    { name: "README.txt", desc: "使い方ガイド" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* ヘッダー */}
      <header className="border-b border-card-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent-dark flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Favicon Generator</h1>
              <p className="text-sm text-muted">Next.js App Router最適化 • 角丸透過ファビコン一式</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid gap-8">
          {/* アップロードエリア */}
          <section className="bg-card rounded-2xl border border-card-border p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-sm flex items-center justify-center font-bold">1</span>
              画像をアップロード
            </h2>
            
            {!preview ? (
              <div
                className={`drop-zone rounded-xl p-12 text-center cursor-pointer ${isDragOver ? "drag-over" : ""}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-card-border/50 flex items-center justify-center">
                    <svg className="w-8 h-8 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-foreground font-medium">ドラッグ&ドロップ</p>
                    <p className="text-muted text-sm mt-1">またはクリックしてファイルを選択</p>
                  </div>
                  <p className="text-muted text-xs">PNG, JPG, SVG（最大10MB）</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-6">
                  {/* プレビュー */}
                  <div className="flex-shrink-0">
                    <p className="text-sm text-muted mb-2">プレビュー</p>
                    <div className="checkerboard rounded-xl p-4 inline-block">
                      <img
                        src={preview}
                        alt="Preview"
                        className="max-w-48 max-h-48 object-contain"
                        style={{ borderRadius: `${Math.min(radius, 128)}px` }}
                      />
                    </div>
                  </div>
                  
                  {/* ファイル情報 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted mb-2">ファイル情報</p>
                    <div className="bg-background rounded-lg p-4 border border-card-border">
                      <p className="text-foreground font-medium truncate">{file?.name}</p>
                      <p className="text-muted text-sm mt-1">
                        {file && (file.size / 1024).toFixed(1)} KB • {file?.type.split("/")[1].toUpperCase()}
                      </p>
                    </div>
                    <button
                      onClick={handleReset}
                      className="mt-3 text-sm text-muted hover:text-foreground transition-colors"
                    >
                      別の画像を選択
                    </button>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 bg-error/10 border border-error/30 rounded-lg px-4 py-3 text-error text-sm">
                {error}
              </div>
            )}
          </section>

          {/* 設定 */}
          <section className="bg-card rounded-2xl border border-card-border p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-sm flex items-center justify-center font-bold">2</span>
              設定
            </h2>
            
            <div className="grid gap-6 md:grid-cols-2">
              {/* 角丸半径 */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-foreground mb-2">
                  角丸半径: {radius}px
                </label>
                <input
                  type="range"
                  min="0"
                  max="256"
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted mt-1">
                  <span>0 (角なし)</span>
                  <span>256 (最大)</span>
                </div>
              </div>

              {/* アプリ名 */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  アプリ名（manifest用）
                </label>
                <input
                  type="text"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  className="w-full bg-background border border-card-border rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:border-accent transition-colors"
                  placeholder="My App"
                />
              </div>

              {/* 短縮名 */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  短縮名（manifest用）
                </label>
                <input
                  type="text"
                  value={shortName}
                  onChange={(e) => setShortName(e.target.value)}
                  className="w-full bg-background border border-card-border rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:border-accent transition-colors"
                  placeholder="App"
                />
              </div>

              {/* テーマカラー */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  テーマカラー
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    className="w-12 h-10 rounded-lg cursor-pointer border border-card-border"
                  />
                  <input
                    type="text"
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    className="flex-1 bg-background border border-card-border rounded-lg px-4 py-2.5 text-foreground font-mono text-sm focus:outline-none focus:border-accent transition-colors"
                    placeholder="#6366f1"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* 生成ボタン */}
          <section>
            <button
              onClick={handleGenerate}
              disabled={!file || isGenerating}
              className="btn-primary w-full py-4 rounded-xl text-white font-semibold text-lg flex items-center justify-center gap-3"
            >
              {isGenerating ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  生成中...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  生成してZIPをダウンロード
                </>
              )}
            </button>
          </section>

          {/* コード出力 */}
          {generatedCode && (
            <section className="bg-card rounded-2xl border border-card-border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-success/20 text-success text-sm flex items-center justify-center">✓</span>
                  コード出力
                </h2>
                <div className="flex items-center gap-2">
                  {/* タブ切り替え */}
                  <div className="flex bg-background rounded-lg p-1 border border-card-border">
                    <button
                      onClick={() => setOutputMode("nextjs")}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        outputMode === "nextjs"
                          ? "bg-accent text-white"
                          : "text-muted hover:text-foreground"
                      }`}
                    >
                      Next.js
                    </button>
                    <button
                      onClick={() => setOutputMode("general")}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        outputMode === "general"
                          ? "bg-accent text-white"
                          : "text-muted hover:text-foreground"
                      }`}
                    >
                      HTML
                    </button>
                  </div>
                  <button
                    onClick={handleCopy}
                    className="btn-copy px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                  >
                    {copied ? (
                      <>
                        <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        コピー済
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        コピー
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              <pre className="code-block rounded-xl p-4 overflow-x-auto whitespace-pre text-foreground/80 text-sm">
                {outputMode === "nextjs" ? generatedCode.nextjs : generatedCode.html}
              </pre>
              
              {outputMode === "nextjs" ? (
                <div className="mt-4 space-y-3">
                  <div className="bg-accent/10 border border-accent/30 rounded-lg px-4 py-3">
                    <p className="text-sm text-foreground font-medium mb-1">📁 Next.js App Router向けファイル配置</p>
                    <p className="text-sm text-muted">
                      ZIPを展開し、<code className="bg-background px-1.5 py-0.5 rounded">src/app/</code> と <code className="bg-background px-1.5 py-0.5 rounded">public/</code> フォルダの中身をプロジェクトにコピーしてください。
                    </p>
                  </div>
                  <p className="text-sm text-muted">
                    <code className="bg-background px-1.5 py-0.5 rounded">icon.png</code> と <code className="bg-background px-1.5 py-0.5 rounded">apple-icon.png</code> は <code className="bg-background px-1.5 py-0.5 rounded">src/app/</code> に配置すると、Next.jsが自動的にファビコンとして認識します。
                  </p>
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted">
                  これらのタグを <code className="bg-background px-1.5 py-0.5 rounded">&lt;head&gt;</code> 内に追加し、生成されたファイルをプロジェクトの <code className="bg-background px-1.5 py-0.5 rounded">public/</code> に配置してください。
                </p>
              )}
            </section>
          )}

          {/* 生成物一覧 */}
          <section className="bg-card/50 rounded-2xl border border-card-border p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              生成されるファイル一覧
            </h2>
            <div className="grid gap-1.5 text-sm font-mono">
              {nextjsFiles.map((item, idx) => (
                <div 
                  key={idx} 
                  className={`flex items-center gap-3 px-3 py-1.5 rounded-lg ${
                    item.isFolder 
                      ? "bg-accent/10 text-accent font-semibold mt-2 first:mt-0" 
                      : "bg-background border border-card-border"
                  }`}
                >
                  <span className={`flex-1 ${item.isFolder ? "" : "text-foreground"}`}>
                    {item.name}
                  </span>
                  <span className={`text-xs ${item.isFolder ? "text-accent/70" : "text-muted"}`}>
                    {item.desc}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* 使い方ガイド */}
          <section className="bg-card/50 rounded-2xl border border-card-border p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Next.jsへの反映手順
            </h2>
            <ol className="space-y-3 text-sm text-muted">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center font-bold">1</span>
                <span>ダウンロードしたZIPファイルを展開</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center font-bold">2</span>
                <span>
                  <code className="bg-background px-1.5 py-0.5 rounded">src/app/</code> フォルダの中身をプロジェクトの <code className="bg-background px-1.5 py-0.5 rounded">src/app/</code> にコピー
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center font-bold">3</span>
                <span>
                  <code className="bg-background px-1.5 py-0.5 rounded">public/</code> フォルダの中身をプロジェクトの <code className="bg-background px-1.5 py-0.5 rounded">public/</code> にコピー
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center font-bold">4</span>
                <span>
                  <code className="bg-background px-1.5 py-0.5 rounded">site.webmanifest</code> を <code className="bg-background px-1.5 py-0.5 rounded">public/</code> にコピー
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center font-bold">5</span>
                <span>
                  <code className="bg-background px-1.5 py-0.5 rounded">layout.tsx</code> に上記のmetadataコードを追加（またはマージ）
                </span>
              </li>
            </ol>
          </section>
        </div>
      </main>

      {/* フッター */}
      <footer className="border-t border-card-border mt-16">
        <div className="max-w-4xl mx-auto px-6 py-6 text-center text-muted text-sm">
          Favicon Generator • Next.js App Router最適化 • ローカル専用ツール
        </div>
      </footer>
    </div>
  );
}
