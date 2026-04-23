import ActivityKit
import SwiftUI
import WidgetKit

struct PomodoroActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var endTimestamp: Double
        var isPaused: Bool
        var timeRemaining: Int
        var sessionType: String
        var totalSeconds: Int
    }

}

// Helpers

private func endDate(_ state: PomodoroActivityAttributes.ContentState) -> Date {
    Date(timeIntervalSince1970: state.endTimestamp)
}

private func formatSeconds(_ s: Int) -> String {
    String(format: "%02d:%02d", s / 60, s % 60)
}

// Lock Screen UI

struct LockScreenView: View {
    let context: ActivityViewContext<PomodoroActivityAttributes>

    var body: some View {
        if context.state.timeRemaining == 0 {
            // Done — show completion message
            VStack(spacing: 6) {
                Text(context.state.sessionType == "Focus" ? "🍅" : "☕")
                    .font(.system(size: 40))
                Text(context.state.sessionType == "Focus" ? "Pomodoro complete!" : "Break's over!")
                    .font(.headline.bold())
                    .foregroundStyle(.white)
                Text(
                    context.state.sessionType == "Focus"
                        ? "Time to take a break." : "Time to get back to work."
                )
                .font(.caption)
                .foregroundStyle(.white.opacity(0.8))
                Text("Tap to open")
                    .font(.caption2)
                    .foregroundStyle(.white.opacity(0.5))
                    .padding(.top, 2)
            }
            .frame(maxWidth: .infinity)
            .padding()
            .activityBackgroundTint(Color(red: 0.0, green: 0.6, blue: 0.9).opacity(0.7))
            .activitySystemActionForegroundColor(.white)
        } else {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 16) {
                    Text(context.state.sessionType == "Focus" ? "🍅" : "☕")
                        .font(.system(size: 36))
                        .padding(14)
                        .background(Circle().fill(Color.white.opacity(0.12)))

                    VStack(alignment: .leading, spacing: 2) {
                        Text(context.state.sessionType == "Focus" ? "Focus" : "Break")
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        if context.state.isPaused {
                            Text(
                                "\(formatSeconds(context.state.timeRemaining)) \(context.state.timeRemaining == 0 ? "✅" : "⏸")"
                            )
                            .font(.system(.title, design: .monospaced).bold())
                            .foregroundStyle(Color(red: 1.0, green: 0.6, blue: 0.0))
                        } else {
                            Text(
                                timerInterval:
                                    Date()...Date(timeIntervalSince1970: context.state.endTimestamp),
                                countsDown: true
                            )
                            .monospacedDigit()
                            .font(.system(.title, design: .monospaced).bold())
                            .foregroundStyle(Color(red: 1.0, green: 0.6, blue: 0.0))
                        }
                    }
                    Spacer()
                }

                if context.state.isPaused {
                    let fraction =
                        1.0
                        - (Double(context.state.timeRemaining) / Double(context.state.totalSeconds))
                    ZStack {
                        Capsule().fill(Color.white.opacity(0.3)).frame(height: 4)
                        ProgressView(value: fraction)
                            .progressViewStyle(.linear)
                            .tint(Color(red: 1.0, green: 0.6, blue: 0.0))
                            .frame(maxWidth: .infinity)
                    }
                    .scaleEffect(y: 2, anchor: .center)
                } else {
                    let start = Date(
                        timeIntervalSince1970: context.state.endTimestamp
                            - Double(context.state.totalSeconds))
                    let end = Date(timeIntervalSince1970: context.state.endTimestamp)
                    ZStack {
                        Capsule().fill(Color.white.opacity(0.3)).frame(height: 4)
                        ProgressView(timerInterval: start...end, countsDown: false)
                            .progressViewStyle(.linear)
                            .tint(Color(red: 1.0, green: 0.6, blue: 0.0))
                            .labelsHidden()
                            .frame(maxWidth: .infinity)
                    }
                    .scaleEffect(y: 2, anchor: .center)
                }
            }
            .padding()
            .activityBackgroundTint(Color(red: 0.0, green: 0.6, blue: 0.9).opacity(0.7))
            .activitySystemActionForegroundColor(.white)
        }
    }
}

// Main widget

struct WidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PomodoroActivityAttributes.self) { context in
            LockScreenView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    if context.state.timeRemaining > 0 {
                        Text(context.state.sessionType == "Focus" ? "🍅" : "☕")
                            .font(.title2)
                            .padding(.leading, 4)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if context.state.timeRemaining > 0 {
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
                }
                DynamicIslandExpandedRegion(.center) {
                    if context.state.timeRemaining == 0 {
                        VStack(spacing: 2) {
                            Text(context.state.sessionType == "Focus" ? "🍅" : "☕")
                                .font(.system(size: 28))
                            Text(
                                context.state.sessionType == "Focus"
                                    ? "Time to take a break!" : "Time to get back to work!"
                            )
                            .font(.subheadline.bold())
                            .foregroundStyle(Color(red: 1.0, green: 0.6, blue: 0.0))
                            .multilineTextAlignment(.center)
                        }
                    }
                }
            } compactLeading: {
                Text(context.state.sessionType == "Focus" ? "🍅" : "☕")
                    .font(.caption2)
            } compactTrailing: {
                if context.state.timeRemaining == 0 {
                    Text("✅").font(.caption2)
                } else if context.state.isPaused {
                    Text(formatSeconds(context.state.timeRemaining))
                        .font(.system(.caption2, design: .monospaced).bold())
                        .foregroundStyle(.green)
                } else {
                    Text(timerInterval: Date()...endDate(context.state), countsDown: true)
                        .monospacedDigit()
                        .font(.caption2.bold())
                        .foregroundStyle(.green)
                        .frame(width: 36)
                }
            } minimal: {
                Text(context.state.sessionType == "Focus" ? "🍅" : "☕")
            }
            .widgetURL(URL(string: "pomodoroapp://"))
            .keylineTint(Color(red: 0.0, green: 0.6, blue: 0.9))
        }
    }
}
