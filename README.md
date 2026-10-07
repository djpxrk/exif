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

Strip, Instant, Gallery mat, Backdrop (blurred photo), Viewfinder (overlay), Film rebate, and:

- **Lightroom:** Lightroom-style info panel with the photo's real RGB histogram and the ISO / focal length / aperture / shutter readout.
- **Atlas:** an offline map in a compass bezel. The pin marks where the photo was taken. When the camera recorded a compass heading, a wedge shows the direction it faced, as wide as the lens's actual angle of view. Shows the town, region and country. Exact coordinates appear only when Location is turned on. Map zoom: City, Region, Country, Continent.
- **Postcard:** the photo above a postcard back. The caption is handwritten (or "Greetings from …"), and the camera details are typed on the address lines. The stamp shows a globe turned to the location, under a postmark with the town and date.
- **Slide mount:** a square 35mm slide mount with a handwritten label, a frame number and a processing date.
- **Cinema:** letterbox bars with a location/date title card, the caption as a subtitle, and a "Shot on" credit.

Options:

- **Orientation:** match the photo, or force a vertical or horizontal frame. With the original ratio this turns a horizontal photo into a vertical post (and back) by extending the background.
- **Aspect ratio:** Original, 1:1, 4:5, 3:4, 2:3, 5:7, 9:16, A4, or any custom W:H. Presets flip with the orientation (4:5 ↔ 5:4).
- **Never cropped:** ratios only add space around the frame. The photo always keeps its full resolution and shape.
- Border size, corner radius, background and typeface are adjustable. Every text line can be turned off or edited per photo.
- **35mm-equivalent focal length:** a Details option. It uses the camera's recorded value, or works it out from the sensor size when the camera didn't record one.
- Saved JPEGs can keep the camera metadata (never GPS).
- **Crop factors:** a bundled database of about 1,280 cameras and 290 product-line rules (`data/cameras/*.json`, compiled by `npm run cameras`). It covers Canon, Nikon, Sony, Fujifilm, Panasonic/LUMIX, OM System/Olympus, Leica, Ricoh/Pentax, Sigma, Hasselblad and Phase One. Phones and drones rely on the 35mm value they record.
- **Brand logos:** 32 camera and lens brands (`data/logos/*.json`, compiled by `npm run logos`).

## Maps and place names

Map frames are drawn on the device from bundled data, so a photo's location is never sent anywhere. The data is fetched only on first use (about 520 KB gzipped) and then cached for offline use.

- Countries: [Natural Earth](https://www.naturalearthdata.com/) 1:10m (public domain), via `world-atlas`, simplified with mapshaper.
- Place names: [GeoNames](https://www.geonames.org/) `cities15000` (CC BY 4.0), with region and country names.
- Rebuild with `node scripts/build-geo.mjs <geonames-dir> <world-topojson>` (see the script header).

Photos without GPS can be given a location by typing coordinates in Details → Location (e.g. `37.5665, 126.9780` or `37°33′59″N 126°58′41″E`). The Place field overrides the looked-up name.

## Full-resolution export

Frames are saved at the photo's native resolution. When a frame is larger than the browser allows in one canvas (iOS caps canvases at about 16.7 MP), it's drawn in strips and encoded by a streaming JPEG/PNG encoder in a Web Worker (`src/encode-worker.js`). Output size is never reduced to fit the device. Strip-encoded files match a normal export to within 43–48 dB PSNR, which is visually identical.

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

- Picking from the iOS Photos library can hand over a converted JPEG instead of the original RAW. To frame a RAW file, use "Choose File" and pick it from the Files app.
- Safari can't encode WebP. Choosing WebP there saves a PNG. Frames too large for one canvas are saved as JPEG or PNG only.
