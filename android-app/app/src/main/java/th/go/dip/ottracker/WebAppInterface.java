package th.go.dip.ottracker;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class WebAppInterface {
    private final Activity activity;

    public WebAppInterface(Activity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public void showToast(String message) {
        activity.runOnUiThread(() -> 
            Toast.makeText(activity, message, Toast.LENGTH_SHORT).show()
        );
    }

    @JavascriptInterface
    public void saveBase64File(String filename, String base64Data, String mimeType) {
        try {
            byte[] fileBytes = Base64.decode(base64Data, Base64.DEFAULT);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Android 10+ (API 29+): Use MediaStore Downloads collection
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
                values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType != null ? mimeType : "application/octet-stream");
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/OT_Tracker");

                ContentResolver resolver = activity.getContentResolver();
                Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);

                if (uri != null) {
                    try (OutputStream out = resolver.openOutputStream(uri)) {
                        if (out != null) {
                            out.write(fileBytes);
                            out.flush();
                        }
                    }
                    activity.runOnUiThread(() -> 
                        Toast.makeText(activity, "บันทึกไฟล์ " + filename + " ลงใน Download/OT_Tracker แล้ว", Toast.LENGTH_LONG).show()
                    );
                }
            } else {
                // Legacy Android (< 10)
                File downloadDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                File targetDir = new File(downloadDir, "OT_Tracker");
                if (!targetDir.exists()) {
                    targetDir.mkdirs();
                }
                File file = new File(targetDir, filename);
                try (FileOutputStream fos = new FileOutputStream(file)) {
                    fos.write(fileBytes);
                    fos.flush();
                }
                activity.runOnUiThread(() -> 
                    Toast.makeText(activity, "บันทึกไฟล์ " + filename + " เรียบร้อยแล้ว", Toast.LENGTH_LONG).show()
                );
            }
        } catch (Exception e) {
            e.printStackTrace();
            activity.runOnUiThread(() -> 
                Toast.makeText(activity, "เกิดข้อผิดพลาดในการบันทึกไฟล์: " + e.getMessage(), Toast.LENGTH_LONG).show()
            );
        }
    }
}
