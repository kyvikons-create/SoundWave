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
