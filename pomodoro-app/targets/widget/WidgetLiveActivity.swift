import ActivityKit
import SwiftUI
import WidgetKit

// Data model
// PomodoroActivityAttributes defines the data the widget receives from the app.
// - ContentState: mutable properties that change during the session
// - Fixed properties: sessionType and totalSeconds never change mid-session

struct PomodoroActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var endTimestamp: Double  // Unix timestamp in seconds — SwiftUI uses this for auto-countdown
        var isPaused: Bool
        var timeRemaining: Int  // seconds remaining, displayed as static text when paused
    }
    var sessionType: String  // "Focus" or "Break"
    var totalSeconds: Int  // total session duration (used for progress ring calculation)
}

// Helpers

private func endDate(_ state: PomodoroActivityAttributes.ContentState) -> Date {
    Date(timeIntervalSince1970: state.endTimestamp)
}

private func formatSeconds(_ s: Int) -> String {
    String(format: "%02d:%02d", s / 60, s % 60)
}

private func progress(
    _ attrs: PomodoroActivityAttributes, _ state: PomodoroActivityAttributes.ContentState
) -> Double {
    let elapsed = Double(attrs.totalSeconds - state.timeRemaining)
    return min(max(elapsed / Double(attrs.totalSeconds), 0), 1)
}

// Lock Screen UI
struct LockScreenView: View {
    let context: ActivityViewContext<PomodoroActivityAttributes>

    private var fishProgress: Double {
        if context.state.isPaused {
            return Double(context.state.timeRemaining) / Double(context.attributes.totalSeconds)
        }
        let timeLeft = context.state.endTimestamp - Date().timeIntervalSince1970
        return min(max(timeLeft / Double(context.attributes.totalSeconds), 0), 1)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(context.attributes.sessionType == "Focus" ? "🍅 Focus" : "☕ Break")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                if context.state.isPaused {
                    Text("\(formatSeconds(context.state.timeRemaining)) ⏸")
                        .font(.system(.body, design: .monospaced).bold())
                        .foregroundStyle(.yellow)
                } else {
                    Text(timerInterval: Date()...endDate(context.state), countsDown: true)
                        .monospacedDigit()
                        .font(.system(.body, design: .monospaced).bold())
                }
            }

            GeometryReader { geo in
                let totalWidth = geo.size.width
                let fishSize: CGFloat = 22
                let trackWidth = totalWidth - fishSize
                let fishX = fishProgress * trackWidth

                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color.white.opacity(0.12))
                        .frame(height: 16)
                    if fishProgress > 0 {
                        Rectangle()
                            .fill(Color.cyan.opacity(0.35))
                            .frame(width: fishX + fishSize, height: 16)
                            .clipShape(Capsule())
                    }
                    Text("🐟")
                        .font(.system(size: 18))
                        .frame(width: fishSize)
                        .offset(x: fishX)
                }
            }
            .frame(height: 22)
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
