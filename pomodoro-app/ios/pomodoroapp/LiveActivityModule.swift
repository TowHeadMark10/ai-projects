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
      // Subtract 1s from endTimestamp when session is exactly 60min so                       
      // Text(timerInterval:) stays in M:SS format instead of switching to H:MM:SS            
      let adjustedEnd = Int(totalSeconds) >= 3600 ? endTimestamp - 1.0 : endTimestamp         
      let state = PomodoroActivityAttributes.ContentState(                                    
      endTimestamp: adjustedEnd,                                                          
      isPaused: false,                                                                    
      timeRemaining: Int(adjustedEnd - Date().timeIntervalSince1970),
      sessionType: sessionType,                                                           
      totalSeconds: Int(totalSeconds)
  )                  
      if let own = self.activity, own.activityState == .active {
        await own.update(ActivityContent(state: state, staleDate: nil))
        resolve(nil)
        return
      }
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
      // Apply same -1s adjustment as startActivity for 60min sessions                        
      // so JS updates don't undo the endTimestamp correction
      let adjustedEnd = self.currentTotalSeconds >= 3600 ? endTimestamp - 1.0 : endTimestamp  
      let state = PomodoroActivityAttributes.ContentState(
          endTimestamp: adjustedEnd,                                                          
          isPaused: isPaused,                                                                 
          timeRemaining: Int(timeRemaining),                                                  
          sessionType: self.currentSessionType,                                               
          totalSeconds: self.currentTotalSeconds                                              
  )
      let target = self.activity ?? Activity<PomodoroActivityAttributes>.activities.first
      if Int(timeRemaining) == 0 {
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

  @objc func dismissActivity(
    _ resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    Task {
      await self.activity?.end(nil, dismissalPolicy: .immediate)
      self.activity = nil
      resolve(nil)
    }
  }

  @objc static func requiresMainQueueSetup() -> Bool { false }
}
