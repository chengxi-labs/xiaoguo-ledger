package com.xiaoguo.ledger;

import android.Manifest;
import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

public class MainActivity extends Activity {
    private static final String APP_HOST = "appassets.local";
    private static final String START_URL = "https://appassets.local/index.html";

    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(Color.rgb(247, 243, 235));
        getWindow().setNavigationBarColor(Color.rgb(247, 243, 235));
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        );

        WebView.setWebContentsDebuggingEnabled(false);
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(247, 243, 235));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setWebViewClient(new LocalAssetClient());

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " XiaoguoLedgerAndroid/1.0");

        webView.addJavascriptInterface(new DownloadBridge(), "XiaoguoAndroid");
        setContentView(webView);

        if (Build.VERSION.SDK_INT <= 28
            && checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(
                new String[] { Manifest.permission.WRITE_EXTERNAL_STORAGE },
                10
            );
        }

        webView.loadUrl(START_URL);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.removeJavascriptInterface("XiaoguoAndroid");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    private final class LocalAssetClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(
            WebView view,
            WebResourceRequest request
        ) {
            Uri url = request.getUrl();
            if (!APP_HOST.equals(url.getHost())) {
                return super.shouldInterceptRequest(view, request);
            }

            String path = url.getPath();
            if (path == null || path.isEmpty() || "/".equals(path)) {
                path = "/index.html";
            }
            String assetPath = "www" + path;

            try {
                InputStream stream = getAssets().open(assetPath);
                return new WebResourceResponse(
                    contentType(assetPath),
                    "UTF-8",
                    200,
                    "OK",
                    new HashMap<>(),
                    stream
                );
            } catch (IOException error) {
                byte[] body = "Not found".getBytes(StandardCharsets.UTF_8);
                return new WebResourceResponse(
                    "text/plain",
                    "UTF-8",
                    404,
                    "Not Found",
                    new HashMap<>(),
                    new ByteArrayInputStream(body)
                );
            }
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            if (APP_HOST.equals(url.getHost())) {
                return false;
            }
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, url));
            } catch (Exception ignored) {
                // Ignore links that cannot be handled by another installed app.
            }
            return true;
        }
    }

    private final class DownloadBridge {
        @JavascriptInterface
        public void saveToDownloads(String filename, String mimeType, String base64) {
            try {
                String safeName = sanitizeFilename(filename);
                String cleanMime = mimeType.split(";", 2)[0];
                byte[] data = Base64.decode(base64, Base64.DEFAULT);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    saveWithMediaStore(safeName, cleanMime, data);
                } else {
                    saveToLegacyDownloads(safeName, cleanMime, data);
                }

                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        Toast.makeText(
                            MainActivity.this,
                            "已保存到 Downloads",
                            Toast.LENGTH_SHORT
                        ).show();
                    }
                });
            } catch (Exception error) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        Toast.makeText(
                            MainActivity.this,
                            "导出失败：" + error.getMessage(),
                            Toast.LENGTH_LONG
                        ).show();
                    }
                });
            }
        }
    }

    private void saveWithMediaStore(String filename, String mimeType, byte[] data)
        throws IOException {
        ContentResolver resolver = getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
        values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
        values.put(
            MediaStore.MediaColumns.RELATIVE_PATH,
            Environment.DIRECTORY_DOWNLOADS
        );
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);

        Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if (uri == null) {
            throw new IOException("无法创建下载文件");
        }

        try (OutputStream stream = resolver.openOutputStream(uri)) {
            if (stream == null) {
                throw new IOException("无法写入下载文件");
            }
            stream.write(data);
        }

        ContentValues ready = new ContentValues();
        ready.put(MediaStore.MediaColumns.IS_PENDING, 0);
        resolver.update(uri, ready, null, null);
    }

    @SuppressWarnings("deprecation")
    private void saveToLegacyDownloads(String filename, String mimeType, byte[] data)
        throws IOException {
        File directory = Environment.getExternalStoragePublicDirectory(
            Environment.DIRECTORY_DOWNLOADS
        );
        if (!directory.exists() && !directory.mkdirs()) {
            throw new IOException("无法创建下载目录");
        }
        File outputFile = new File(directory, filename);
        try (FileOutputStream stream = new FileOutputStream(outputFile)) {
            stream.write(data);
        }
        MediaScannerConnection.scanFile(
            this,
            new String[] { outputFile.getAbsolutePath() },
            new String[] { mimeType },
            null
        );
    }

    private static String sanitizeFilename(String filename) {
        String value = filename == null || filename.trim().isEmpty()
            ? "小果管钱导出"
            : filename.trim();
        return value.replaceAll("[\\\\/:*?\"<>|]", "_");
    }

    private static String contentType(String path) {
        String lower = path.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".html")) return "text/html";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".js")) return "application/javascript";
        if (lower.endsWith(".json")) return "application/json";
        if (lower.endsWith(".webmanifest")) return "application/manifest+json";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        return "application/octet-stream";
    }
}
