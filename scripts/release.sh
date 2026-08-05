#!/usr/bin/env bash
# Sube versión y compila el APK de release. Ver COMPILAR.md §"Subir versión".
#
#   ./scripts/release.sh                      # 1.0.2 -> 1.0.3
#   ./scripts/release.sh minor                # 1.0.2 -> 1.1.0
#   ./scripts/release.sh 2.0.0                # versión explícita
#   ./scripts/release.sh patch "• Arregla X"  # con changelog para version.json
#
# ponytail: bash + node -e para editar los JSON; no vale una dep para tres campos.
set -euo pipefail

cd "$(dirname "$0")/.."

JAVA_HOME=${JAVA_HOME:-$HOME/jdks/jdk-17.0.13+11}
ANDROID_HOME=${ANDROID_HOME:-$HOME/Android/Sdk}
export JAVA_HOME ANDROID_HOME

[ -d "$JAVA_HOME" ] || { echo "✗ JDK 17 no está en $JAVA_HOME (obligatorio, ver COMPILAR.md)"; exit 1; }
[ -d "$ANDROID_HOME" ] || { echo "✗ Android SDK no está en $ANDROID_HOME"; exit 1; }

BUMP=${1:-patch}
NOTAS=${2:-}

# 1. Calcular la versión nueva a partir de app.json.
NUEVA=$(node -e '
  const bump = process.argv[1];
  const actual = require("./app.json").expo.version;
  if (/^\d+\.\d+\.\d+$/.test(bump)) { console.log(bump); process.exit(0); }
  const [ma, mi, pa] = actual.split(".").map(Number);
  const next = { major: [ma + 1, 0, 0], minor: [ma, mi + 1, 0], patch: [ma, mi, pa + 1] }[bump];
  if (!next) { console.error(`bump inválido: ${bump} (usa major|minor|patch|X.Y.Z)`); process.exit(1); }
  console.log(next.join("."));
' "$BUMP")

# 2. Escribir app.json (version + versionCode) y version.json con el MISMO versionCode.
CODE=$(node -e '
  const fs = require("fs");
  const [version, notas] = process.argv.slice(1);
  const app = JSON.parse(fs.readFileSync("app.json", "utf8"));
  const code = app.expo.android.versionCode + 1;
  app.expo.version = version;
  app.expo.android.versionCode = code;
  fs.writeFileSync("app.json", JSON.stringify(app, null, 2) + "\n");

  const v = JSON.parse(fs.readFileSync("version.json", "utf8"));
  v.versionCode = code;
  v.versionName = version;
  v.apkUrl = `CensoCooler-${version}.apk`;
  if (notas) v.whatsNew = notas;
  fs.writeFileSync("version.json", JSON.stringify(v, null, 2) + "\n");
  console.log(code);
' "$NUEVA" "$NOTAS")

echo "▶ Versión $NUEVA (versionCode $CODE)"

# 3. El .env se embebe en el bundle: avisar si quedó en mock antes de gastar el build.
if [ -f .env ] && grep -q '^EXPO_PUBLIC_USE_MOCK=true' .env; then
  echo "⚠ .env tiene EXPO_PUBLIC_USE_MOCK=true — el APK saldrá con datos simulados."
  read -rp "  ¿Continuar? [y/N] " r; [ "$r" = y ] || exit 1
fi

npm run check
npm run typecheck

# 4. Build.
npx expo prebuild --platform android --clean
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
(cd android && ./gradlew assembleRelease)

# 5. Verificar que el APK salió con la versión que pedimos.
grep -E 'versionCode|versionName' android/app/build.gradle
grep -q "versionCode $CODE" android/app/build.gradle || { echo "✗ build.gradle no tiene versionCode $CODE"; exit 1; }

APK=android/app/build/outputs/apk/release/app-release.apk
[ -f "$APK" ] || { echo "✗ no se generó $APK"; exit 1; }

mkdir -p dist
cp "$APK" "dist/CensoCooler-$NUEVA.apk"
echo "✓ dist/CensoCooler-$NUEVA.apk ($(du -h "$APK" | cut -f1))"
echo "  Falta: subir el APK y version.json a https://files.censo.aaocsa.com/app-release/"
