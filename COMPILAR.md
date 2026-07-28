# Cómo compilar CensoCooler (APK Android)

App Expo / React Native. **No usa EAS Build**: se compila localmente con Gradle.

La carpeta `android/` **no está en git** (`.gitignore` la excluye). Se genera con
`npx expo prebuild` a partir de `app.json`. Es desechable: si algo se rompe, se borra y se regenera.

---

## 1. Requisitos (una sola vez)

| Herramienta | Versión | Nota |
|---|---|---|
| Node.js + npm | LTS (18/20) | dependencias JS |
| JDK | **17** (obligatorio) | Gradle NO funciona con Java 25 |
| Android SDK | platform-tools + build-tools | ya instalado en `~/Android/Sdk` |

### JDK 17 sin root

```bash
mkdir -p ~/jdks
curl -fsSL -o /tmp/jdk17.tar.gz \
  "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.13%2B11/OpenJDK17U-jdk_x64_linux_hotspot_17.0.13_11.tar.gz"
tar -xzf /tmp/jdk17.tar.gz -C ~/jdks
# Queda en: ~/jdks/jdk-17.0.13+11
```

> Con root: `sudo dnf install -y java-17-openjdk-devel`

---

## 2. Compilar

```bash
cd /run/media/yaxon/5E46992F46990943/YaxonFolder/Github/CensoEnfriadores_ReactNative

# 1. Dependencias JS (primera vez, o si cambió package.json)
npm install

# 2. .env con la URL real del backend  ← SE EMBEBE EN EL APK, revísalo ANTES de compilar
cat .env    # EXPO_PUBLIC_USE_MOCK=false / EXPO_PUBLIC_API_URL=https://api.censo.aaocsa.com/api

# 3. Generar android/ desde app.json (nombre, ícono, permisos, plugins)
npx expo prebuild --platform android

# 4. SDK de Android (prebuild NO lo escribe)
echo "sdk.dir=$HOME/Android/Sdk" > android/local.properties

# 5. Build release
cd android
JAVA_HOME=~/jdks/jdk-17.0.13+11 ANDROID_HOME=~/Android/Sdk ./gradlew assembleRelease
```

**Resultado:**
```
android/app/build/outputs/apk/release/app-release.apk   (~126 MB, firmado)
```

Primera vez ≈ 10 min (descarga Gradle + compila el nativo de React Native para 4 ABIs).
Builds siguientes: mucho más rápido (caché de Gradle).

`prebuild` avisa dos cosas que se pueden ignorar: `edgeToEdgeEnabled` deprecado y
`userInterfaceStyle` sin `expo-system-ui`. Ninguna rompe el build.

### Verificar que salió bien

```bash
~/Android/Sdk/build-tools/37.0.0/aapt2 dump badging \
  android/app/build/outputs/apk/release/app-release.apk | grep -E "^package|application-label"
# package: name='com.censoenfriadores.app' versionCode='1' versionName='1.0.0'
# application-label:'CensoCooler'
```

---

## 3. Instalar en el teléfono

```bash
~/Android/Sdk/platform-tools/adb install -r \
  android/app/build/outputs/apk/release/app-release.apk
```

`-r` reinstala sobre la versión previa (debe ser la misma firma).
O copiar el `.apk` al teléfono y abrirlo (permitir "instalar apps desconocidas").

---

## 4. La firma

`prebuild` deja `signingConfig signingConfigs.debug` **también en release**: el APK sale firmado con
el `debug.keystore` que el propio template genera.

- Sirve para instalar por USB o repartiendo el `.apk`. ✅
- **No** sirve para Google Play, y ese keystore se regenera con cada `prebuild`, así que las
  actualizaciones pueden chocar por firma distinta. ❌

Si se va a distribuir en serio, hay que crear un keystore propio, guardarlo **fuera** de `android/`
(que es desechable) y cablearlo en `android/app/build.gradle`. Pendiente, no hecho.

⚠️ Un keystore de producción **no se puede perder**: sin él no se puede actualizar la app publicada.

---

## 5. Qué recompilar según lo que cambié

| Cambié… | Qué correr |
|---|---|
| JS/TS (`app/`, `src/`) | `cd android && ./gradlew assembleRelease` |
| `.env` (URL del backend) | igual — el valor se embebe en el bundle al compilar |
| `app.json` (nombre, ícono, permisos, plugins) | `npx expo prebuild --platform android` y luego el build |
| Dependencias (`npm install xxx`) | `npm install`, y si es módulo nativo, `prebuild` antes del build |

(Anteponer siempre `JAVA_HOME=~/jdks/jdk-17.0.13+11 ANDROID_HOME=~/Android/Sdk` a `./gradlew`.)

**Build falla raro / caché corrupto:** borra y regenera, es más rápido que pelearse:
```bash
rm -rf android && npx expo prebuild --platform android
echo "sdk.dir=$HOME/Android/Sdk" > android/local.properties
cd android && JAVA_HOME=~/jdks/jdk-17.0.13+11 ANDROID_HOME=~/Android/Sdk ./gradlew assembleRelease
```

### Subir versión

1. `app.json` → `expo.version` (ej. `1.0.0` → `1.0.1`).
2. `expo.android.versionCode` en `app.json` (+1). `prebuild` lo escribe al `build.gradle`; editar
   el `build.gradle` a mano no sirve, el siguiente `prebuild` lo pisa.
3. `prebuild` + build.
4. Publicar en el servidor de updates: subir el `.apk` a
   `https://files.censo.aaocsa.com/app-release/` y actualizar ahí el `version.json` con el
   **mismo** `versionCode` del paso 2. Si el JSON no se actualiza, nadie recibe la versión;
   si dice un `versionCode` mayor al del APK publicado, todos ven el aviso para siempre.
   Formato del JSON: ver *Auto-actualización del APK* en `CLAUDE.md`.

---

## 6. Variantes

| Comando | Salida | Uso |
|---|---|---|
| `./gradlew assembleRelease` | `app-release.apk` (~126 MB) | instalar directo en teléfonos |
| `./gradlew bundleRelease` | `app-release.aab` | Google Play (requiere keystore propio) |
| `./gradlew assembleDebug` | `app-debug.apk` | necesita Metro corriendo; para dev usa `npx expo start` |

El APK de 126 MB es universal (arm64, armv7, x86, x86_64). Para bajarlo: ABI splits o AAB.

---

## 7. Atajo (opcional)

En `~/.zshrc`:
```bash
export JAVA_HOME=~/jdks/jdk-17.0.13+11
export ANDROID_HOME=~/Android/Sdk
export PATH=$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH
```
Después el build es solo `cd android && ./gradlew assembleRelease`.

---

## TL;DR

```bash
npm install
npx expo prebuild --platform android
echo "sdk.dir=$HOME/Android/Sdk" > android/local.properties
cd android && JAVA_HOME=~/jdks/jdk-17.0.13+11 ANDROID_HOME=~/Android/Sdk ./gradlew assembleRelease
# APK en: android/app/build/outputs/apk/release/app-release.apk
```
