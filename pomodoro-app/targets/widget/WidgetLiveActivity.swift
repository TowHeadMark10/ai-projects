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
    String(format: "%d:%02d", s / 60, s % 60)
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
            let completedBreaks = context.state.sessionType == "Focus"
                ? context.state.pomodoroCount
                : max(0, context.state.pomodoroCount - 1)
            let totalMinutes = context.state.totalSeconds / 60

            VStack(alignment: .leading, spacing: 4) {
                // Emoji + completion message inline
                HStack(spacing: 10) {
                    Text(context.state.sessionType == "Focus" ? "🍅" : "☕")
                        .font(.system(size: 40))
                    Text(context.state.sessionType == "Focus" ? "Complete!" : "Break's over!")
                        .font(.system(size: 36, weight: .bold, design: .rounded))
                        .foregroundStyle(Color.white.opacity(0.6))
                        .minimumScaleFactor(0.7)
                        .lineLimit(1)
                }

                // Tap hint
                Text("Tap to open")
                    .font(.caption2)
                    .foregroundStyle(Color.white.opacity(0.35))

                Spacer()

                // Progress bar full
                ZStack {
                    Capsule().fill(Color.white.opacity(0.2)).frame(height: 4)
                    ProgressView(value: 1.0)
                        .progressViewStyle(.linear)
                        .tint(Color.white.opacity(0.75))
                        .frame(maxWidth: .infinity)
                }
                .scaleEffect(y: 2, anchor: .center)

                Spacer()

                // Final stats
                HStack(spacing: 12) {
                    HStack(spacing: 4) {
                        Text("🍅").font(.callout)
                        Text("\(context.state.pomodoroCount)")
                            .font(.callout.bold())
                            .foregroundStyle(Color.white.opacity(0.6))
                    }
                    Text("·").foregroundStyle(Color.white.opacity(0.35))
                    HStack(spacing: 4) {
                        Text("☕").font(.callout)
                        Text("\(completedBreaks)")
                            .font(.callout.bold())
                            .foregroundStyle(Color.white.opacity(0.6))
                    }
                    Text("·").foregroundStyle(Color.white.opacity(0.35))
                    Text("\(totalMinutes)m")
                        .font(.callout.bold())
                        .foregroundStyle(Color.white.opacity(0.6))
                }
            }
            .padding(.top, 28)
            .padding(.bottom, 16)
            .padding(.horizontal, 16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .activityBackgroundTint(Color(red: 0.0, green: 0.467, blue: 0.714).opacity(0.9))
            .activitySystemActionForegroundColor(.white)
        } else {
            let completedBreaks = context.state.sessionType == "Focus"
                ? context.state.pomodoroCount
                : max(0, context.state.pomodoroCount - 1)
            let elapsedSecs = max(0, context.state.totalSeconds - context.state.timeRemaining)
            let elapsedMinutes = elapsedSecs / 60

            VStack(alignment: .leading, spacing: 4) {
                Text(context.state.sessionType == "Focus" ? "Focus" : "Break")
                    .font(.subheadline.bold())
                    .foregroundStyle(Color.white.opacity(0.6))

                if context.state.isPaused {
                    Text(formatSeconds(context.state.timeRemaining))
                        .font(.system(size: 64, weight: .bold, design: .rounded))
                        .foregroundStyle(Color.white.opacity(0.6))
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)
                    Text("Paused")
                        .font(.caption)
                        .foregroundStyle(Color.white.opacity(0.6))
                } else {
                    Text(
                        timerInterval: Date() ... Date(timeIntervalSince1970: context.state.endTimestamp),
                        countsDown: true
                    )
                    .monospacedDigit()
                    .font(.system(size: 64, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.white.opacity(0.6))
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)
                }

                Spacer()

                // Progress bar
                if context.state.isPaused {
                    let fraction = 1.0 - (Double(context.state.timeRemaining) /
                        Double(context.state.totalSeconds))
                    ZStack {
                        Capsule().fill(Color.white.opacity(0.2)).frame(height: 4)
                        ProgressView(value: fraction)
                            .progressViewStyle(.linear)
                            .tint(Color.white.opacity(0.75))
                            .frame(maxWidth: .infinity)
                    }
                    .scaleEffect(y: 2, anchor: .center)
                } else {
                    let start = Date(timeIntervalSince1970: context.state.endTimestamp -
                        Double(context.state.totalSeconds))
                    let end = Date(timeIntervalSince1970: context.state.endTimestamp)
                    ZStack {
                        Capsule().fill(Color.white.opacity(0.2)).frame(height: 4)
                        ProgressView(timerInterval: start ... end, countsDown: false)
                            .progressViewStyle(.linear)
                            .tint(Color.white.opacity(0.75))
                            .labelsHidden()
                            .frame(maxWidth: .infinity)
                    }
                    .scaleEffect(y: 2, anchor: .center)
                }

                Spacer()

                HStack(spacing: 12) {
                    HStack(spacing: 4) {
                        Text("🍅").font(.callout)
                        Text("\(context.state.pomodoroCount)")
                            .font(.callout.bold())
                            .foregroundStyle(Color.white.opacity(0.6))
                    }
                    Text("·").foregroundStyle(Color.white.opacity(0.35))
                    HStack(spacing: 4) {
                        Text("☕").font(.callout)
                        Text("\(completedBreaks)")
                            .font(.callout.bold())
                            .foregroundStyle(Color.white.opacity(0.6))
                    }
                    Text("·").foregroundStyle(Color.white.opacity(0.35))
                    Text("\(elapsedMinutes)m")
                        .font(.callout.bold())
                        .foregroundStyle(Color.white.opacity(0.6))
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .activityBackgroundTint(Color(red: 0.0, green: 0.467, blue: 0.714).opacity(0.9))
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
                    if !isDone(context.state) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(context.state.sessionType == "Focus" ? "Focus" : "Break")
                                .font(.subheadline.bold())
                                .foregroundStyle(Color(red: 0.15, green: 0.75, blue: 1.0))
                            if context.state.isPaused {
                                Text("Paused")
                                    .font(.caption)
                                    .foregroundStyle(Color(red: 0.15, green: 0.75, blue: 1.0))
                                Text(formatSeconds(context.state.timeRemaining))
                                    .font(.system(size: 40, weight: .bold, design: .rounded))
                                    .foregroundStyle(Color(red: 0.15, green: 0.75, blue: 1.0))
                                    .minimumScaleFactor(0.7)
                                    .lineLimit(1)

                            } else {
                                Text(timerInterval: Date() ... endDate(context.state), countsDown: true)
                                    .monospacedDigit()
                                    .font(.system(size: 46, weight: .bold, design: .rounded))
                                    .foregroundStyle(Color(red: 0.15, green: 0.75, blue: 1.0))
                                    .minimumScaleFactor(0.7)
                                    .lineLimit(1)
                            }
                        }
                        .padding(.leading, 14)
                        .padding(.top, 6)
                    }
                }

                DynamicIslandExpandedRegion(.center) {
                    if isDone(context.state) {
                        VStack(spacing: 4) {
                            Text(context.state.sessionType == "Focus" ? "🍅" : "☕")
                                .font(.system(size: 36))
                            Text(
                                context.state.sessionType == "Focus"
                                    ? "Time to take a break!" : "Time to get back to work!"
                            )
                            .font(.headline.bold())
                            .foregroundStyle(Color(red: 0.15, green: 0.75, blue: 1.0))
                            .multilineTextAlignment(.center)
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    if !isDone(context.state) {
                        let completedBreaks = context.state.sessionType == "Focus"
                            ? context.state.pomodoroCount
                            : max(0, context.state.pomodoroCount - 1)
                        let elapsedSecs = max(0, context.state.totalSeconds - context.state.timeRemaining)
                        VStack(spacing: 4) {
                            if context.state.isPaused {
                                let fraction = 1.0 - (Double(context.state.timeRemaining) /
                                    Double(context.state.totalSeconds))
                                ZStack {
                                    Capsule().fill(Color.white.opacity(0.2)).frame(height: 3)
                                    ProgressView(value: fraction)
                                        .progressViewStyle(.linear)
                                        .tint(Color(red: 0.15, green: 0.75, blue: 1.0))
                                }
                                .scaleEffect(y: 2, anchor: .center)
                            } else {
                                let start = Date(timeIntervalSince1970: context.state.endTimestamp -
                                    Double(context.state.totalSeconds))
                                let end = Date(timeIntervalSince1970: context.state.endTimestamp)
                                ZStack {
                                    Capsule().fill(Color.white.opacity(0.2)).frame(height: 3)
                                    ProgressView(timerInterval: start ... end, countsDown: false)
                                        .progressViewStyle(.linear)
                                        .tint(Color(red: 0.15, green: 0.75, blue: 1.0))
                                        .labelsHidden()
                                }
                                .scaleEffect(y: 2, anchor: .center)
                            }
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
                                Text("\(elapsedSecs / 60)m")
                                    .font(.callout.bold())
                                    .foregroundStyle(Color(red: 0.15, green: 0.75, blue: 1.0))
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 14)
                    }
                }
            } compactLeading: {
                if context.state.isPaused && !isDone(context.state) {
                    VStack(spacing: 1) {
                        Text(context.state.sessionType == "Focus" ? "🍅" : "☕")
                            .font(.system(size: 18))
                        Image(systemName: "pause.fill")
                            .font(.system(size: 7))
                            .foregroundStyle(Color(red: 0.15, green: 0.75, blue: 1.0))
                    }
                } else {
                    Text(context.state.sessionType == "Focus" ? "🍅" : "☕")
                        .font(.system(size: 26))
                }
            } compactTrailing: {
                let endDate = Date(timeIntervalSince1970: context.state.endTimestamp)
                TimelineView(.periodic(from: Date(), by: 1.0)) { tl in
                    Group {
                        if context.state.timeRemaining == 0
                            || (!context.state.isPaused && tl.date >= endDate)
                        {
                            Text("✅").font(.system(size: 16))
                        } else if context.state.isPaused {
                            let mins = context.state.timeRemaining / 60
                            let secs = context.state.timeRemaining % 60
                            Text(String(format: "%d:%02d", mins, secs))
                                .monospacedDigit()
                                .font(.system(size: 16, weight: .bold))
                                .foregroundStyle(Color(red: 0.15, green: 0.75, blue: 1.0))
                                .multilineTextAlignment(.center)
                                .frame(width: 58)
                        } else {
                            Text(timerInterval: Date() ... endDate, countsDown: true)
                                .monospacedDigit()
                                .font(.system(size: 16, weight: .bold))
                                .foregroundStyle(Color(red: 0.15, green: 0.75, blue: 1.0))
                                .multilineTextAlignment(.center)
                                .frame(width: 58)
                        }
                    }
                    .animation(.none, value: context.state.isPaused)
                }
            } minimal: {
                Text(context.state.sessionType == "Focus" ? "🍅" : "☕")
                    .font(.system(size: 20))
            }
            .widgetURL(URL(string: "pomodoroapp://"))
            .keylineTint(Color(red: 0.0, green: 0.6, blue: 0.9))
        }
    }
}
