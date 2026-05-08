import ActivityKit
import Foundation

struct PomodoroActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var endTimestamp: Double
    var isPaused: Bool
    var timeRemaining: Int
    var sessionType: String
    var totalSeconds: Int
    var pomodoroCount: Int
  }
}

@objc(LiveActivityModule)
class LiveActivityModule: NSObject {
  private var activity: Activity<PomodoroActivityAttributes>?
  private var currentSessionType: String = "Focus"
  private var currentTotalSeconds: Int = 1500
  private var currentPomodoroCount: Int = 0

  @objc func startActivity(
    _ sessionType: String,
    totalSeconds: Double,
    endTimestamp: Double,
    pomodoroCount: Double
  ) {
    guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
    currentSessionType = sessionType
    currentTotalSeconds = Int(totalSeconds)
    currentPomodoroCount = Int(pomodoroCount)

    let adjustedEnd = Int(totalSeconds) >= 3600 ? endTimestamp - 1.0 : endTimestamp
    let state = PomodoroActivityAttributes.ContentState(
      endTimestamp: adjustedEnd,
      isPaused: false,
      timeRemaining: Int(adjustedEnd - Date().timeIntervalSince1970),
      sessionType: sessionType,
      totalSeconds: Int(totalSeconds),
      pomodoroCount: currentPomodoroCount
    )

    if let existing = activity {
      Task { await existing.end(nil, dismissalPolicy: .immediate) }
      activity = nil
    }

    do {
      activity = try Activity.request(
        attributes: PomodoroActivityAttributes(),
        content: ActivityContent(state: state, staleDate: Date(timeIntervalSince1970: adjustedEnd))
      )
    } catch {
      print("LiveActivity request failed: \(error.localizedDescription)")
    }
  }

  @objc func updateActivity(
    _ endTimestamp: Double,
    isPaused: Bool,
    timeRemaining: Double
  ) {
    let adjustedEnd = currentTotalSeconds >= 3600 ? endTimestamp - 1.0 : endTimestamp
    let state = PomodoroActivityAttributes.ContentState(
      endTimestamp: adjustedEnd,
      isPaused: isPaused,
      timeRemaining: Int(timeRemaining),
      sessionType: currentSessionType,
      totalSeconds: currentTotalSeconds,
      pomodoroCount: currentPomodoroCount
    )

    guard let target = activity else { return }
    guard Int(timeRemaining) != 0 else { return }

    let staleDate: Date? = !isPaused ? Date(timeIntervalSince1970: adjustedEnd) : nil
    ProcessInfo.processInfo.performExpiringActivity(withReason: "UpdateLiveActivity") { expired in
      guard !expired else { return }
      let semaphore = DispatchSemaphore(value: 0)
      Task {
        await target.update(ActivityContent(state: state, staleDate: staleDate))
        semaphore.signal()
      }
      semaphore.wait()
    }
  }

  @objc func dismissActivity() {
    let current = activity
    activity = nil
    Task { await current?.end(nil, dismissalPolicy: .immediate) }
  }

  @objc static func requiresMainQueueSetup() -> Bool {
    false
  }
}
