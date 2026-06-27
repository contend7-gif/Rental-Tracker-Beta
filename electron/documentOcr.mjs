import { ipcMain } from "electron";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const DOCUMENT_OCR_SUPPORTED_CHANNEL = "document-ocr:supported";
const DOCUMENT_OCR_EXTRACT_CHANNEL = "document-ocr:extract";
const OCR_TIMEOUT_MS = 120000;
const OCR_MAX_PDF_PAGES = 8;
const OCR_TEMP_DIR = path.join(os.tmpdir(), "rental-tracker-ocr");

function getPowershellPath() {
  return process.env.SystemRoot
    ? path.join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
    : "powershell.exe";
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;,]+)?;base64,(.+)$/s);
  if (!match) {
    throw new Error("Document OCR expects a base64 data URL.");
  }

  return {
    mimeType: String(match[1] || "application/octet-stream").toLowerCase(),
    buffer: Buffer.from(match[2], "base64"),
  };
}

function extensionForMimeType(mimeType, fileName = "") {
  const normalizedMime = String(mimeType || "").trim().toLowerCase();
  const explicitExtension = path.extname(String(fileName || "")).toLowerCase();
  if (explicitExtension) return explicitExtension;

  const mimeExtensionMap = {
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp",
    "image/bmp": ".bmp",
    "image/gif": ".gif",
    "image/tif": ".tif",
    "image/tiff": ".tiff",
  };

  return mimeExtensionMap[normalizedMime] || ".bin";
}

