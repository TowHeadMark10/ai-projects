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

    // Subtract 1s from endTimestamp when session is exactly 60min so
    // Text(timerInterval:) stays in M:SS format instead of switching to H:MM:SS
    let adjustedEnd = Int(totalSeconds) >= 3600 ? endTimestamp - 1.0 : endTimestamp
    let state = PomodoroActivityAttributes.ContentState(
      endTimestamp: adjustedEnd,
      isPaused: false,
      timeRemaining: Int(adjustedEnd - Date().timeIntervalSince1970),
      sessionType: sessionType,
      totalSeconds: Int(totalSeconds),
      pomodoroCount: currentPomodoroCount
    )

    // Only reuse the activity we explicitly own — never pick up orphaned activities
    // from previous sessions via activities.first (they cause stale-state flashes)
    if let existing = activity {
      Task(priority: .userInteractive) {
        await existing.update(ActivityContent(state: state, staleDate: Date(timeIntervalSince1970:
          adjustedEnd)))
      }
      return
    }

    // No owned activity — create a fresh one
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
    // Apply same -1s adjustment as startActivity for 60min sessions
    // so JS updates don't undo the endTimestamp correction
    let adjustedEnd = currentTotalSeconds >= 3600 ? endTimestamp - 1.0 : endTimestamp
    let state = PomodoroActivityAttributes.ContentState(
      endTimestamp: adjustedEnd,
      isPaused: isPaused,
      timeRemaining: Int(timeRemaining),
      sessionType: currentSessionType,
      totalSeconds: currentTotalSeconds,
      pomodoroCount: currentPomodoroCount
    )

    // Use only our owned activity — avoids accidentally updating an orphaned one
    guard let target = activity else { return }

    // Only send alert configuration when the timer is done (timeRemaining == 0)
    // to expand the DI and notify the user
    let alert: AlertConfiguration? = Int(timeRemaining) == 0 ? AlertConfiguration(
      title: LocalizedStringResource(stringLiteral: currentSessionType == "Focus"
        ? "Pomodoro complete! 🍅" : "Break's over! ☕"),
      body: LocalizedStringResource(stringLiteral: currentSessionType == "Focus"
        ? "Time to take a break." : "Time to get back to work."),
      sound: .default
    ) : nil
    Task(priority: .userInitiated) { await target.update(
      ActivityContent(state: state, staleDate: nil),
      alertConfiguration: alert
    ) }
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
