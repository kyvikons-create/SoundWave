import WidgetKit
import SwiftUI

struct SWNowPlayingAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var pos: Double
        var dur: Double
        var playing: Bool
    }
    var title: String
    var artist: String
}

@main
struct SWWidgetBundle: WidgetBundle {
    var body: some Widget {
        SWLiveWidget()
    }
}

func swFmt(_ s: Double) -> String {
    let m = Int(s) / 60, sec = Int(s) % 60
    return "\(m):\(String(format: "%02d", sec))"
}

struct SWLiveWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: SWNowPlayingAttributes.self) { context in
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(Color.orange.opacity(0.18)).frame(width: 46, height: 46)
                    Image(systemName: context.state.playing ? "waveform" : "pause.fill")
                        .foregroundColor(.orange)
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text(context.attributes.title)
                        .font(.system(size: 15, weight: .bold))
                        .lineLimit(1)
                    Text(context.attributes.artist)
                        .font(.system(size: 13))
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                    ProgressView(value: min(context.state.pos, max(1, context.state.dur)), total: max(1, context.state.dur))
                        .tint(.orange)
                }
            }
            .padding(16)
            .activityBackgroundTint(Color.black.opacity(0.75))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    ZStack {
                        Circle().fill(Color.orange.opacity(0.18)).frame(width: 38, height: 38)
                        Image(systemName: context.state.playing ? "waveform" : "pause.fill")
                            .foregroundColor(.orange)
                    }
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(context.attributes.title)
                            .font(.system(size: 14, weight: .bold))
                            .lineLimit(1)
                        Text(context.attributes.artist)
                            .font(.system(size: 12))
                            .foregroundColor(.secondary)
                            .lineLimit(1)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(swFmt(context.state.pos))
                        .font(.system(size: 12, weight: .semibold).monospacedDigit())
                        .foregroundColor(.secondary)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    ProgressView(value: min(context.state.pos, max(1, context.state.dur)), total: max(1, context.state.dur))
                        .tint(.orange)
                }
            } compactLeading: {
                Image(systemName: "waveform").foregroundColor(.orange)
            } compactTrailing: {
                Text(swFmt(context.state.pos))
                    .font(.system(size: 11, weight: .semibold).monospacedDigit())
                    .foregroundColor(.orange)
            } minimal: {
                Image(systemName: "waveform").foregroundColor(.orange)
            }
        }
    }
}
