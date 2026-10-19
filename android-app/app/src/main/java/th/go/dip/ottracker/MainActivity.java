package th.go.dip.ottracker;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import android.webkit.JsResult;
import androidx.webkit.WebViewAssetLoader;
import android.os.Message;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "OTTracker";
    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private ActivityResultLauncher<Intent> fileChooserLauncher;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Map root "/" directly to android assets directory
        // This ensures both /index.html and /assets/... resolve perfectly without 404
        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
            .setDomain("appassets.androidplatform.net")
            .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();

        // Register File Chooser for PDF / Backup selection
        fileChooserLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                if (filePathCallback != null) {
                    Uri[] results = null;
                    if (result.getResultCode() == RESULT_OK && result.getData() != null) {
                        if (result.getData().getClipData() != null) {
                            int count = result.getData().getClipData().getItemCount();
                            results = new Uri[count];
                            for (int i = 0; i < count; i++) {
                                results[i] = result.getData().getClipData().getItemAt(i).getUri();
                            }
                        } else if (result.getData().getData() != null) {
                            results = new Uri[]{result.getData().getData()};
                        }
                    }
                    filePathCallback.onReceiveValue(results);
                    filePathCallback = null;
                }
            }
        );

        webView = new WebView(this);
        webView.setBackgroundColor(Color.WHITE);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);

        // Bridge to native Android features (File saving & Notifications)
        webView.addJavascriptInterface(new WebAppInterface(this), "Android");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                Log.e(TAG, "Web error: " + error.getDescription() + " url: " + request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("https://appassets.androidplatform.net/") || 
                    url.startsWith("file://") || 
                    url.startsWith("blob:") || 
                    url.startsWith("data:")) {
                    return false;
                }
                // External web links open in external browser
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    startActivity(intent);
                } catch (Exception ignored) {}
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                WebView tempWebView = new WebView(MainActivity.this);
                tempWebView.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                        String url = request.getUrl().toString();
                        try {
                            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                            startActivity(intent);
                        } catch (Exception ignored) {}
                        return true;
                    }
                });
                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(tempWebView);
                resultMsg.sendToTarget();
                return true;
            }

            @Override
            public boolean onJsAlert(WebView view, String url, String message, final JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                        .setTitle("ระบบบันทึก OT")
                        .setMessage(message)
                        .setPositiveButton("ตกลง", (dialog, which) -> result.confirm())
                        .setOnCancelListener(dialog -> result.confirm())
                        .show();
                return true;
            }

            @Override
            public boolean onJsConfirm(WebView view, String url, String message, final JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                        .setTitle("ยืนยันการดำเนินการ")
                        .setMessage(message)
                        .setPositiveButton("ตกลง", (dialog, which) -> result.confirm())
                        .setNegativeButton("ยกเลิก", (dialog, which) -> result.cancel())
                        .setOnCancelListener(dialog -> result.cancel())
                        .show();
                return true;
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                Log.d(TAG, consoleMessage.message() + " -- Line "
                        + consoleMessage.lineNumber() + " of "
                        + consoleMessage.sourceId());
                return true;
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback,
                                            FileChooserParams fileChooserParams) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }
                MainActivity.this.filePathCallback = filePathCallback;

                Intent intent = fileChooserParams.createIntent();
                try {
                    fileChooserLauncher.launch(intent);
                } catch (Exception e) {
                    MainActivity.this.filePathCallback = null;
                    return false;
                }
                return true;
            }
        });

        // Handle Back button
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    setEnabled(false);
                    MainActivity.super.onBackPressed();
                }
            }
        });

        // Load index.html directly from root of virtual origin https://appassets.androidplatform.net/index.html
        webView.loadUrl("https://appassets.androidplatform.net/index.html");
    }

    // =========================================================================
    // Native Google OAuth Loopback Server (Port 42815)
    // =========================================================================
    private ServerSocket oAuthServerSocket = null;
    private Thread oAuthServerThread = null;
    private volatile boolean isListeningAuth = false;

    public synchronized void stopLocalOAuthServer() {
        isListeningAuth = false;
        if (oAuthServerSocket != null) {
            try {
                oAuthServerSocket.close();
            } catch (Exception ignored) {}
            oAuthServerSocket = null;
        }
        if (oAuthServerThread != null) {
            oAuthServerThread.interrupt();
            oAuthServerThread = null;
        }
    }

    public synchronized void startLocalOAuthServer(String clientId) {
        stopLocalOAuthServer();
        isListeningAuth = true;

        oAuthServerThread = new Thread(() -> {
            try {
                oAuthServerSocket = new ServerSocket();
                oAuthServerSocket.setReuseAddress(true);
                oAuthServerSocket.bind(new InetSocketAddress("127.0.0.1", 42815));
                Log.d(TAG, "OAuth local server listening on 127.0.0.1:42815");

                // Launch system browser (Chrome/default browser)
                String scope = "https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile";
                String authUrl = "https://accounts.google.com/o/oauth2/v2/auth?client_id=" + Uri.encode(clientId)
                        + "&redirect_uri=" + Uri.encode("http://127.0.0.1:42815")
                        + "&response_type=token"
                        + "&scope=" + Uri.encode(scope);

                Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(authUrl));
                browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(browserIntent);

                while (isListeningAuth && oAuthServerSocket != null && !oAuthServerSocket.isClosed()) {
                    Socket clientSocket = oAuthServerSocket.accept();
                    new Thread(() -> handleOAuthClient(clientSocket)).start();
                }
            } catch (Exception e) {
                if (isListeningAuth) {
                    Log.e(TAG, "OAuth server exception: " + e.getMessage(), e);
                }
            }
        });
        oAuthServerThread.start();
    }

    private void handleOAuthClient(Socket clientSocket) {
        try {
            BufferedReader reader = new BufferedReader(new InputStreamReader(clientSocket.getInputStream(), StandardCharsets.UTF_8));
            String line = reader.readLine();
            if (line == null) {
                clientSocket.close();
                return;
            }

            Log.d(TAG, "OAuth request: " + line);

            if (line.contains("/token?") || line.contains("access_token=")) {
                String token = null;
                int tokenIdx = line.indexOf("access_token=");
                if (tokenIdx != -1) {
                    String after = line.substring(tokenIdx + "access_token=".length());
                    int endIdx = after.indexOf('&');
                    int spaceIdx = after.indexOf(' ');
                    int cutIdx = -1;
                    if (endIdx != -1 && spaceIdx != -1) {
                        cutIdx = Math.min(endIdx, spaceIdx);
                    } else if (endIdx != -1) {
                        cutIdx = endIdx;
                    } else if (spaceIdx != -1) {
                        cutIdx = spaceIdx;
                    }
                    token = (cutIdx != -1) ? after.substring(0, cutIdx) : after;
                }

                OutputStream out = clientSocket.getOutputStream();
                String resp = "HTTP/1.1 200 OK\r\nContent-Type: text/plain; charset=utf-8\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\nOK";
                out.write(resp.getBytes(StandardCharsets.UTF_8));
                out.flush();
                clientSocket.close();

                if (token != null && !token.isEmpty()) {
                    final String finalToken = token;
                    runOnUiThread(() -> {
                        if (webView != null) {
                            webView.evaluateJavascript("if (window.__onGoogleDriveAuthSuccess) window.__onGoogleDriveAuthSuccess('" + finalToken + "');", null);
                        }
                        try {
                            Intent bringBack = new Intent(MainActivity.this, MainActivity.class);
                            bringBack.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                            startActivity(bringBack);
                        } catch (Exception ignored) {}
                    });
                    stopLocalOAuthServer();
                }
            } else {
                String html = "<!DOCTYPE html>"
                        + "<html><head><meta charset='utf-8'><title>เชื่อมต่อสำเร็จ</title>"
                        + "<meta name='viewport' content='width=device-width, initial-scale=1'>"
                        + "<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8fafc;color:#1e293b;}"
                        + ".card{background:white;padding:32px 24px;border-radius:20px;box-shadow:0 10px 25px rgba(0,0,0,0.06);text-align:center;max-width:360px;margin:16px;border:1px solid #e2e8f0;}"
                        + "h2{color:#16a34a;margin:12px 0 8px;font-size:18px;}p{font-size:13px;color:#64748b;margin:0 0 16px;line-height:1.6;}"
                        + ".badge{display:inline-block;padding:4px 12px;background:#dcfce7;color:#15803d;border-radius:30px;font-weight:bold;font-size:11px;}"
                        + ".btn{display:inline-block;background:#b31b27;color:white;padding:10px 20px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:13px;}"
                        + "</style></head><body>"
                        + "<div class='card'>"
                        + "<div class='badge'>OT Tracker</div>"
                        + "<h2>✅ เชื่อมต่อ Google Drive สำเร็จ!</h2>"
                        + "<p>ระบบกำลังซิงค์ข้อมูลกลับไปยังแอป OT Tracker บนมือถือของคุณ...<br>คุณสามารถสลับกลับไปที่แอปได้ทันทีครับ</p>"
                        + "<a href='#' onclick='window.close();' class='btn'>ปิดหน้านี้</a>"
                        + "</div>"
                        + "<script>"
                        + "const hash = window.location.hash.substring(1);"
                        + "if (hash) {"
                        + "  fetch('/token?' + hash).then(() => setTimeout(() => window.close(), 1200));"
                        + "} else {"
                        + "  const params = new URLSearchParams(window.location.search);"
                        + "  if (params.get('access_token')) {"
                        + "    fetch('/token?' + params.toString()).then(() => setTimeout(() => window.close(), 1200));"
                        + "  }"
                        + "}"
                        + "</script></body></html>";

                byte[] htmlBytes = html.getBytes(StandardCharsets.UTF_8);
                OutputStream out = clientSocket.getOutputStream();
                String header = "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: "
                        + htmlBytes.length + "\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n";
                out.write(header.getBytes(StandardCharsets.UTF_8));
                out.write(htmlBytes);
                out.flush();
                clientSocket.close();
            }
        } catch (Exception e) {
            Log.e(TAG, "Error handling OAuth client: " + e.getMessage());
            try {
                clientSocket.close();
            } catch (Exception ignored) {}
        }
    }

    @Override
    protected void onDestroy() {
        stopLocalOAuthServer();
        super.onDestroy();
    }
}
