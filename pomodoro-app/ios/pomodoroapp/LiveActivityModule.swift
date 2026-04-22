import ActivityKit
import Foundation

struct PomodoroActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var endTimestamp: Double
        var isPaused: Bool
        var timeRemaining: Int
    }
    var sessionType: String
    var totalSeconds: Int
}

@objc(LiveActivityModule)
class LiveActivityModule: NSObject {
    private var activity: Activity<PomodoroActivityAttributes>?

    @objc func startActivity(
        _ sessionType: String,
        totalSeconds: Double,
        endTimestamp: Double,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            resolve(nil)
            return
        }
        let attrs = PomodoroActivityAttributes(
            sessionType: sessionType, totalSeconds: Int(totalSeconds))
        let state = PomodoroActivityAttributes.ContentState(
            endTimestamp: endTimestamp, isPaused: false, timeRemaining: Int(totalSeconds))
        do {
            self.activity = try Activity.request(
                attributes: attrs, content: ActivityContent(state: state, staleDate: nil))
            resolve(nil)
        } catch {
            reject("ERR_LIVE_ACTIVITY", error.localizedDescription, error)
        }
    }

    @objc func updateActivity(
        _ endTimestamp: Double,
        isPaused: Bool,
        timeRemaining: Double,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        Task {
            let state = PomodoroActivityAttributes.ContentState(
                endTimestamp: endTimestamp, isPaused: isPaused, timeRemaining: Int(timeRemaining))
            await self.activity?.update(ActivityContent(state: state, staleDate: nil))
            resolve(nil)
        }
    }

    @objc func endActivity(
        _ timeRemaining: Double,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        Task {
            let state = PomodoroActivityAttributes.ContentState(
                endTimestamp:
                    Date().timeIntervalSince1970, isPaused: false, timeRemaining: Int(timeRemaining)
            )
            let target = self.activity ?? Activity<PomodoroActivityAttributes>.activities.first
            await target?.end(
                ActivityContent(state: state, staleDate: nil), dismissalPolicy: .immediate)
            self.activity = nil
            resolve(nil)
        }
    }

    @objc static func requiresMainQueueSetup() -> Bool { false }
}
