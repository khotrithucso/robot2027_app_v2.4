import os
import re

# 1. Patch variables.gradle -> minSdkVersion = 24
vars_path = "android/variables.gradle"
if os.path.exists(vars_path):
    with open(vars_path, "r", encoding="utf-8") as f:
        content = f.read()
    content = re.sub(r"minSdkVersion\s*=\s*\d+", "minSdkVersion = 24", content)
    with open(vars_path, "w", encoding="utf-8") as f:
        f.write(content)

# 2. Patch android/app/build.gradle -> CMake + arm64-v8a
app_gradle = "android/app/build.gradle"
if os.path.exists(app_gradle):
    with open(app_gradle, "r", encoding="utf-8") as f:
        g = f.read()

    if "externalNativeBuild" not in g:
        cmake_block = '''
    defaultConfig {
        ndk {
            abiFilters 'arm64-v8a'
        }
        externalNativeBuild {
            cmake {
                cppFlags "-std=c++17 -O3"
            }
        }
    }
    externalNativeBuild {
        cmake {
            path "src/main/cpp/CMakeLists.txt"
            version "3.22.1"
        }
    }
'''
        g = g.replace("android {", "android {
" + cmake_block, 1)
    with open(app_gradle, "w", encoding="utf-8") as f:
        f.write(g)

# 3. Patch AndroidManifest.xml -> Permissions & Cleartext HTTP
manifest_path = "android/app/src/main/AndroidManifest.xml"
if os.path.exists(manifest_path):
    with open(manifest_path, "r", encoding="utf-8") as f:
        m = f.read()

    perms = [
        '<uses-permission android:name="android.permission.INTERNET" />',
        '<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />',
        '<uses-permission android:name="android.permission.RECORD_AUDIO" />',
        '<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />',
        '<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />'
    ]
    for p in perms:
        if p not in m:
            m = m.replace("<application", p + "
    <application", 1)

    if 'usesCleartextTraffic' not in m:
        m = m.replace("<application", '<application android:usesCleartextTraffic="true" android:requestLegacyExternalStorage="true"', 1)

    with open(manifest_path, "w", encoding="utf-8") as f:
        f.write(m)

print("Patched Gradle and AndroidManifest successfully for V2.4!")
