import ActivityKit                                                                                                 
  import WidgetKit                                                                                                   
  import SwiftUI                                                                                                     
                                                                                                                   
  // Data model                                                                                              
  // PomodoroActivityAttributes defines the data the widget receives from the app.
  // - ContentState: mutable properties that change during the session                                               
  // - Fixed properties: sessionType and totalSeconds never change mid-session
                                                                                                                     
  struct PomodoroActivityAttributes: ActivityAttributes {
      struct ContentState: Codable, Hashable {                                                                       
          var endTimestamp: Double  // Unix timestamp in seconds — SwiftUI uses this for auto-countdown
          var isPaused: Bool                                                                                         
          var timeRemaining: Int    // seconds remaining, displayed as static text when paused
      }                                                                                                              
      var sessionType: String  // "Focus" or "Break"                                                                 
      var totalSeconds: Int    // total session duration (used for progress ring calculation)
  }                                                                                                                  
                  
  // Helpers                                                                                                 
   
  private func endDate(_ state: PomodoroActivityAttributes.ContentState) -> Date {                                             
      Date(timeIntervalSince1970: state.endTimestamp)
  }

  private func formatSeconds(_ s: Int) -> String {
      String(format: "%02d:%02d", s / 60, s % 60)
  }                                                                                                                  
   
  private func progress(_ attrs: PomodoroActivityAttributes, _ state: PomodoroActivityAttributes.ContentState) -> Double {               
      let elapsed = Double(attrs.totalSeconds - state.timeRemaining)
      return min(max(elapsed / Double(attrs.totalSeconds), 0), 1)
  }                                                                                                                  
   
  // Lock Screen UI                                                                                          
  // Shown as a banner on the lock screen while the timer is active
                                                                                                                     
  struct LockScreenView: View {
      let context: ActivityViewContext<PomodoroActivityAttributes>                                                             
                  
      var body: some View {
          HStack(spacing: 16) {
              VStack(alignment: .leading, spacing: 6) {
                  Text(context.attributes.sessionType == "Focus" ? "🍅 Focus" : "☕ Break")
                      .font(.caption)                                                                                
                      .foregroundStyle(.secondary)
                  // Running: auto-countdown via SwiftUI. Paused: static formatted text.                             
                  if context.state.isPaused {                                                                        
                      Text(formatSeconds(context.state.timeRemaining))
                          .font(.system(size: 30, weight: .bold, design: .monospaced))                               
                      Text("Paused")                                                                                 
                          .font(.caption2)
                          .foregroundStyle(.yellow)                                                                  
                  } else {
                      Text(timerInterval: Date()...endDate(context.state), countsDown: true)
                          .font(.system(size: 30, weight: .bold, design: .monospaced))                               
                  }
              }                                                                                                      
              Spacer()
              // Session progress ring
              ZStack {
                  Circle()                                                                                           
                      .stroke(Color.white.opacity(0.2), lineWidth: 5)
                  Circle()                                                                                           
                      .trim(from: 0, to: progress(context.attributes, context.state))
                      .stroke(Color.green, style: StrokeStyle(lineWidth: 5, lineCap: .round))
                      .rotationEffect(.degrees(-90))                                                                 
              }
              .frame(width: 48, height: 48)                                                                          
          }       
          .padding()
          .activityBackgroundTint(Color(red: 0.1, green: 0.1, blue: 0.18))
          .activitySystemActionForegroundColor(.white)                                                               
      }
  }                                                                                                                  
                  
  // Main widget                                                                                             
   
  struct WidgetLiveActivity: Widget {                                                                                
      var body: some WidgetConfiguration {
          ActivityConfiguration(for: PomodoroActivityAttributes.self) { context in
              // Lock screen view
              LockScreenView(context: context)
          } dynamicIsland: { context in
              DynamicIsland {                                                                                        
                  // Expanded Dynamic Island (shown when user long-presses)
                  DynamicIslandExpandedRegion(.leading) {                                                            
                      Text(context.attributes.sessionType == "Focus" ? "🍅" : "☕")
                          .font(.title2)                                                                             
                          .padding(.leading, 4)
                  }                                                                                                  
                  DynamicIslandExpandedRegion(.trailing) {
                      if context.state.isPaused {
                          Text(formatSeconds(context.state.timeRemaining))                                           
                              .font(.system(.body, design: .monospaced).bold())
                              .foregroundStyle(.green)                                                               
                      } else {
                          Text(timerInterval: Date()...endDate(context.state), countsDown: true)
                              .monospacedDigit()                                                                     
                              .font(.body.bold())
                              .foregroundStyle(.green)                                                               
                      }
                  }
                  DynamicIslandExpandedRegion(.bottom) {
                      Text(context.state.isPaused ? "Paused" : context.attributes.sessionType)                       
                          .font(.caption)
                          .foregroundStyle(.secondary)                                                               
                  }
              } compactLeading: {
                  // Compact Dynamic Island — left side
                  Text(context.attributes.sessionType == "Focus" ? "🍅" : "☕")                                      
              } compactTrailing: {
                  // Compact Dynamic Island — right side (timer countdown)                                           
                  if context.state.isPaused {                                                                        
                      Text(formatSeconds(context.state.timeRemaining))
                          .font(.system(.caption2, design: .monospaced).bold())                                      
                          .foregroundStyle(.green)
                  } else {
                      Text(timerInterval: Date()...endDate(context.state), countsDown: true)                         
                          .monospacedDigit()
                          .font(.caption2.bold())                                                                    
                          .foregroundStyle(.green)
                  }
              } minimal: {
                  // Shown when two Live Activities are active simultaneously                                        
                  Text(context.attributes.sessionType == "Focus" ? "🍅" : "☕")
              }                                                                                                      
              .widgetURL(URL(string: "pomodoroapp://"))
              .keylineTint(.green)
          }                                                                                                          
      }
  }                     
