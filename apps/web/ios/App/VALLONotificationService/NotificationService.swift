import Foundation
import UserNotifications

// THE PICTURE ON THE LOCK SCREEN (FEATURE_BACKLOG A1, Agent NATIVE job 6,
// 7 November 2026). A Notification Service Extension: iOS hands it every push
// that carries `mutable-content: 1` (all of Vallo's do, `lib/push/transport/
// apns.ts`) before the push is shown, and gives it about 30 seconds to change
// it. This one does one thing: when the payload names an `image` (an https
// address the server already checked, `lib/push/imagery.ts`), it downloads
// it and attaches it, so the notification shows the place's photograph or
// the writer's face as its thumbnail, and large when it is pressed.
//
// Grouping is already the push's own `thread-id` (one conversation is one
// stack) and the header line is `alert.subtitle`, both set by the server. If
// anything goes wrong (no image, a slow network, an image iOS will not
// take), the push is shown exactly as it arrived: never held back, never lost.
//
// NOT IN THE XCODE PROJECT YET (NATIVE_BUILD_QUEUE item 4 says how to add the
// target). Built, not tested on a device.
final class NotificationService: UNNotificationServiceExtension {
    private var handler: ((UNNotificationContent) -> Void)?
    private var content: UNMutableNotificationContent?
    private var task: URLSessionDownloadTask?
    /// The download and the expiry can finish at the same moment: one wins.
    private let lock = NSLock()

    override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        handler = contentHandler
        guard let mutable = request.content.mutableCopy() as? UNMutableNotificationContent else {
            contentHandler(request.content)
            return
        }
        content = mutable

        guard let raw = request.content.userInfo["image"] as? String,
              raw.count <= 1024,
              let url = URL(string: raw),
              url.scheme == "https" else {
            contentHandler(mutable)
            return
        }

        let session = URLSession(configuration: .ephemeral)
        task = session.downloadTask(with: url) { [weak self] location, response, _ in
            guard let self = self else { return }
            defer { self.finish() }
            guard let location = location,
                  let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { return }
            // iOS reads the type from the file's extension.
            let ext: String
            switch (response?.mimeType ?? "").lowercased() {
            case "image/png": ext = "png"
            case "image/gif": ext = "gif"
            case "image/webp": ext = "webp"
            default: ext = "jpg"
            }
            let file = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension(ext)
            do {
                try FileManager.default.moveItem(at: location, to: file)
                let attachment = try UNNotificationAttachment(identifier: "image", url: file, options: nil)
                self.content?.attachments = [attachment]
            } catch {
                // Shown without the picture.
            }
        }
        task?.resume()
    }

    /// iOS is about to give up on the extension: show what there is.
    override func serviceExtensionTimeWillExpire() {
        task?.cancel()
        finish()
    }

    private func finish() {
        lock.lock()
        let handler = self.handler
        self.handler = nil
        lock.unlock()
        if let handler = handler, let content = content { handler(content) }
    }
}