function sanitizeFileStem(fileName = "document") {
  const stem = path.basename(String(fileName || "document"), path.extname(String(fileName || "document")));
  const cleaned = stem.replace(/[^a-z0-9._-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return cleaned || "document";
}

function getWindowsOcrScript() {
  return [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName System.Runtime.WindowsRuntime",
    "$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime]",
    "$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType=WindowsRuntime]",
    "$null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics.Imaging, ContentType=WindowsRuntime]",
    "$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime]",
    "$null = [Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType=WindowsRuntime]",
    "$null = [Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType=WindowsRuntime]",
    "$null = [Windows.Data.Pdf.PdfPageRenderOptions, Windows.Data.Pdf, ContentType=WindowsRuntime]",
    "",
    "function Await-Operation([object]$operation, [Type]$resultType) {",
    "  $method = [System.WindowsRuntimeSystemExtensions].GetMethods() |",
    "    Where-Object {",
    "      $_.Name -eq 'AsTask' -and",
    "      $_.IsGenericMethod -and",
    "      $_.GetParameters().Count -eq 1 -and",
    "      $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'",
    "    } |",
    "    Select-Object -First 1",
    "  $task = $method.MakeGenericMethod($resultType).Invoke($null, @($operation))",
    "  $task.Wait()",
    "  return $task.Result",
    "}",
    "",
    "function Await-Action([object]$action) {",
    "  $method = [System.WindowsRuntimeSystemExtensions].GetMethods() |",
    "    Where-Object {",
    "      $_.Name -eq 'AsTask' -and",
    "      -not $_.IsGenericMethod -and",
    "      $_.GetParameters().Count -eq 1 -and",
    "      $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction'",
    "    } |",
    "    Select-Object -First 1",
    "  $task = $method.Invoke($null, @($action))",
    "  $task.Wait()",
    "}",
    "",
    "function Get-OcrEngine() {",
    "  $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()",
    "  if ($null -eq $engine) {",
    "    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new('en-US'))",
    "  }",
    "  if ($null -eq $engine) {",
    "    throw 'Windows OCR is not available on this system.'",
    "  }",
    "  return $engine",
    "}",
    "",
    "function Normalize-OcrText([string]$text) {",
    "  return ($text -replace \"`r`n\", \"`n\" -replace \"`f\", \"`n\" -replace \"[ \\t]+`n\", \"`n\" -replace \"`n{3,}\", \"`n`n\").Trim()",
    "}",
    "",
    "function Convert-TextToBase64([string]$text) {",
    "  $safeText = if ($null -eq $text) { '' } else { [string]$text }",
    "  return [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($safeText))",
    "}",
    "",
    "function Get-SoftwareBitmapFromStorageFile([string]$inputPath) {",
    "  $file = Await-Operation ([Windows.Storage.StorageFile]::GetFileFromPathAsync($inputPath)) ([Windows.Storage.StorageFile])",
    "  $stream = $null",
    "  try {",
    "    $stream = Await-Operation ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])",
    "    $decoder = Await-Operation ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])",
    "    return Await-Operation (",
    "      $decoder.GetSoftwareBitmapAsync(",
    "        [Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8,",
    "        [Windows.Graphics.Imaging.BitmapAlphaMode]::Premultiplied",
    "      )",
    "    ) ([Windows.Graphics.Imaging.SoftwareBitmap])",
    "  } finally {",
    "    if ($stream) { $stream.Dispose() }",
    "  }",
    "}",
    "",
    "function Get-OcrTextFromSoftwareBitmap([Windows.Graphics.Imaging.SoftwareBitmap]$softwareBitmap, $ocrEngine) {",
    "  $result = Await-Operation ($ocrEngine.RecognizeAsync($softwareBitmap)) ([Windows.Media.Ocr.OcrResult])",
    "  return Normalize-OcrText([string]$result.Text)",
    "}",
    "",
    "function Get-ImageDocumentText([string]$inputPath, $ocrEngine) {",
    "  $softwareBitmap = Get-SoftwareBitmapFromStorageFile $inputPath",
    "  return Get-OcrTextFromSoftwareBitmap $softwareBitmap $ocrEngine",
    "}",
    "",
    "function Get-PdfDocumentText([string]$inputPath, [int]$pageLimit, $ocrEngine) {",
    "  $file = Await-Operation ([Windows.Storage.StorageFile]::GetFileFromPathAsync($inputPath)) ([Windows.Storage.StorageFile])",
    "  $pdf = Await-Operation ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)) ([Windows.Data.Pdf.PdfDocument])",
    "  $pageCount = [Math]::Min([int]$pdf.PageCount, $pageLimit)",
    "  $pages = New-Object System.Collections.Generic.List[string]",
    "",
    "  for ($pageIndex = 0; $pageIndex -lt $pageCount; $pageIndex++) {",
    "    $page = $null",
    "    $stream = $null",
    "    try {",
    "      $page = $pdf.GetPage([uint32]$pageIndex)",
    "      $stream = [Windows.Storage.Streams.InMemoryRandomAccessStream]::new()",
    "      $renderOptions = [Windows.Data.Pdf.PdfPageRenderOptions]::new()",
    "      $renderOptions.DestinationWidth = [uint32]([Math]::Min(2200, [Math]::Max(1200, [Math]::Round($page.Size.Width * 1.8))))",
    "      $renderOptions.DestinationHeight = [uint32]([Math]::Min(2800, [Math]::Max(1400, [Math]::Round($page.Size.Height * 1.8))))",
    "      Await-Action ($page.RenderToStreamAsync($stream, $renderOptions))",
    "      $stream.Seek(0)",
    "      $decoder = Await-Operation ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])",
    "      $softwareBitmap = Await-Operation (",
    "        $decoder.GetSoftwareBitmapAsync(",
    "          [Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8,",
    "          [Windows.Graphics.Imaging.BitmapAlphaMode]::Premultiplied",
    "        )",
    "      ) ([Windows.Graphics.Imaging.SoftwareBitmap])",
    "      $text = Get-OcrTextFromSoftwareBitmap $softwareBitmap $ocrEngine",
    "      if ($text) {",
    "        $pages.Add($text)",
    "      }",
    "    } finally {",
    "      if ($page) { $page.Dispose() }",
    "      if ($stream) { $stream.Dispose() }",
    "    }",
    "  }",
    "",
    "  return [ordered]@{",
    "    text = Normalize-OcrText(($pages -join \"`n`n\"))",
    "    processedPages = $pageCount",
    "    totalPages = [int]$pdf.PageCount",
    "  }",
    "}",
    "",
    "$inputPath = [string]$env:OCR_INPUT_PATH",
    "$maxPages = [int]$env:OCR_MAX_PDF_PAGES",
    "if (-not $maxPages -or $maxPages -lt 1) { $maxPages = 8 }",
    "if (-not (Test-Path -LiteralPath $inputPath)) {",
    "  throw \"Input file not found: $inputPath\"",
    "}",
    "",
    "$extension = [System.IO.Path]::GetExtension($inputPath).ToLowerInvariant()",
    "$ocrEngine = Get-OcrEngine",
    "",
    "if ($extension -eq '.pdf') {",
    "  $pdfResult = Get-PdfDocumentText $inputPath $maxPages $ocrEngine",
    "  [ordered]@{",
    "    ok = $true",
    "    supported = $true",
    "    textBase64 = Convert-TextToBase64($pdfResult.text)",
    "    fileKind = 'pdf'",
    "    processedPages = $pdfResult.processedPages",
    "    totalPages = $pdfResult.totalPages",
    "    truncated = ($pdfResult.totalPages -gt $pdfResult.processedPages)",
    "    engine = 'windows-ocr'",
    "  } | ConvertTo-Json -Compress",
    "  exit 0",
    "}",
    "",
    "$text = Get-ImageDocumentText $inputPath $ocrEngine",
    "[ordered]@{",
    "  ok = $true",
    "  supported = $true",
    "  textBase64 = Convert-TextToBase64($text)",
    "  fileKind = 'image'",
    "  processedPages = 1",
    "  totalPages = 1",
    "  truncated = $false",
    "  engine = 'windows-ocr'",
    "} | ConvertTo-Json -Compress",
    "exit 0",
  ].join("\n");
}
function encodePowershellCommand(script) {
  return Buffer.from(script, "utf16le").toString("base64");
}

async function ensureOcrTempDir() {
  await fs.mkdir(OCR_TEMP_DIR, { recursive: true });
  return OCR_TEMP_DIR;
}

async function writeTempDocument(payload) {
  const parsed = parseDataUrl(payload?.dataUrl);
  const mimeType = String(payload?.mimeType || parsed.mimeType || "application/octet-stream").toLowerCase();
  const extension = extensionForMimeType(mimeType, payload?.name);
  const fileName = `${sanitizeFileStem(payload?.name)}-${randomUUID()}${extension}`;
  const tempPath = path.join(await ensureOcrTempDir(), fileName);
  await fs.writeFile(tempPath, parsed.buffer);
  return { tempPath, mimeType };
}

function runPowershellOcr(tempPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      getPowershellPath(),
      ["-NoProfile", "-NonInteractive", "-EncodedCommand", encodePowershellCommand(getWindowsOcrScript())],
      {
        env: {
          ...process.env,
          OCR_INPUT_PATH: tempPath,
          OCR_MAX_PDF_PAGES: String(OCR_MAX_PDF_PAGES),
        },
        windowsHide: true,
      },
    );

    let stdout = "";
    let stderr = "";
    let finished = false;
    const timeout = setTimeout(() => {
      if (finished) return;
      finished = true;
      child.kill();
      reject(new Error("Automatic OCR timed out."));
    }, OCR_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);

      if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || `Automatic OCR failed with exit code ${code}.`));
        return;
      }

      const payload = stdout.trim();
      if (!payload) {
        reject(new Error("Automatic OCR did not return any result."));
        return;
      }

      try {
        const parsed = JSON.parse(payload);
        if (typeof parsed.textBase64 === "string") {
          parsed.text = Buffer.from(parsed.textBase64, "base64").toString("utf8");
          delete parsed.textBase64;
        }
        resolve(parsed);
      } catch (error) {
        reject(new Error(`Automatic OCR returned an unreadable response. ${error instanceof Error ? error.message : String(error)}`));
      }
    });
  });
}

async function extractDocumentOcr(payload) {
  if (process.platform !== "win32") {
    return {
      ok: false,
      supported: false,
      reason: "unsupported-platform",
      message: "Automatic OCR is currently available in the Windows desktop app.",
    };
  }

  const { tempPath } = await writeTempDocument(payload);
  try {
    return await runPowershellOcr(tempPath);
  } finally {
    await fs.rm(tempPath, { force: true }).catch(() => {});
  }
}

export function registerDocumentOcrIpc() {
  ipcMain.handle(DOCUMENT_OCR_SUPPORTED_CHANNEL, () => ({
    supported: process.platform === "win32",
    platform: process.platform,
    engine: process.platform === "win32" ? "windows-ocr" : "",
  }));

  ipcMain.handle(DOCUMENT_OCR_EXTRACT_CHANNEL, async (_event, payload) => {
    return extractDocumentOcr(payload);
  });
}

