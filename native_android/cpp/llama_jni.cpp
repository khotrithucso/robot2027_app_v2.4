#include <jni.h>
#include <string>
#include <vector>
#include <cstring>
#include <cstdint>
#include <cstdio>
#include <android/log.h>
#include "llama.h"

#define LOG_TAG "RobotLlamaV24"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

static llama_model * g_model = nullptr;
static llama_context * g_ctx = nullptr;
static llama_sampler * g_sampler = nullptr;

// Cache tiền tố System Prompt để tăng tốc 50-70% khi chạy model 500MB - 1GB+
static std::string g_cached_sys_prefix;
static int g_cached_sys_tokens = 0;

static void free_all() {
    g_cached_sys_prefix.clear();
    g_cached_sys_tokens = 0;
    if (g_sampler) {
        llama_sampler_free(g_sampler);
        g_sampler = nullptr;
    }
    if (g_ctx) {
        llama_free(g_ctx);
        g_ctx = nullptr;
    }
    if (g_model) {
        llama_model_free(g_model);
        g_model = nullptr;
    }
}

// ============================================================================
// SELF-CONTAINED SHA-256 & HMAC-SHA256 (Ẩn Secret Key khỏi APK Decompiler)
// ============================================================================
namespace r2027_crypto {
    static const uint32_t k[64] = {
        0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
        0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
        0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
        0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
        0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
        0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
        0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
        0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    };

    inline uint32_t rotr(uint32_t x, uint32_t n) { return (x >> n) | (x << (32 - n)); }

    std::vector<uint8_t> sha256_raw(const uint8_t* data, size_t len) {
        uint32_t h[8] = {
            0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
            0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
        };
        uint64_t bit_len = static_cast<uint64_t>(len) * 8;
        std::vector<uint8_t> msg(data, data + len);
        msg.push_back(0x80);
        while ((msg.size() % 64) != 56) msg.push_back(0x00);
        for (int i = 7; i >= 0; --i) msg.push_back(static_cast<uint8_t>((bit_len >> (i * 8)) & 0xFF));

        for (size_t chunk = 0; chunk < msg.size(); chunk += 64) {
            uint32_t w[64];
            for (int i = 0; i < 16; ++i) {
                w[i] = (uint32_t(msg[chunk + i * 4]) << 24) |
                       (uint32_t(msg[chunk + i * 4 + 1]) << 16) |
                       (uint32_t(msg[chunk + i * 4 + 2]) << 8) |
                       (uint32_t(msg[chunk + i * 4 + 3]));
            }
            for (int i = 16; i < 64; ++i) {
                uint32_t s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >> 3);
                uint32_t s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >> 10);
                w[i] = w[i - 16] + s0 + w[i - 7] + s1;
            }
            uint32_t a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
            for (int i = 0; i < 64; ++i) {
                uint32_t S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
                uint32_t ch = (e & f) ^ ((~e) & g);
                uint32_t temp1 = hh + S1 + ch + k[i] + w[i];
                uint32_t S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
                uint32_t maj = (a & b) ^ (a & c) ^ (b & c);
                uint32_t temp2 = S0 + maj;
                hh = g; g = f; f = e; e = d + temp1;
                d = c; c = b; b = a; a = temp1 + temp2;
            }
            h[0] += a; h[1] += b; h[2] += c; h[3] += d;
            h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
        }

        std::vector<uint8_t> out(32);
        for (int i = 0; i < 8; ++i) {
            out[i * 4]     = (h[i] >> 24) & 0xFF;
            out[i * 4 + 1] = (h[i] >> 16) & 0xFF;
            out[i * 4 + 2] = (h[i] >> 8) & 0xFF;
            out[i * 4 + 3] = h[i] & 0xFF;
        }
        return out;
    }

    std::string to_hex(const std::vector<uint8_t>& bytes) {
        char buf[65];
        for (size_t i = 0; i < bytes.size(); ++i) {
            std::snprintf(buf + i * 2, 3, "%02x", bytes[i]);
        }
        buf[bytes.size() * 2] = '\0';
        return std::string(buf);
    }

    std::string get_obfuscated_secret() {
        // XOR 0x5A encoded key -> giải mã tại runtime trong RAM
        static const uint8_t enc[33] = {
            0x08, 0x68, 0x6A, 0x68, 0x6D, 0x05, 0x0C, 0x68, 0x6E, 0x05, 0x09,
            0x12, 0x13, 0x1F, 0x16, 0x1E, 0x05, 0x79, 0x63, 0x62, 0x68, 0x6B,
            0x05, 0x0C, 0x14, 0x05, 0x0A, 0x08, 0x15, 0x05, 0x11, 0x1F, 0x03
        };
        std::string key;
        key.resize(33);
        for (int i = 0; i < 33; ++i) {
            key[i] = static_cast<char>(enc[i] ^ 0x5A);
        }
        return key;
    }

    std::string hmac_sha256_hex(const std::string& key_str, const std::string& msg_str) {
        std::vector<uint8_t> key(key_str.begin(), key_str.end());
        if (key.size() > 64) {
            key = sha256_raw(key.data(), key.size());
        }
        key.resize(64, 0x00);

        std::vector<uint8_t> o_pad(64), i_pad(64);
        for (int i = 0; i < 64; ++i) {
            o_pad[i] = key[i] ^ 0x5c;
            i_pad[i] = key[i] ^ 0x36;
        }

        i_pad.insert(i_pad.end(), msg_str.begin(), msg_str.end());
        auto inner = sha256_raw(i_pad.data(), i_pad.size());

        o_pad.insert(o_pad.end(), inner.begin(), inner.end());
        auto outer = sha256_raw(o_pad.data(), o_pad.size());
        return to_hex(outer);
    }
}

