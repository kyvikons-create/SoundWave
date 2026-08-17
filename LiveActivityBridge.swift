import Foundation
import ActivityKit

import Foundation

struct SWNowPlayingAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var pos: Double
        var dur: Double
        var playing: Bool
    }
    var title: String
    var artist: String
}

@objcMembers
final class SWLiveActivity: NSObject {
    private static var activity: Activity<SWNowPlayingAttributes>?

    @objc static func update(_ d: NSDictionary) {
        if #available(iOS 16.1, *) {
            guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
            let title = (d["title"] as? String) ?? ""
            let artist = (d["artist"] as? String) ?? ""
            let dur = (d["dur"] as? Double) ?? 0
            let pos = (d["pos"] as? Double) ?? 0
            let playing = (d["playing"] as? Bool) ?? false
            let state = SWNowPlayingAttributes.ContentState(pos: pos, dur: dur, playing: playing)
            if let a = activity {
                Task { await a.update(ActivityContent(state: state, staleDate: nil)) }
            } else {
                let attrs = SWNowPlayingAttributes(title: title, artist: artist)
                do {
                    activity = try Activity.request(attributes: attrs, content: ActivityContent(state: state, staleDate: nil))
                } catch {}
            }
        }
    }
}
