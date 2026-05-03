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
        var pomodoroCount: Int
    }
}

// Helpers

private func endDate(_ state: PomodoroActivityAttributes.ContentState) -> Date {
    Date(timeIntervalSince1970: state.endTimestamp)
}

private func formatSeconds(_ s: Int) -> String {
    String(format: "%02d:%02d", s / 60, s % 60)
}

/// Returns true when session is done — either from JS state update (timeRemaining == 0)
/// or when endTimestamp has elapsed but the JS update hasn't arrived yet
private func isDone(_ state: PomodoroActivityAttributes.ContentState) -> Bool {
    state.timeRemaining == 0 ||
        (!state.isPaused && state.endTimestamp <= Date().timeIntervalSince1970)
}

// Lock Screen UI

struct LockScreenView: View {
    let context: ActivityViewContext<PomodoroActivityAttributes>

    var body: some View {
        if isDone(context.state) {
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
                                Date() ... Date(timeIntervalSince1970: context.state.endTimestamp),
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
                            - Double(context.state.totalSeconds)
                    )
                    let end = Date(timeIntervalSince1970: context.state.endTimestamp)
                    ZStack {
                        Capsule().fill(Color.white.opacity(0.3)).frame(height: 4)
                        ProgressView(timerInterval: start ... end, countsDown: false)
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
                    if isDone(context.state) {
                        Text(context.state.sessionType == "Focus" ? "🍅" : "☕")
                            .font(.system(size: 32))
                            .padding(.leading, 14)
                            .frame(maxHeight: .infinity, alignment: .center)
                    } else {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(context.state.sessionType == "Focus" ? "Focus" : "Break")
                                .font(.subheadline.bold())
                                .foregroundStyle(Color(red: 0.15, green: 0.75, blue: 1.0))
                            if context.state.isPaused {
                                Text(formatSeconds(context.state.timeRemaining))
                                    .font(.system(size: 46, weight: .bold, design: .monospaced))
                                    .foregroundStyle(Color(red: 0.15, green: 0.75, blue: 1.0))
                                    .minimumScaleFactor(0.7)
                                    .lineLimit(1)
                            } else {
                                Text(timerInterval: Date() ... endDate(context.state), countsDown: true)
                                    .monospacedDigit()
                                    .font(.system(size: 46, weight: .bold))
                                    .foregroundStyle(Color(red: 0.15, green: 0.75, blue: 1.0))
                                    .minimumScaleFactor(0.7)
                                    .lineLimit(1)
                            }
                        }
                        .padding(.leading, 14)
                        .padding(.top, 6)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    EmptyView()
                }
                DynamicIslandExpandedRegion(.center) {
                    if isDone(context.state) {
                        Text(
                            context.state.sessionType == "Focus"
                                ? "Time to take a break!" : "Time to get back to work!"
                        )
                        .font(.headline.bold())
                        .foregroundStyle(Color(red: 0.15, green: 0.75, blue: 1.0))
                        .padding(.top, 12)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    if !isDone(context.state) {
                        let completedBreaks = context.state.sessionType == "Focus"
                            ? context.state.pomodoroCount
                            : max(0, context.state.pomodoroCount - 1)
                        let elapsedSecs = context.state.isPaused
                            ? max(0, context.state.totalSeconds - context.state.timeRemaining)
                            : max(0, Int(Date().timeIntervalSince1970 - (context.state.endTimestamp -
                                    Double(context.state.totalSeconds))))
                        let elapsedMinutes = elapsedSecs / 60
                        HStack(spacing: 12) {
                            HStack(spacing: 4) {
                                Text("🍅").font(.callout)
                                Text("\(context.state.pomodoroCount)")
                                    .font(.callout.bold())
                                    .foregroundStyle(Color(red: 0.15, green: 0.75, blue: 1.0))
                            }
                            Text("·").foregroundStyle(.white.opacity(0.4))
                            HStack(spacing: 4) {
                                Text("☕").font(.callout)
                                Text("\(completedBreaks)")
                                    .font(.callout.bold())
                                    .foregroundStyle(Color(red: 0.15, green: 0.75, blue: 1.0))
                            }

                            Text("·").foregroundStyle(.white.opacity(0.4))
                            Text("\(elapsedMinutes)m")
                                .font(.callout.bold())
                                .foregroundStyle(Color(red: 0.15, green: 0.75, blue: 1.0))
                        }
                    }
                }
            } compactLeading: {
                Text(context.state.sessionType == "Focus" ? "🍅" : "☕")
                    .font(.system(size: 26))
            } compactTrailing: {
                Group {
                    if isDone(context.state) {
                        Text("✅").font(.system(size: 16))
                    } else if context.state.isPaused {
                        let mins = context.state.timeRemaining / 60
                        let secs = context.state.timeRemaining % 60
                        // Larger font — DI expands horizontally to fit
                        Text(String(format: "%d:%02d", mins, secs))
                            .monospacedDigit()
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(Color(red: 0.15, green: 0.75, blue: 1.0))
                            .multilineTextAlignment(.center)
                            .frame(width: 58)
                    } else {
                        Text(timerInterval: Date() ... endDate(context.state), countsDown: true)
                            .monospacedDigit()
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(Color(red: 0.15, green: 0.75, blue: 1.0))
                            .multilineTextAlignment(.center)
                            .frame(width: 58)
                    }
                }
                .animation(.none, value: context.state.isPaused)
            } minimal: {
                Text(context.state.sessionType == "Focus" ? "🍅" : "☕")
                    .font(.system(size: 20))
            }
            .widgetURL(URL(string: "pomodoroapp://"))
            .keylineTint(Color(red: 0.0, green: 0.6, blue: 0.9))
        }
    }
}
