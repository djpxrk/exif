import Capacitor
import CoreImage
import Foundation

/// Develops RAW files (ARW, DNG and anything else Apple's RAW engine knows)
/// with CoreImage and hands back a JPEG the web view can draw.
/// Used when a RAW file's embedded preview is too small.
@objc(RawDecoderPlugin)
public class RawDecoderPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RawDecoderPlugin"
    public let jsName = "RawDecoder"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "decode", returnType: CAPPluginReturnPromise)
    ]

    private lazy var context = CIContext(options: [.cacheIntermediates: false])

    @objc func decode(_ call: CAPPluginCall) {
        guard let base64 = call.getString("data"),
              let data = Data(base64Encoded: base64) else {
            call.reject("No RAW data was sent.")
            return
        }
        let maxPixels = call.getDouble("maxPixels") ?? 40_000_000

        DispatchQueue.global(qos: .userInitiated).async {
            guard let filter = CIRAWFilter(imageData: data, identifierHint: nil) else {
                call.reject("iOS can't read this RAW format.")
                return
            }
            let native = filter.nativeSize
            let pixels = Double(native.width * native.height)
            if pixels > maxPixels {
                filter.scaleFactor = Float((maxPixels / pixels).squareRoot())
            }
            guard let image = filter.outputImage,
                  let srgb = CGColorSpace(name: CGColorSpace.sRGB),
                  let jpeg = self.context.jpegRepresentation(
                      of: image,
                      colorSpace: srgb,
                      options: [kCGImageDestinationLossyCompressionQuality as CIImageRepresentationOption: 0.95]
                  ) else {
                call.reject("iOS couldn't develop this RAW file.")
                return
            }
            let url = FileManager.default.temporaryDirectory
                .appendingPathComponent(UUID().uuidString)
                .appendingPathExtension("jpg")
            do {
                try jpeg.write(to: url)
                call.resolve([
                    "url": url.absoluteString,
                    "width": Int(image.extent.width),
                    "height": Int(image.extent.height),
                ])
            } catch {
                call.reject("Couldn't write the developed image: \(error.localizedDescription)")
            }
        }
    }
}

/// Bridge view controller that registers the app's local plugins.
class AppViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(RawDecoderPlugin())
    }
}
