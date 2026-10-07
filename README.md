# Rebate

Frame your photos with their camera settings: camera, lens, focal length, aperture, shutter, ISO and date, read from EXIF and set into the border. Runs entirely on-device, as a website (installable PWA) and as a native iOS app built from the same JavaScript.

## Formats

| Format | How it's decoded |
| --- | --- |
| JPEG, PNG, WebP | Browser native |
| HEIF / HEIC / HIF | Native in Safari & the iOS app; `heic-to` (libheif wasm) elsewhere |
| TIFF | Native in Safari & the iOS app; `UTIF.js` elsewhere |
| DNG, ARW | The camera's embedded full-size JPEG preview. If the preview is small, the RAW is developed: CoreImage on iOS, `libraw-wasm` on the web |

EXIF comes from `exifr`, with a WebP `EXIF` chunk reader and a raw `Exif\0\0` scan as fallbacks.

## Frames

Strip, Instant, Gallery mat, Backdrop (blurred photo), Viewfinder (overlay) and Film rebate. Aspect ratio (Original, 1:1, 4:5, 3:4, 9:16, 3:2, 16:9), border size, corner radius, background and typeface are adjustable. Every text line can be turned off or edited per photo. Saved JPEGs can keep the camera metadata (never GPS).

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # outputs dist/
```

## Website

Live at **https://djpxrk.github.io/exif/**

To publish changes:

```bash
npm run deploy
```

This builds the site and pushes `dist/` to the `gh-pages` branch. Pages is set to **Deploy from a branch** (`gh-pages`, root) under Settings → Pages.

The RAW develop fallback (libraw-wasm) needs a cross-origin isolated page. GitHub Pages can't send the required headers, so the service worker (`public/sw.js`) adds them. On a first visit the page reloads once to pick them up. `vercel.json` sends the same headers if you ever host on Vercel instead.

## iOS app (Capacitor)

Needs a Mac with Xcode 16+ (no CocoaPods; plugins use Swift Package Manager).

```bash
npm run ios              # build web app + copy into ios/
npx cap open ios         # opens Xcode
```

In Xcode, choose your Team under Signing & Capabilities, then run on a device. The bundle id is `com.parkdj.rebate` (change it in `capacitor.config.json` and in Xcode).

Native pieces in `ios/App/App/`:
- `RawDecoderPlugin.swift`: develops RAW files with `CIRAWFilter` when the embedded preview is too small. Registered by `AppViewController`.
- `Info.plist`: photo library and camera permission strings.

Saving on iOS opens the share sheet. Choose "Save Image" to put the framed photo in Photos.

## Limits worth knowing

- iOS caps a canvas at about 16.7 megapixels, so on iPhone and iPad very large frames are saved slightly smaller. The Save tab shows the exact output size.
- Picking from the iOS Photos library can hand over a converted JPEG instead of the original RAW. To frame a RAW file, use "Choose File" and pick it from the Files app.
- Safari can't encode WebP. Choosing WebP there saves a PNG.
