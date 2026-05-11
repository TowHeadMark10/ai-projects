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
  private var currentPushToken: String?
  private var currentEndTimestamp: Double = 0
  private var minuteWorkItems: [DispatchWorkItem] = []
  private var safetyWorkItem: DispatchWorkItem?
  private var lastPauseState: Bool = false

  private let workerURL = "https://pomodoro-apns.marcogilbertorm.workers.dev/"
  private let networkSession: URLSession = {
    let config = URLSessionConfiguration.ephemeral
    config.timeoutIntervalForRequest = 3.0
    config.timeoutIntervalForResource = 5.0
    return URLSession(configuration: config)
  }()

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
    currentPushToken = nil
    currentEndTimestamp = 0

    let adjustedEnd = Int(totalSeconds) >= 3600 ? endTimestamp - 1.0 : endTimestamp
    currentEndTimestamp = adjustedEnd
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
      let newActivity = try Activity.request(
        attributes: PomodoroActivityAttributes(),
        content: ActivityContent(state: state, staleDate: Date(timeIntervalSince1970: adjustedEnd)),
        pushType: .token
      )
      activity = newActivity
      Task {
        for await tokenData in newActivity.pushTokenUpdates {
          let token = tokenData.map { String(format: "%02x", $0) }.joined()
          self.currentPushToken = token
          print("APNs push token received: \(token.prefix(20))...")
          self.registerScheduler(token: token)
        }
      }
      scheduleEndTimer(endTimestamp: adjustedEnd, sessionType: sessionType,
                       totalSeconds: Int(totalSeconds), pomodoroCount: Int(pomodoroCount))
      scheduleMinuteUpdates(endTimestamp: adjustedEnd, sessionType: sessionType,
                            totalSeconds: Int(totalSeconds), pomodoroCount: Int(pomodoroCount))
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
    // Don't overwrite a done state with a paused/running state
    if adjustedEnd <= Date().timeIntervalSince1970 { return }
    let state = PomodoroActivityAttributes.ContentState(
      endTimestamp: adjustedEnd,
      isPaused: isPaused,
      timeRemaining: Int(timeRemaining),
      sessionType: currentSessionType,
      totalSeconds: currentTotalSeconds,
      pomodoroCount: currentPomodoroCount
    )

    guard let target = activity else { return }

    if Int(timeRemaining) > 0 {
      if !isPaused {
        currentEndTimestamp = adjustedEnd
        scheduleEndTimer(endTimestamp: adjustedEnd, sessionType: currentSessionType,
                         totalSeconds: currentTotalSeconds, pomodoroCount: currentPomodoroCount)
        if lastPauseState {
          scheduleMinuteUpdates(endTimestamp: adjustedEnd, sessionType: currentSessionType,
                                totalSeconds: currentTotalSeconds, pomodoroCount: currentPomodoroCount)
          if let token = currentPushToken { registerScheduler(token: token) }
        }
      } else if !lastPauseState {
        cancelMinuteUpdates()
        cancelScheduler()
        safetyWorkItem?.cancel()
        safetyWorkItem = nil
      }
      lastPauseState = isPaused
    }

    guard Int(timeRemaining) != 0 else { return }

    let staleDate: Date? = !isPaused ? Date(timeIntervalSince1970: adjustedEnd) : nil
    Task {
      await target.update(ActivityContent(state: state, staleDate: staleDate))
    }
  }

  @objc func dismissActivity() {
    safetyWorkItem?.cancel()
    safetyWorkItem = nil
    cancelMinuteUpdates()
    cancelScheduler()
    currentPushToken = nil
    let current = activity
    activity = nil
    Task { await current?.end(nil, dismissalPolicy: .immediate) }
  }

  private func scheduleEndTimer(endTimestamp: Double, sessionType: String,
                                totalSeconds: Int, pomodoroCount: Int)
  {
    let safetyDelay = endTimestamp - Date().timeIntervalSince1970 + 1.0
    guard safetyDelay > 0 else { return }
    safetyWorkItem?.cancel()
    guard let target = activity else { return }
    let safetyItem = DispatchWorkItem { [weak self] in
      guard let self else { return }
      self.fallbackUpdate(target: target, sessionType: sessionType,
                          totalSeconds: totalSeconds, pomodoroCount: pomodoroCount,
                          endTimestamp: endTimestamp)
    }
    safetyWorkItem = safetyItem
    DispatchQueue.global(qos: .userInitiated).asyncAfter(
      deadline: .now() + safetyDelay, execute: safetyItem
    )
  }

  private func sendWorkerPush(token: String, sessionType: String,
                              totalSeconds: Int, pomodoroCount: Int,
                              endTimestamp: Double, timeRemaining: Int, isDone: Bool,
                              activityRef _: Activity<PomodoroActivityAttributes>? = nil)

  {
    guard let url = URL(string: workerURL) else { return }
    var req = URLRequest(url: url, timeoutInterval: 2.0)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    #if DEBUG
      let isSandbox = true
    #else
      let isSandbox = false
    #endif
    let payload: [String: Any] = [
      "token": token,
      "sessionType": sessionType,
      "totalSeconds": totalSeconds,
      "pomodoroCount": pomodoroCount,
      "endTimestamp": endTimestamp,
      "timeRemaining": timeRemaining,
      "isDone": isDone,
      "sandbox": isSandbox,
    ]
    req.httpBody = try? JSONSerialization.data(withJSONObject: payload)
    networkSession.dataTask(with: req) { [weak self] data, response, _ in guard let self else { return }
      let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 0
      let responseBody = data.flatMap { String(data: $0, encoding: .utf8) } ?? ""
      print("Worker response (\(isDone ? "done" : "update")) — status: \(statusCode), body: \(responseBody)")
    }.resume()
  }

  private func registerScheduler(token: String) {
    guard let url = URL(string: workerURL + "schedule") else { return }
    var req = URLRequest(url: url, timeoutInterval: 5.0)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    #if DEBUG
      let isSandbox = true
    #else
      let isSandbox = false
    #endif
    let payload: [String: Any] = [
      "token": token,
      "sessionType": currentSessionType,
      "totalSeconds": currentTotalSeconds,
      "pomodoroCount": currentPomodoroCount,
      "endTimestamp": currentEndTimestamp,
      "sandbox": isSandbox,
    ]
    req.httpBody = try? JSONSerialization.data(withJSONObject: payload)
    networkSession.dataTask(with: req) { _, response, _ in
      let status = (response as? HTTPURLResponse)?.statusCode ?? 0
      print("DO register → \(status)")
    }.resume()
  }

  private func cancelScheduler() {
    guard let token = currentPushToken,
          let url = URL(string: workerURL + "cancel") else { return }
    var req = URLRequest(url: url, timeoutInterval: 5.0)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.httpBody = try? JSONSerialization.data(withJSONObject: ["token": token])
    networkSession.dataTask(with: req) { _, response, _ in
      let status = (response as? HTTPURLResponse)?.statusCode ?? 0
      print("DO cancel → \(status)")
    }.resume()
  }

  private func scheduleMinuteUpdates(endTimestamp: Double, sessionType: String,
                                     totalSeconds: Int, pomodoroCount: Int)
  {
    cancelMinuteUpdates()
    let now = Date().timeIntervalSince1970
    let maxMinutes = totalSeconds / 60
    guard maxMinutes > 0 else { return }
    for m in 1 ... maxMinutes {
      let fireAt = endTimestamp - Double(m * 60)
      let delay = fireAt - now
      guard delay > 1 else { continue }
      let remaining = m * 60
      let item = DispatchWorkItem { [weak self] in
        guard let self, let token = self.currentPushToken else { return }
        self.sendWorkerPush(token: token, sessionType: sessionType,
                            totalSeconds: totalSeconds, pomodoroCount: pomodoroCount,
                            endTimestamp: endTimestamp, timeRemaining: remaining, isDone: false)
      }
      minuteWorkItems.append(item)
      DispatchQueue.global(qos: .userInitiated).asyncAfter(deadline: .now() + delay, execute: item)
    }
  }

  private func cancelMinuteUpdates() {
    minuteWorkItems.forEach { $0.cancel() }
    minuteWorkItems.removeAll()
  }

  private func fallbackUpdate(target: Activity<PomodoroActivityAttributes>,
                              sessionType: String, totalSeconds: Int,
                              pomodoroCount: Int, endTimestamp: Double)
  {
    let doneState = PomodoroActivityAttributes.ContentState(
      endTimestamp: endTimestamp,
      isPaused: false,
      timeRemaining: 0,
      sessionType: sessionType,
      totalSeconds: totalSeconds,
      pomodoroCount: pomodoroCount
    )
    // Update (not end) so the DI pill stays visible showing ✅.
    // The activity is ended when the user opens the app or starts a new session.
    Task(priority: .high) {
      await target.update(ActivityContent(state: doneState, staleDate: nil))
    }
  }

  @objc static func requiresMainQueueSetup() -> Bool {
    false
  }
}