extern "C" JNIEXPORT jstring JNICALL
Java_vn_io_khotrithucso_robot2027_LlamaPlugin_nativeSignPayload(
        JNIEnv * env,
        jobject /* this */,
        jstring jBotId,
        jstring jAndroidId,
        jstring jTimestamp,
        jstring jNonce,
        jstring jUserFull,
        jstring jBotFull) {
    const char* cBot = env->GetStringUTFChars(jBotId, nullptr);
    const char* cAnd = env->GetStringUTFChars(jAndroidId, nullptr);
    const char* cTs  = env->GetStringUTFChars(jTimestamp, nullptr);
    const char* cNc  = env->GetStringUTFChars(jNonce, nullptr);
    const char* cUsr = env->GetStringUTFChars(jUserFull, nullptr);
    const char* cBtx = env->GetStringUTFChars(jBotFull, nullptr);

    std::string combined = std::string(cUsr) + "|" + std::string(cBtx);
    auto hashBytes = r2027_crypto::sha256_raw(
        reinterpret_cast<const uint8_t*>(combined.data()), combined.size()
    );
    std::string payloadHash = r2027_crypto::to_hex(hashBytes);

    std::string canonical = std::string(cBot) + "|" + std::string(cAnd) + "|" +
                            std::string(cTs) + "|" + std::string(cNc) + "|" + payloadHash;

    std::string secret = r2027_crypto::get_obfuscated_secret();
    std::string sig = r2027_crypto::hmac_sha256_hex(secret, canonical);

    env->ReleaseStringUTFChars(jBotId, cBot);
    env->ReleaseStringUTFChars(jAndroidId, cAnd);
    env->ReleaseStringUTFChars(jTimestamp, cTs);
    env->ReleaseStringUTFChars(jNonce, cNc);
    env->ReleaseStringUTFChars(jUserFull, cUsr);
    env->ReleaseStringUTFChars(jBotFull, cBtx);

    return env->NewStringUTF(sig.c_str());
}

