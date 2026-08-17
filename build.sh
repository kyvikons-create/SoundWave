set -euo pipefail

SWIFT_OK=0
xcrun --sdk iphoneos swiftc -target arm64-apple-ios16.2 \
  -parse-as-library -emit-object \
  -o la.o LiveActivityBridge.swift 2>swift.log && SWIFT_OK=1 || {
  echo "== swift bridge не собрался, Live Activity отключён =="; cat swift.log | tail -5
}

LINK_EXTRA=""
if [ "$SWIFT_OK" = "1" ]; then LINK_EXTRA="la.o -weak_framework ActivityKit"; fi

xcrun --sdk iphoneos clang \
  -arch arm64 \
  -mios-version-min=15.0 \
  -fobjc-arc \
  -framework UIKit -framework Foundation -framework CoreFoundation \
  -framework WebKit -framework AVFAudio -framework MediaPlayer -framework Photos \
  $LINK_EXTRA \
  app.m -o SoundWave

echo "== ad-hoc codesign =="
codesign --force --sign - --timestamp=none SoundWave

APP="Payload/SoundWave.app"
mkdir -p "$APP/www"
cp SoundWave "$APP/SoundWave"
cp Info.plist "$APP/Info.plist"
cp icon120.png "$APP/AppIcon60x60@2x.png"
cp icon180.png "$APP/AppIcon60x60@3x.png"
for c in blue pink green; do
  if [ -f "alt-$c-120.png" ]; then
    cp "alt-$c-120.png" "$APP/alt-$c-120.png"
    cp "alt-$c-180.png" "$APP/alt-$c-180.png"
  fi
done
cp index.html "$APP/www/index.html"

WIDGET_OK=0
if xcrun --sdk iphoneos swiftc -target arm64-apple-ios16.2 \
    -parse-as-library -emit-library -Xlinker -bundle \
    -o Widget Widget.swift \
    -framework WidgetKit -framework SwiftUI 2>widget.log; then
  WIDGET_OK=1
else
  echo "== widget extension не собрался, Dynamic Island отключён =="; tail -5 widget.log
fi

if [ "$WIDGET_OK" = "1" ]; then
  APPEX="$APP/PlugIns/SoundWidget.appex"
  mkdir -p "$APPEX"
  cp Widget "$APPEX/Widget"
  cat > "$APPEX/Info.plist" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleDevelopmentRegion</key>
	<string>ru</string>
	<key>CFBundleExecutable</key>
	<string>Widget</string>
	<key>CFBundleIdentifier</key>
	<string>com.soundwave.app.widget</string>
	<key>CFBundleInfoDictionaryVersion</key>
	<string>6.0</string>
	<key>CFBundleName</key>
	<string>SoundWidget</string>
	<key>CFBundlePackageType</key>
	<string>XPC!</string>
	<key>CFBundleShortVersionString</key>
	<string>1.0</string>
	<key>CFBundleVersion</key>
	<string>1</string>
	<key>MinimumOSVersion</key>
	<string>16.2</string>
	<key>NSExtension</key>
	<dict>
		<key>NSExtensionPointIdentifier</key>
		<string>com.apple.widgetkit-extension</string>
	</dict>
</dict>
</plist>
EOF
  codesign --force --sign - --timestamp=none "$APPEX"
  codesign --force --sign - --timestamp=none "$APP"
  echo "== widget extension встроен =="
fi

rm -f SoundWave.ipa
zip -qr SoundWave.ipa Payload
echo "== готово =="
ls -la SoundWave.ipa
