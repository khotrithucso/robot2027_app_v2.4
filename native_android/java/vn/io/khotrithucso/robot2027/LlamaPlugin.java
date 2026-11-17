package vn.io.khotrithucso.robot2027;

import android.app.ActivityManager;
import android.content.Context;
import android.os.Environment;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

@CapacitorPlugin(name = "LlamaPlugin")
public class LlamaPlugin extends Plugin {

    private static boolean libLoaded = false;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    static {
        try {
            System.loadLibrary("robot_llama");
            libLoaded = true;
        } catch (UnsatisfiedLinkError e) {
            libLoaded = false;
        }
    }

    private native boolean nativeLoadModel(String modelPath, int nThreads, int nCtx);
    private native String nativeGenerate(String prompt, int maxTokens);
    private native String nativeSignPayload(String botId, String androidId, String ts, String nonce, String userFull, String botFull);
    private native void nativeUnload();

    @PluginMethod
    public void getDeviceInfo(PluginCall call) {
        Context ctx = getContext();
        String androidId = Settings.Secure.getString(ctx.getContentResolver(), Settings.Secure.ANDROID_ID);
        if (androidId == null || androidId.isEmpty()) {
            androidId = "R2027_FALLBACK_DEV";
        }

        ActivityManager am = (ActivityManager) ctx.getSystemService(Context.ACTIVITY_SERVICE);
        ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
        long totalMb = 0;
        long availMb = 0;
        if (am != null) {
            am.getMemoryInfo(mi);
            totalMb = mi.totalMem / (1024 * 1024);
            availMb = mi.availMem / (1024 * 1024);
        }

        JSObject ret = new JSObject();
        ret.put("androidId", androidId);
        ret.put("totalRamMb", totalMb);
        ret.put("availRamMb", availMb);
        ret.put("nativeReady", libLoaded);
        call.resolve(ret);
    }

    @PluginMethod
    public void scanModels(PluginCall call) {
        executor.execute(() -> {
            List<File> searchDirs = new ArrayList<>();
            searchDirs.add(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS));
            searchDirs.add(new File(Environment.getExternalStorageDirectory(), "Models"));
            searchDirs.add(new File(Environment.getExternalStorageDirectory(), "Robot2027"));
            File extFiles = getContext().getExternalFilesDir(null);
            if (extFiles != null) searchDirs.add(extFiles);
            searchDirs.add(getContext().getFilesDir());

            JSArray modelsArr = new JSArray();
            List<String> seenPaths = new ArrayList<>();

            for (File dir : searchDirs) {
                if (dir == null || !dir.exists() || !dir.isDirectory()) continue;
                File[] files = dir.listFiles();
                if (files == null) continue;
                for (File f : files) {
                    if (f.isFile() && f.getName().toLowerCase().endsWith(".gguf")) {
                        String path = f.getAbsolutePath();
                        if (!seenPaths.contains(path)) {
                            seenPaths.add(path);
                            JSObject item = new JSObject();
                            item.put("name", f.getName());
                            item.put("path", path);
                            item.put("sizeMb", Math.round((f.length() / (1024.0 * 1024.0)) * 10.0) / 10.0);
                            modelsArr.put(item);
                        }
                    }
                }
            }

            JSObject ret = new JSObject();
            ret.put("models", modelsArr);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void loadModel(PluginCall call) {
        if (!libLoaded) {
            call.reject("Thư viện C++ robot_llama chưa sẵn sàng.");
            return;
        }
        String modelPath = call.getString("modelPath", "");
        int nThreads = call.getInt("nThreads", 4);
        int nCtx = call.getInt("nCtx", 512);

        if (modelPath == null || modelPath.isEmpty()) {
            call.reject("Thiếu đường dẫn file .gguf");
            return;
        }
        File f = new File(modelPath);
        if (!f.exists()) {
            call.reject("Không tìm thấy file model tại: " + modelPath);
            return;
        }

        executor.execute(() -> {
            boolean ok = nativeLoadModel(modelPath, nThreads, nCtx);
            if (ok) {
                JSObject ret = new JSObject();
                ret.put("loaded", true);
                ret.put("name", f.getName());
                ret.put("sizeMb", Math.round((f.length() / (1024.0 * 1024.0)) * 10.0) / 10.0);
                call.resolve(ret);
            } else {
                call.reject("Không thể nạp model GGUF (kiểm tra RAM trống hoặc định dạng file).");
            }
        });
    }

    @PluginMethod
    public void generate(PluginCall call) {
        if (!libLoaded) {
            call.reject("Native engine chưa sẵn sàng.");
            return;
        }
        String prompt = call.getString("prompt", "");
        int maxTokens = call.getInt("maxTokens", 72);

        executor.execute(() -> {
            long t0 = System.currentTimeMillis();
            String output = nativeGenerate(prompt, maxTokens);
            long elapsed = System.currentTimeMillis() - t0;

            JSObject ret = new JSObject();
            ret.put("text", output != null ? output.trim() : "");
            ret.put("elapsedMs", elapsed);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void signPayload(PluginCall call) {
        String botId = call.getString("botId", "");
        String androidId = call.getString("androidId", "");
        String ts = call.getString("timestamp", "");
        String nonce = call.getString("nonce", "");
        String userFull = call.getString("userFull", "");
        String botFull = call.getString("botFull", "");

        String sig = "";
        if (libLoaded) {
            sig = nativeSignPayload(botId, androidId, ts, nonce, userFull, botFull);
        } else {
            try {
                MessageDigest md = MessageDigest.getInstance("SHA-256");
                byte[] h = md.digest((userFull + "|" + botFull).getBytes(StandardCharsets.UTF_8));
                StringBuilder hexHash = new StringBuilder();
                for (byte b : h) hexHash.append(String.format("%02x", b));

                String canonical = botId + "|" + androidId + "|" + ts + "|" + nonce + "|" + hexHash;
                Mac mac = Mac.getInstance("HmacSHA256");
                mac.init(new SecretKeySpec("R2027_V24_SHIELD_#9821_VN_PRO_KEY".getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
                byte[] rawSig = mac.doFinal(canonical.getBytes(StandardCharsets.UTF_8));
                StringBuilder hexSig = new StringBuilder();
                for (byte b : rawSig) hexSig.append(String.format("%02x", b));
                sig = hexSig.toString();
            } catch (Exception ignored) {}
        }

        JSObject ret = new JSObject();
        ret.put("signature", sig);
        call.resolve(ret);
    }

    @PluginMethod
    public void unloadModel(PluginCall call) {
        if (libLoaded) {
            executor.execute(this::nativeUnload);
        }
        call.resolve();
    }
}
