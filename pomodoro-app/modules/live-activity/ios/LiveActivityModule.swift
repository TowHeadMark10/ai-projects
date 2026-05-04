import ActivityKit                                                                                        
import ExpoModulesCore                                                                                    
                                                                                                            
  // Attributes must match WidgetLiveActivity.swift exactly — same names and types                          
  struct PomodoroActivityAttributes: ActivityAttributes {                                                   
      struct ContentState: Codable, Hashable {                                                              
          var endTimestamp: Double  // Unix seconds — used by SwiftUI for auto-countdown                    
          var isPaused: Bool                                                                                
          var timeRemaining: Int    // seconds remaining, shown as static text when paused                  
      }                                                                                                     
      var sessionType: String  // "Focus" or "Break"                                                        
      var totalSeconds: Int    // full session length for progress ring                                     
  }                                                                                                         
                                              
  public class LiveActivityModule: Module {                                                                 
      // Holds the active activity so we can update or end it later
      private var activity: Activity<PomodoroActivityAttributes>?                                           
                                          
      public func definition() -> ModuleDefinition {                                                        
          Name("LiveActivity")                                                                              
  
          // Start a new Live Activity when the timer begins                                                
          AsyncFunction("startActivity") { (sessionType: String, totalSeconds: Int, endTimestamp: Double) in
              guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }                        
              let attributes = PomodoroActivityAttributes(
                  sessionType: sessionType,
                  totalSeconds: totalSeconds                                                                
              )                                                                                             
              let state = PomodoroActivityAttributes.ContentState(                                          
                  endTimestamp: endTimestamp,                                                               
                  isPaused: false,
                  timeRemaining: totalSeconds                                                               
              )                               
              let content = ActivityContent(state: state, staleDate: nil)
              self.activity = try Activity.request(
                  attributes: attributes,                                                                   
                  content: content
              )                                                                                             
          }       
                                                                                                            
          // Update the Live Activity on pause or resume
          AsyncFunction("updateActivity") { (endTimestamp: Double, isPaused: Bool, timeRemaining: Int) in
              let state = PomodoroActivityAttributes.ContentState(
                  endTimestamp: endTimestamp,                                                               
                  isPaused: isPaused,
                  timeRemaining: timeRemaining                                                              
              )                           
              let content = ActivityContent(state: state, staleDate: nil)                                   
              await self.activity?.update(content)                                                          
          }
                                                                                                            
          // End the Live Activity when the timer completes or is reset
          AsyncFunction("endActivity") { (timeRemaining: Int) in
              let finalState = PomodoroActivityAttributes.ContentState(
                  endTimestamp: Date().timeIntervalSince1970,                                               
                  isPaused: true,             
                  timeRemaining: timeRemaining                                                              
              )   
              let content = ActivityContent(state: finalState, staleDate: nil)                              
              await self.activity?.end(content, dismissalPolicy: .immediate)
              self.activity = nil                                                                           
          }                               
      }
  }  
