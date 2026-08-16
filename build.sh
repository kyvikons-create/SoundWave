

set -euo pipefail

xcrun --sdk iphoneos clang \
  -arch arm64 \
  -mios-version-min=15.0 \
  -fobjc-arc \
  -framework UIKit -framework Foundation -framework CoreFoundation \
  -framework WebKit -framework AVFAudio -framework MediaPlayer \
  app.m -o SoundWave

echo "== ad-hoc codesign =="
codesign --force --sign - --timestamp=none SoundWave

APP="Payload/SoundWave.app"
mkdir -p "$APP/www"
cp SoundWave "$APP/SoundWave"
cp Info.plist "$APP/Info.plist"
cp icon120.png "$APP/AppIcon60x60@2x.png"
cp icon180.png "$APP/AppIcon60x60@3x.png"
cp index.html "$APP/www/index.html"

rm -f SoundWave.ipa
zip -qr SoundWave.ipa Payload
echo "== готово =="
ls -la SoundWave.ipa
