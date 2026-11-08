import Foundation
import Capacitor
import CallKit
import AVFoundation

/// Capacitor plugin that bridges the JS call lifecycle to iOS CallKit.
/// Registered as "ValloCallKit" to match the JS registerPlugin name.
@objc(ValloCallKitPlugin)
public class ValloCallKitPlugin: CAPPlugin, CXProviderDelegate {
    private let provider: CXProvider = {
        let config = CXProviderConfiguration()
        config.maximumCallGroups = 1
        config.maximumCallsPerCallGroup = 1
        config.supportsVideo = true
        config.iconTemplateImageData = nil
        return CXProvider(configuration: config)
    }()

    private let controller = CXCallController()
    private var activeCalls: [UUID: CXCall] = [:]

    override public func load() {
        provider.setDelegate(self, queue: nil)
    }

    // MARK: - JS bridge methods

    @objc func reportNewCall(_ call: CAPPluginCall) {
        guard let callIdStr = call.getString("callId"),
              let callId = UUID(uuidString: callIdStr),
              let displayName = call.getString("displayName") else {
            call.reject("Missing callId or displayName")
            return
        }

        let isOutgoing = call.getBool("isOutgoing") ?? false
        let kind = call.getString("kind") ?? "AUDIO"
        let hasVideo = kind == "VIDEO"

        if isOutgoing {
            let handle = CXHandle(type: .generic, value: displayName)
            let startAction = CXStartCallAction(call: callId, handle: handle)
            startAction.isVideo = hasVideo
            startAction.contactIdentifier = displayName
            let transaction = CXTransaction(action: startAction)
            controller.request(transaction) { error in
                if let error = error {
                    call.reject("Failed to start call: \(error.localizedDescription)")
                } else {
                    call.resolve()
                }
            }
        } else {
            let update = CXCallUpdate()
            update.remoteHandle = CXHandle(type: .generic, value: displayName)
            update.localizedCallerName = displayName
            update.hasVideo = hasVideo
            update.supportsHolding = call.getBool("supportsHold") ?? false
            update.supportsGrouping = call.getBool("supportsGrouping") ?? false

            provider.reportNewIncomingCall(with: callId, update: update) { error in
                if let error = error {
                    call.reject("Failed to report incoming call: \(error.localizedDescription)")
                } else {
                    call.resolve()
                }
            }
        }
    }

    @objc func configureAudio(_ call: CAPPluginCall) {
        let mode = call.getString("mode") ?? "voiceChat"
        let preferredOutput = call.getString("preferredOutput") ?? "earpiece"

        do {
            let session = AVAudioSession.sharedInstance()
            let avMode: AVAudioSession.Mode = mode == "videoChat" ? .videoChat : .voiceChat
            try session.setCategory(.playAndRecord, mode: avMode, options: [.allowBluetooth, .defaultToSpeaker])

            if preferredOutput == "speaker" {
                try session.overrideOutputAudioPort(.speaker)
            } else {
                try session.overrideOutputAudioPort(.none)
            }

            try session.setActive(true)
            call.resolve()
        } catch {
            call.reject("Audio configuration failed: \(error.localizedDescription)")
        }
    }

    @objc func updateCall(_ call: CAPPluginCall) {
        guard let callIdStr = call.getString("callId"),
              let callId = UUID(uuidString: callIdStr) else {
            call.reject("Missing callId")
            return
        }

        if call.getBool("connected") == true {
            provider.reportOutgoingCall(with: callId, connectedAt: Date())
        }

        if call.getBool("ended") == true {
            let reasonStr = call.getString("endReason") ?? "remoteEnded"
            let reason: CXCallEndedReason
            switch reasonStr {
            case "failed": reason = .failed
            case "unanswered": reason = .unanswered
            case "declinedElsewhere": reason = .declinedElsewhere
            case "answeredElsewhere": reason = .answeredElsewhere
            default: reason = .remoteEnded
            }
            provider.reportCall(with: callId, endedAt: Date(), reason: reason)
        }

        if let output = call.getString("preferredOutput") {
            do {
                let session = AVAudioSession.sharedInstance()
                if output == "speaker" {
                    try session.overrideOutputAudioPort(.speaker)
                } else {
                    try session.overrideOutputAudioPort(.none)
                }
            } catch {}
        }

        call.resolve()
    }

    @objc func endCall(_ call: CAPPluginCall) {
        guard let callIdStr = call.getString("callId"),
              let callId = UUID(uuidString: callIdStr) else {
            call.reject("Missing callId")
            return
        }

        let endAction = CXEndCallAction(call: callId)
        let transaction = CXTransaction(action: endAction)
        controller.request(transaction) { error in
            if let error = error {
                call.reject("Failed to end call: \(error.localizedDescription)")
            } else {
                call.resolve()
            }
        }
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": true])
    }

    // MARK: - CXProviderDelegate

    public func providerDidReset(_ provider: CXProvider) {
        activeCalls.removeAll()
    }

    public func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        notifyListeners("callEvent", data: [
            "event": "answerCall",
            "callId": action.callUUID.uuidString
        ])
        action.fulfill()
    }

    public func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        notifyListeners("callEvent", data: [
            "event": "endCall",
            "callId": action.callUUID.uuidString
        ])
        action.fulfill()
    }

    public func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
        notifyListeners("callEvent", data: [
            "event": "setMuted",
            "callId": action.callUUID.uuidString,
            "muted": action.isMuted
        ])
        action.fulfill()
    }

    public func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {}

    public func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
        do { try audioSession.setActive(false) } catch {}
    }
}
