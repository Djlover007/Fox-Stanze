package de.fox.stanze;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Rect;
import android.util.Base64;

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