extern "C" JNIEXPORT jboolean JNICALL
Java_vn_io_khotrithucso_robot2027_LlamaPlugin_nativeLoadModel(
        JNIEnv * env,
        jobject /* this */,
        jstring jModelPath,
        jint nThreads,
        jint nCtxReq) {
    const char * modelPath = env->GetStringUTFChars(jModelPath, nullptr);
    LOGI("Loading GGUF model V2.4: %s", modelPath);

    free_all();
    llama_backend_init();

    llama_model_params mparams = llama_model_default_params();
    mparams.use_mmap = true;
    mparams.use_mlock = false;

    g_model = llama_model_load_from_file(modelPath, mparams);
    env->ReleaseStringUTFChars(jModelPath, modelPath);

    if (!g_model) {
        LOGE("Failed to load GGUF model!");
        return JNI_FALSE;
    }

    int threads = (nThreads > 0 && nThreads <= 8) ? nThreads : 4;
    int ctxSize = (nCtxReq >= 256 && nCtxReq <= 1536) ? nCtxReq : 512;

    llama_context_params cparams = llama_context_default_params();
    cparams.n_ctx = ctxSize;
    cparams.n_batch = 128;
    cparams.n_ubatch = 128;
    cparams.n_threads = threads;
    cparams.n_threads_batch = threads;

    g_ctx = llama_init_from_model(g_model, cparams);
    if (!g_ctx) {
        LOGE("Failed to create llama_context!");
        free_all();
        return JNI_FALSE;
    }

    auto sparams = llama_sampler_chain_default_params();
    g_sampler = llama_sampler_chain_init(sparams);
    llama_sampler_chain_add(g_sampler, llama_sampler_init_penalties(64, 1.16f, 0.05f, 0.05f));
    llama_sampler_chain_add(g_sampler, llama_sampler_init_top_k(32));
    llama_sampler_chain_add(g_sampler, llama_sampler_init_top_p(0.90f, 1));
    llama_sampler_chain_add(g_sampler, llama_sampler_init_temp(0.70f));
    llama_sampler_chain_add(g_sampler, llama_sampler_init_dist(LLAMA_DEFAULT_SEED));

    LOGI("Model V2.4 ready (threads=%d, n_ctx=%d)", threads, ctxSize);
    return JNI_TRUE;
}

