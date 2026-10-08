import Capacitor
import Foundation
import Photos

/// Saves framed photos into their own album in Photos ("Rebate"), creating
/// the album the first time. The files are added byte-for-byte, so a JPEG's
/// EXIF survives. With limited library access, where albums can't be made,
/// the photos are still saved, just outside the album.
@objc(PhotoLibraryPlugin)
public class PhotoLibraryPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PhotoLibraryPlugin"
    public let jsName = "PhotoLibrary"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "saveToAlbum", returnType: CAPPluginReturnPromise)
    ]

    @objc func saveToAlbum(_ call: CAPPluginCall) {
        let urls = (call.getArray("paths", String.self) ?? []).compactMap { URL(string: $0) }.filter { $0.isFileURL }
        guard !urls.isEmpty else {
            call.reject("No files to save.")
            return
        }
        let albumName = call.getString("album") ?? "Rebate"

        PHPhotoLibrary.requestAuthorization(for: .readWrite) { status in
            switch status {
            case .authorized:
                self.save(urls, into: albumName, call: call)
            case .limited:
                self.save(urls, into: nil, call: call)
            default:
                call.reject("Rebate isn't allowed to add photos to your library.", "denied")
            }
        }
    }

    private func findAlbum(named name: String) -> PHAssetCollection? {
        let options = PHFetchOptions()
        options.predicate = NSPredicate(format: "title = %@", name)
        return PHAssetCollection.fetchAssetCollections(with: .album, subtype: .albumRegular, options: options).firstObject
    }

    private func save(_ urls: [URL], into albumName: String?, call: CAPPluginCall) {
        let existing = albumName.flatMap { findAlbum(named: $0) }
        PHPhotoLibrary.shared().performChanges({
            var placeholders: [PHObjectPlaceholder] = []
            for url in urls {
                let request = PHAssetCreationRequest.forAsset()
                let options = PHAssetResourceCreationOptions()
                options.originalFilename = url.lastPathComponent
                request.addResource(with: .photo, fileURL: url, options: options)
                if let placeholder = request.placeholderForCreatedAsset {
                    placeholders.append(placeholder)
                }
            }
            guard let albumName = albumName else { return }
            let album = existing.flatMap { PHAssetCollectionChangeRequest(for: $0) }
                ?? PHAssetCollectionChangeRequest.creationRequestForAssetCollection(withTitle: albumName)
            album.addAssets(placeholders as NSArray)
        }, completionHandler: { success, error in
            if success {
                call.resolve(["saved": urls.count, "inAlbum": albumName != nil])
            } else if albumName != nil {
                // The album step failed (e.g. restricted access): save without it.
                self.save(urls, into: nil, call: call)
            } else {
                call.reject(error?.localizedDescription ?? "Couldn't save to Photos.")
            }
        })
    }
}
