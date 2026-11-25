package de.fox.stanze;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Rect;
import android.util.Base64;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

/** Texterkennung (offline, ML Kit) für Fotos vom Maschinenbildschirm. */
@CapacitorPlugin(name = "FoxStanze")
public class FoxStanzePlugin extends Plugin {

    private TextRecognizer recognizer;

    @PluginMethod
    public void ocr(final PluginCall call) {
        String b64 = call.getString("image");
        if (b64 == null || b64.isEmpty()) {
            call.reject("Kein Bild");
            return;
        }
        final Bitmap bmp;
        try {
            byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
            bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        } catch (Exception e) {
            call.reject("Bild nicht lesbar");
            return;
        }
        if (bmp == null) {
            call.reject("Bild nicht lesbar");
            return;
        }
        if (recognizer == null) recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        recognizer.process(InputImage.fromBitmap(bmp, 0))
            .addOnSuccessListener(text -> {
                JSObject res = new JSObject();
                res.put("width", bmp.getWidth());
                res.put("height", bmp.getHeight());
                JSArray lines = new JSArray();
                for (Text.TextBlock block : text.getTextBlocks()) {
                    for (Text.Line line : block.getLines()) {
                        JSObject l = box(line.getText(), line.getBoundingBox());
                        if (l == null) continue;
                        JSArray els = new JSArray();
                        for (Text.Element el : line.getElements()) {
                            JSObject e = box(el.getText(), el.getBoundingBox());
                            if (e != null) els.put(e);
                        }
                        l.put("elements", els);
                        lines.put(l);
                    }
                }
                res.put("lines", lines);
                call.resolve(res);
            })
            .addOnFailureListener(e -> call.reject("Texterkennung fehlgeschlagen: " + e.getMessage()));
    }

    /** Sicherung als Datei in Download/Fox Stanze ablegen; alte Auto-Sicherungen aufraeumen. */
    @PluginMethod
    public void saveBackup(final PluginCall call) {
        final String name = call.getString("name", "fox-stanze-sicherung.json");
        final String data = call.getString("data", "");
        final int keep = call.getInt("keep", 4);
        final String prune = call.getString("prune", "");
        new Thread(() -> {
            try {
                byte[] bytes = data.getBytes(StandardCharsets.UTF_8);
                String where;
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentResolver cr = getContext().getContentResolver();
                    Uri base = MediaStore.Downloads.EXTERNAL_CONTENT_URI;
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                    v.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
                    v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Fox Stanze");
                    v.put(MediaStore.MediaColumns.IS_PENDING, 1);
                    Uri uri = cr.insert(base, v);
                    if (uri == null) throw new Exception("Download-Ordner nicht erreichbar");
                    try (OutputStream o = cr.openOutputStream(uri)) {
                        if (o == null) throw new Exception("Datei nicht beschreibbar");
                        o.write(bytes);
                    }
                    v.clear();
                    v.put(MediaStore.MediaColumns.IS_PENDING, 0);
                    cr.update(uri, v, null, null);
                    if (prune != null && !prune.isEmpty()) {
                        try (Cursor c = cr.query(base, new String[]{MediaStore.MediaColumns._ID},
                                MediaStore.MediaColumns.RELATIVE_PATH + " LIKE ? AND " + MediaStore.MediaColumns.DISPLAY_NAME + " LIKE ?",
                                new String[]{"%Fox Stanze%", prune + "%"}, MediaStore.MediaColumns.DATE_ADDED + " DESC")) {
                            int i = 0;
                            while (c != null && c.moveToNext()) {
                                if (++i > keep) {
                                    try { cr.delete(ContentUris.withAppendedId(base, c.getLong(0)), null, null); } catch (Exception ignored) {}
                                }
                            }
                        }
                    }
                    where = "Download/Fox Stanze/" + name;
                } else {
                    File dir = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    if (dir == null) dir = getContext().getFilesDir();
                    dir.mkdirs();
                    File f = new File(dir, name);
                    try (FileOutputStream o = new FileOutputStream(f)) { o.write(bytes); }
                    if (prune != null && !prune.isEmpty()) {
                        File[] all = dir.listFiles((d, n) -> n.startsWith(prune));
                        if (all != null && all.length > keep) {
                            Arrays.sort(all, (a, b) -> Long.compare(b.lastModified(), a.lastModified()));
                            for (int i = keep; i < all.length; i++) all[i].delete();
                        }
                    }
                    where = f.getAbsolutePath();
                }
                JSObject r = new JSObject();
                r.put("path", where);
                call.resolve(r);
            } catch (Exception e) {
                call.reject(String.valueOf(e.getMessage()));
            }
        }).start();
    }

    private static JSObject box(String t, Rect r) {
        if (r == null) return null;
        JSObject o = new JSObject();
        o.put("text", t);
        o.put("x", r.left);
        o.put("y", r.top);
        o.put("w", r.width());
        o.put("h", r.height());
        return o;
    }
}