extern "C" JNIEXPORT jstring JNICALL
Java_vn_io_khotrithucso_robot2027_LlamaPlugin_nativeGenerate(
        JNIEnv * env,
        jobject /* this */,
        jstring jPrompt,
        jint maxTokens) {
    if (!g_model || !g_ctx || !g_sampler) {
        return env->NewStringUTF("");
    }

    const char * promptCStr = env->GetStringUTFChars(jPrompt, nullptr);
    std::string prompt(promptCStr);
    env->ReleaseStringUTFChars(jPrompt, promptCStr);

    llama_sampler_reset(g_sampler);
    const llama_vocab * vocab = llama_model_get_vocab(g_model);

    // Tách System Prompt Prefix để giữ KV Cache tái sử dụng (giảm 50-70% độ trễ)
    std::string sysPrefix;
    std::string suffixText = prompt;
    size_t sysEnd = prompt.find("<|im_end|>\n");
    if (sysEnd != std::string::npos) {
        sysPrefix = prompt.substr(0, sysEnd + 11);
        suffixText = prompt.substr(sysEnd + 11);
    }

    int max_ctx = (int)llama_n_ctx(g_ctx);

    if (!sysPrefix.empty() && sysPrefix == g_cached_sys_prefix && g_cached_sys_tokens > 0) {
        // Giữ nguyên KV cache của System Prompt, chỉ xóa phần hội thoại phía sau!
        llama_kv_cache_seq_rm(g_ctx, 0, g_cached_sys_tokens, -1);
    } else {
        llama_kv_cache_clear(g_ctx);
        g_cached_sys_prefix.clear();
        g_cached_sys_tokens = 0;

        if (!sysPrefix.empty()) {
            std::vector<llama_token> sysToks(sysPrefix.size() + 16);
            int n_sys = llama_tokenize(vocab, sysPrefix.c_str(), (int32_t)sysPrefix.size(),
                                       sysToks.data(), (int32_t)sysToks.size(), true, true);
            if (n_sys < 0) {
                sysToks.resize(-n_sys);
                n_sys = llama_tokenize(vocab, sysPrefix.c_str(), (int32_t)sysPrefix.size(),
                                       sysToks.data(), (int32_t)sysToks.size(), true, true);
            }
            if (n_sys > 0 && n_sys < max_ctx - 96) {
                sysToks.resize(n_sys);
                llama_batch sysBatch = llama_batch_get_one(sysToks.data(), n_sys);
                if (llama_decode(g_ctx, sysBatch) == 0) {
                    g_cached_sys_prefix = sysPrefix;
                    g_cached_sys_tokens = n_sys;
                } else {
                    llama_kv_cache_clear(g_ctx);
                }
            }
        }
    }

    // Tokenize phần hội thoại hiện tại (hoặc toàn bộ prompt nếu không có prefix cache)
    const std::string& toEval = (g_cached_sys_tokens > 0) ? suffixText : prompt;
    std::vector<llama_token> tokens(toEval.size() + 32);
    int n_tokens = llama_tokenize(
        vocab,
        toEval.c_str(),
        (int32_t)toEval.size(),
        tokens.data(),
        (int32_t)tokens.size(),
        (g_cached_sys_tokens == 0),
        true
    );

    if (n_tokens < 0) {
        tokens.resize(-n_tokens);
        n_tokens = llama_tokenize(
            vocab,
            toEval.c_str(),
            (int32_t)toEval.size(),
            tokens.data(),
            (int32_t)tokens.size(),
            (g_cached_sys_tokens == 0),
            true
        );
    }
    if (n_tokens <= 0) {
        return env->NewStringUTF("");
    }
    tokens.resize(n_tokens);

    int allowedSuffix = max_ctx - g_cached_sys_tokens - 64;
    if (allowedSuffix < 32) {
        llama_kv_cache_clear(g_ctx);
        g_cached_sys_prefix.clear();
        g_cached_sys_tokens = 0;
        allowedSuffix = max_ctx - 64;
    }
    if (n_tokens > allowedSuffix) {
        tokens.erase(tokens.begin(), tokens.begin() + (n_tokens - allowedSuffix));
        n_tokens = allowedSuffix;
    }

    llama_batch batch = llama_batch_get_one(tokens.data(), n_tokens);
    if (llama_decode(g_ctx, batch) != 0) {
        LOGE("llama_decode failed on prompt!");
        return env->NewStringUTF("");
    }

    std::string result;
    int limit = (maxTokens > 0 && maxTokens <= 140) ? maxTokens : 72;
    int generated = 0;

    while (generated < limit) {
        llama_token new_token = llama_sampler_sample(g_sampler, g_ctx, -1);

        if (llama_vocab_is_eog(vocab, new_token)) {
            break;
        }

        char buf[128];
        int n = llama_token_to_piece(vocab, new_token, buf, sizeof(buf), 0, true);
        if (n > 0) {
            result.append(buf, n);
        }

        if (result.find("<|im_end|>") != std::string::npos ||
            result.find("<|endoftext|>") != std::string::npos ||
            result.find("</s>") != std::string::npos) {
            break;
        }

        llama_batch next_batch = llama_batch_get_one(&new_token, 1);
        if (llama_decode(g_ctx, next_batch) != 0) {
            break;
        }
        generated++;
    }

    const char * stopTags[] = {"<|im_end|>", "<|endoftext|>", "</s>", "<|im_start|>"};
    for (const char * tag : stopTags) {
        size_t pos = result.find(tag);
        if (pos != std::string::npos) {
            result = result.substr(0, pos);
        }
    }

    return env->NewStringUTF(result.c_str());
}

extern "C" JNIEXPORT void JNICALL
Java_vn_io_khotrithucso_robot2027_LlamaPlugin_nativeUnload(
        JNIEnv * /* env */,
        jobject /* this */) {
    free_all();
}
