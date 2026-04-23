import ActivityKit
import Foundation

struct PomodoroActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var endTimestamp: Double
    var isPaused: Bool
    var timeRemaining: Int
    var sessionType: String
    var totalSeconds: Int
  }

}

@objc(LiveActivityModule)
class LiveActivityModule: NSObject {
  private var activity: Activity<PomodoroActivityAttributes>?
  private var currentSessionType: String = "Focus"
  private var currentTotalSeconds: Int = 1500

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
    self.currentSessionType = sessionType
    self.currentTotalSeconds = Int(totalSeconds)
    Task {
      let state = PomodoroActivityAttributes.ContentState(
        endTimestamp: endTimestamp,
        isPaused: false,
        timeRemaining: Int(totalSeconds),
        sessionType: sessionType,
        totalSeconds: Int(totalSeconds)
      )
      // Only reuse our own activity reference — never grab activities.first
      // (ended activities from the previous session can still be in that array)
      if let own = self.activity, own.activityState == .active {
        await own.update(ActivityContent(state: state, staleDate: nil))
        resolve(nil)
        return
      }
      // Dismiss any lingering ended activities before requesting a new one
      for existing in Activity<PomodoroActivityAttributes>.activities {
        await existing.end(nil, dismissalPolicy: .immediate)
      }
      do {
        self.activity = try Activity.request(
          attributes: PomodoroActivityAttributes(),
          content: ActivityContent(state: state, staleDate: nil)
        )
        resolve(nil)
      } catch {
        reject("ERR_LIVE_ACTIVITY", error.localizedDescription, error)
      }
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
        endTimestamp: endTimestamp,
        isPaused: isPaused,
        timeRemaining: Int(timeRemaining),
        sessionType: self.currentSessionType,
        totalSeconds: self.currentTotalSeconds
      )
      let target = self.activity ?? Activity<PomodoroActivityAttributes>.activities.first

      if Int(timeRemaining) == 0 {
        // Timer finished — expand Dynamic Island and lock screen with completion message
        let msg =
          self.currentSessionType == "Focus" ? "Time to take a break!" : "Time to get back to work!"
        let alert = AlertConfiguration(
          title: "🍅 Pomodoro",
          body: LocalizedStringResource(stringLiteral: msg),
          sound: .default
        )
        await target?.update(
          ActivityContent(state: state, staleDate: nil), alertConfiguration: alert)
      } else {
        await target?.update(ActivityContent(state: state, staleDate: nil))
      }
      resolve(nil)
    }
  }

  @objc static func requiresMainQueueSetup() -> Bool { false }
}
