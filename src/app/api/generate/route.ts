import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import JSZip from "jszip";
import toIco from "to-ico";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// 生成するサイズ一覧（public/用）
const PUBLIC_SIZES = {
  "public/favicon-16x16.png": 16,
  "public/favicon-32x32.png": 32,
  "public/favicon-48x48.png": 48,
  "public/apple-touch-icon.png": 180,
  "public/android-chrome-192x192.png": 192,
  "public/android-chrome-512x512.png": 512,
  "public/opengraph-image.png": 1200, // OGP画像
};

// Next.js App Router用（src/app/用）
const APP_SIZES = {
  "src/app/icon.png": 32,           // ファビコン（自動認識）
  "src/app/apple-icon.png": 180,    // Apple Touch Icon（自動認識）
};

// ICOに含めるサイズ
const ICO_SIZES = [16, 32, 48];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("image") as File | null;
    const radiusStr = formData.get("radius") as string | null;
    const appName = (formData.get("appName") as string) || "My App";
    const shortName = (formData.get("shortName") as string) || "App";
    const themeColor = (formData.get("themeColor") as string) || "#6366f1";

    // バリデーション
    if (!file) {
      return NextResponse.json({ error: "画像ファイルが必要です" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "ファイルサイズは10MB以下にしてください" }, { status: 400 });
    }

    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: "PNG、JPG、またはSVGファイルのみ対応しています" }, { status: 400 });
    }

    const radius = Math.max(0, Math.min(256, Number(radiusStr) || 40));

    // ファイルをバッファに読み込み
    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // sharpで画像を読み込み、メタデータを取得
    let image = sharp(inputBuffer);
    const metadata = await image.metadata();

    // SVGの場合はラスタライズ
    if (file.type === "image/svg+xml") {
      // SVGを十分なサイズでラスタライズ
      image = sharp(inputBuffer, { density: 300 }).resize(1024, 1024, { fit: "inside" });
    }

    // RGBAに変換（透過を確保）
    image = image.ensureAlpha();

    // 入力画像の処理済みバッファを取得
    const { data: rawData, info } = await image.raw().toBuffer({ resolveWithObject: true });
    const { width, height } = info;

    // 角丸半径をクランプ（画像サイズの半分まで）
    const effectiveRadius = Math.min(radius, Math.floor(Math.min(width, height) / 2));

    // 角丸マスクを適用
    const processedBuffer = await applyRoundedCorners(rawData, width, height, effectiveRadius);

    // 処理済み画像を作成
    const processedImage = sharp(processedBuffer, {
      raw: { width, height, channels: 4 },
    }).png();

    // ZIPファイルを作成
    const zip = new JSZip();
    
    // フォルダを作成
    const publicFolder = zip.folder("public");
    const appFolder = zip.folder("src/app");

    // 各サイズのPNGを生成（public/用）
    const processedBuffer2 = await processedImage.toBuffer();
    
    for (const [filepath, size] of Object.entries(PUBLIC_SIZES)) {
      const filename = filepath.replace("public/", "");
      
      // OGP画像は1200x630の特殊サイズ
      let resized: Buffer;
      if (filename === "opengraph-image.png") {
        resized = await sharp(processedBuffer2)
          .resize(1200, 630, {
            fit: "contain",
            background: { r: 0, g: 0, b: 0, alpha: 0 },
            kernel: sharp.kernel.lanczos3,
          })
          .png()
          .toBuffer();
      } else {
        resized = await sharp(processedBuffer2)
          .resize(size, size, {
            fit: "cover",
            kernel: sharp.kernel.lanczos3,
          })
          .png()
          .toBuffer();
      }

      publicFolder?.file(filename, resized);
    }

    // Next.js App Router用ファイルを生成（src/app/用）
    for (const [filepath, size] of Object.entries(APP_SIZES)) {
      const filename = filepath.replace("src/app/", "");
      const resized = await sharp(processedBuffer2)
        .resize(size, size, {
          fit: "cover",
          kernel: sharp.kernel.lanczos3,
        })
        .png()
        .toBuffer();

      appFolder?.file(filename, resized);
    }

    // ICO用のPNGバッファを生成
    const icoInputBuffers: Buffer[] = [];
    for (const size of ICO_SIZES) {
      const resized = await sharp(processedBuffer2)
        .resize(size, size, {
          fit: "cover",
          kernel: sharp.kernel.lanczos3,
        })
        .png()
        .toBuffer();

      icoInputBuffers.push(resized);
    }

    // ICOを生成（public/とsrc/app/両方に配置）
    const icoBuffer = await toIco(icoInputBuffers);
    publicFolder?.file("favicon.ico", icoBuffer);
    appFolder?.file("favicon.ico", icoBuffer);

    // site.webmanifest を生成（public/に配置用）
    const manifest = {
      name: appName,
      short_name: shortName,
      icons: [
        {
          src: "/android-chrome-192x192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/android-chrome-512x512.png",
          sizes: "512x512",
          type: "image/png",
        },
      ],
      theme_color: themeColor,
      background_color: themeColor,
      display: "standalone",
    };
    publicFolder?.file("site.webmanifest", JSON.stringify(manifest, null, 2));

    // README.txt を生成
    const readme = `Favicon Generator - Next.js App Router最適化
========================================

このZIPには以下のファイルが含まれています：

【src/app/ フォルダ】Next.js App Router用（自動認識）
- icon.png           : 32x32 ファビコン（自動認識）
- apple-icon.png     : 180x180 Apple Touch Icon（自動認識）
- favicon.ico        : マルチサイズICO

【public/ フォルダ】静的ファイル
- favicon.ico        : マルチサイズICO (16x16, 32x32, 48x48)
- favicon-16x16.png  : 16x16 PNG
- favicon-32x32.png  : 32x32 PNG
- favicon-48x48.png  : 48x48 PNG
- apple-touch-icon.png : 180x180 PNG (iOS用)
- android-chrome-192x192.png : 192x192 PNG
- android-chrome-512x512.png : 512x512 PNG
- opengraph-image.png : 1200x630 PNG (OGP用)

【その他】
- site.webmanifest : PWAマニフェストファイル

========================================
Next.jsへの反映手順
========================================

1. ZIPを展開

2. src/app/ フォルダの中身をプロジェクトの src/app/ にコピー
   → icon.png, apple-icon.png, favicon.ico

3. public/ フォルダの中身をプロジェクトの public/ にコピー
   → すべてのPNG, ICO, webmanifest

4. site.webmanifest を public/ にコピー

5. layout.tsx に以下のmetadataを追加（またはマージ）：

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "${appName}",
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
    "theme-color": "${themeColor}",
    "msapplication-TileColor": "${themeColor}",
  },
};

========================================
設定情報
========================================
アプリ名: ${appName}
短縮名: ${shortName}
テーマカラー: ${themeColor}
角丸半径: ${effectiveRadius}px

生成日時: ${new Date().toLocaleString("ja-JP")}
`;

    zip.file("README.txt", readme);

    // ZIPを生成
    const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });

    // レスポンスを返す
    const date = new Date().toISOString().split("T")[0];
    return new Response(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="favicons-${date}.zip"`,
      },
    });
  } catch (error) {
    console.error("Error generating favicons:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ファビコンの生成中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

/**
 * 角丸マスクを適用する関数
 * 角の外側を透過にする
 */
async function applyRoundedCorners(
  data: Buffer,
  width: number,
  height: number,
  radius: number
): Promise<Buffer> {
  if (radius === 0) {
    return data;
  }

  const result = Buffer.from(data);
  const r = radius;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      // 各コーナーのチェック
      let shouldBeTransparent = false;

      // 左上
      if (x < r && y < r) {
        const dx = r - x;
        const dy = r - y;
        if (dx * dx + dy * dy > r * r) {
          shouldBeTransparent = true;
        }
      }

      // 右上
      if (x >= width - r && y < r) {
        const dx = x - (width - r - 1);
        const dy = r - y;
        if (dx * dx + dy * dy > r * r) {
          shouldBeTransparent = true;
        }
      }

      // 左下
      if (x < r && y >= height - r) {
        const dx = r - x;
        const dy = y - (height - r - 1);
        if (dx * dx + dy * dy > r * r) {
          shouldBeTransparent = true;
        }
      }

      // 右下
      if (x >= width - r && y >= height - r) {
        const dx = x - (width - r - 1);
        const dy = y - (height - r - 1);
        if (dx * dx + dy * dy > r * r) {
          shouldBeTransparent = true;
        }
      }

      if (shouldBeTransparent) {
        result[idx + 3] = 0; // アルファチャンネルを0に
      }
    }
  }

  return result;
}

