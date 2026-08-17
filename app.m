#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>
#import <AVFAudio/AVFAudio.h>
#import <MediaPlayer/MediaPlayer.h>
#import <Photos/Photos.h>

static NSString *const SW_UA =
  @"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15"
   " (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

static NSString *const SW_BRIDGE_JS =
  @"(function(){"
  @"window.__swSeq=0;window.__swP={};"
  @"window.__swNativeFetch=function(u){var i=''+(++window.__swSeq);"
  @"return new Promise(function(res,rej){window.__swP[i]={r:res,j:rej};"
  @"window.webkit.messageHandlers.sw.postMessage({u:u,i:i});});};"
  @"window.__swRecv=function(o){var p=window.__swP[o.i];if(!p)return;"
  @"delete window.__swP[o.i];"
  @"if(o.err)p.j(new Error(o.err));else p.r({status:o.status,text:o.text});};"
  @"})();";

@interface SWBridge : NSObject <WKScriptMessageHandler>
@property (weak, nonatomic) WKWebView *webView;
@end

@implementation SWBridge

+ (void)updateNowPlaying:(NSDictionary *)d {
    NSMutableDictionary *info = [NSMutableDictionary dictionary];
    if (d[@"title"]) info[MPMediaItemPropertyTitle] = d[@"title"];
    if (d[@"artist"]) info[MPMediaItemPropertyArtist] = d[@"artist"];
    double dur = [d[@"dur"] doubleValue];
    if (dur > 0) info[MPMediaItemPropertyPlaybackDuration] = @(dur);
    info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = @([d[@"pos"] doubleValue]);
    double rate = [d[@"playing"] boolValue] ? ([d[@"rate"] doubleValue] > 0 ? [d[@"rate"] doubleValue] : 1.0) : 0.0;
    info[MPNowPlayingInfoPropertyPlaybackRate] = @(rate);
    [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = info;

    Class laCls = NSClassFromString(@"SWLiveActivity");
    if (laCls) [laCls performSelector:@selector(update:) withObject:d];

    NSString *art = d[@"art"];
    if (art.length > 4) {
        NSURL *au = [NSURL URLWithString:art];
        if (!au) return;
        [[[NSURLSession sharedSession] dataTaskWithURL:au
            completionHandler:^(NSData *data, NSURLResponse *r, NSError *e) {
            if (!data) return;
            UIImage *img = [UIImage imageWithData:data];
            if (!img) return;
            dispatch_async(dispatch_get_main_queue(), ^{
                MPMediaItemArtwork *a = [[MPMediaItemArtwork alloc] initWithImage:img];
                NSMutableDictionary *info2 = [[MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo mutableCopy];
                if (!info2) info2 = [NSMutableDictionary dictionary];
                info2[MPMediaItemPropertyArtwork] = a;
                [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = info2;
            });
        }] resume];
    }
}

+ (void)doCommand:(NSDictionary *)d withWebView:(WKWebView *)wv {
    NSString *cmd = d[@"cmd"];
    if ([cmd isEqualToString:@"haptic"]) {
        int kind = [d[@"kind"] intValue];
        UIImpactFeedbackStyle style = kind == 1 ? UIImpactFeedbackStyleMedium : UIImpactFeedbackStyleLight;
        UIImpactFeedbackGenerator *gen = [[UIImpactFeedbackGenerator alloc] initWithStyle:style];
        [gen impactOccurred];
    } else if ([cmd isEqualToString:@"keepawake"]) {
        [UIApplication sharedApplication].idleTimerDisabled = [d[@"on"] boolValue];
    } else if ([cmd isEqualToString:@"seticon"]) {
        NSString *name = [d[@"name"] stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceCharacterSet]];
        if (name.length == 0) name = nil;
        [[UIApplication sharedApplication] setAlternateIconName:name completionHandler:^(NSError *e){
            dispatch_async(dispatch_get_main_queue(), ^{
                [wv evaluateJavaScript:[NSString stringWithFormat:@"window.toast&&toast(%@)",
                  e ? @"'Иконка недоступна'" : @"'Иконка обновлена'"] completionHandler:nil];
            });
        }];
    } else if ([cmd isEqualToString:@"saveimage"]) {
        NSString *b64 = d[@"b64"];
        if (!b64.length) return;
        NSData *data = [[NSData alloc] initWithBase64EncodedString:b64 options:0];
        UIImage *img = [UIImage imageWithData:data];
        if (!img) {
            [wv evaluateJavaScript:@"window.__swSavedPhoto&&window.__swSavedPhoto(false)" completionHandler:nil];
            return;
        }
        [[PHPhotoLibrary sharedPhotoLibrary] performChanges:^{
            PHAssetChangeRequest *req = [PHAssetChangeRequest creationRequestForAssetFromImage:img];
            (void)req;
        } completionHandler:^(BOOL ok, NSError *e){
            dispatch_async(dispatch_get_main_queue(), ^{
                [wv evaluateJavaScript:[NSString stringWithFormat:@"window.__swSavedPhoto&&window.__swSavedPhoto(%@)", ok ? @"true" : @"false"] completionHandler:nil];
            });
        }];
    }
}

- (void)userContentController:(WKUserContentController *)uc
       didReceiveScriptMessage:(WKScriptMessage *)m {
    if ([m.body isKindOfClass:[NSDictionary class]] && m.body[@"cmd"]) {
        if ([m.body[@"cmd"] isEqualToString:@"nowplaying"]) {
            [SWBridge updateNowPlaying:m.body];
        } else {
            [SWBridge doCommand:m.body withWebView:self.webView];
        }
        return;
    }
    NSString *u   = m.body[@"u"];
    NSString *mid = m.body[@"i"];
    NSURL *url = u ? [NSURL URLWithString:u] : nil;
    if (!url || !mid.length) return;

    NSMutableURLRequest *req = [NSMutableURLRequest requestWithURL:url];
    [req setValue:SW_UA forHTTPHeaderField:@"User-Agent"];

    WKWebView *wv = self.webView;
    NSURLSessionDataTask *task =
      [[NSURLSession sharedSession] dataTaskWithRequest:req
      completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
        NSMutableDictionary *out = [NSMutableDictionary dictionary];
        out[@"i"] = mid;
        if (error || !response) {
            out[@"err"] = @"network";
        } else {
            out[@"status"] = @([((NSHTTPURLResponse *)response) statusCode]);
            if (data) {
                NSString *text = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
                if (text) out[@"text"] = text;
            }
        }
        NSData *jd = [NSJSONSerialization dataWithJSONObject:out options:0 error:nil];
        if (!jd) return;
        NSString *json = [[NSString alloc] initWithData:jd encoding:NSUTF8StringEncoding];
        NSString *js = [@"window.__swRecv(" stringByAppendingString:json];
        js = [js stringByAppendingString:@");"];
        if (!wv) return;
        dispatch_async(dispatch_get_main_queue(), ^{
            [wv evaluateJavaScript:js completionHandler:nil];
        });
    }];
    [task resume];
}
@end

@interface SWRootVC : UIViewController
@property (strong, nonatomic) WKWebView *wv;
@end

@implementation SWRootVC
- (void)viewDidLayoutSubviews {
    [super viewDidLayoutSubviews];
    if (self.wv && self.wv.constraints.count == 0) {
        self.wv.frame = self.view.bounds;
    }
}
@end

@interface SWSceneDelegate : NSObject <UIWindowSceneDelegate>
@property (strong, nonatomic) UIWindow *window;
@end

@implementation SWSceneDelegate

- (void)setupRemoteCommands:(WKWebView *)wv {
    static BOOL done = NO;
    if (done) return;
    done = YES;
    MPRemoteCommandCenter *rc = [MPRemoteCommandCenter sharedCommandCenter];
    [rc.playCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent *e) {
        [wv evaluateJavaScript:@"window.__swRemote&&window.__swRemote('play')" completionHandler:nil];
        return MPRemoteCommandHandlerStatusSuccess;
    }];
    [rc.pauseCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent *e) {
        [wv evaluateJavaScript:@"window.__swRemote&&window.__swRemote('pause')" completionHandler:nil];
        return MPRemoteCommandHandlerStatusSuccess;
    }];
    [rc.nextTrackCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent *e) {
        [wv evaluateJavaScript:@"window.__swRemote&&window.__swRemote('next')" completionHandler:nil];
        return MPRemoteCommandHandlerStatusSuccess;
    }];
    [rc.previousTrackCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent *e) {
        [wv evaluateJavaScript:@"window.__swRemote&&window.__swRemote('prev')" completionHandler:nil];
        return MPRemoteCommandHandlerStatusSuccess;
    }];
    [rc.changePlaybackPositionCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent *e) {
        MPChangePlaybackPositionCommandEvent *pe = (MPChangePlaybackPositionCommandEvent *)e;
        NSString *js = [NSString stringWithFormat:@"window.__swRemote&&window.__swRemote('seek',%f)", pe.positionTime];
        [wv evaluateJavaScript:js completionHandler:nil];
        return MPRemoteCommandHandlerStatusSuccess;
    }];
}

- (void)scene:(UIScene *)scene willConnectToSession:(UISceneSession *)session
      options:(UISceneConnectionOptions *)options {
    UIWindowScene *ws = (UIWindowScene *)scene;

    UIWindow *win = [[UIWindow alloc] initWithWindowScene:ws];
    win.backgroundColor = [UIColor colorWithWhite:0 alpha:1];
    self.window = win;

    SWRootVC *root = [[SWRootVC alloc] init];
    win.rootViewController = root;

    WKUserContentController *ucc = [[WKUserContentController alloc] init];
    SWBridge *bridge = [[SWBridge alloc] init];
    [ucc addScriptMessageHandler:bridge name:@"sw"];
    WKUserScript *us = [[WKUserScript alloc]
        initWithSource:SW_BRIDGE_JS
        injectionTime:WKUserScriptInjectionTimeAtDocumentStart
        forMainFrameOnly:YES];
    [ucc addUserScript:us];

    WKWebViewConfiguration *cfg = [[WKWebViewConfiguration alloc] init];
    cfg.userContentController = ucc;

    WKWebView *wv = [[WKWebView alloc] initWithFrame:ws.coordinateSpace.bounds configuration:cfg];
    wv.backgroundColor = [UIColor colorWithWhite:0 alpha:1];
    bridge.webView = wv;
    root.wv = wv;
    [root.view addSubview:wv];
    wv.scrollView.contentInsetAdjustmentBehavior = UIScrollViewContentInsetAdjustmentNever;
    wv.translatesAutoresizingMaskIntoConstraints = NO;
    [NSLayoutConstraint activateConstraints:@[
        [wv.topAnchor      constraintEqualToAnchor:root.view.topAnchor],
        [wv.bottomAnchor   constraintEqualToAnchor:root.view.bottomAnchor],
        [wv.leadingAnchor  constraintEqualToAnchor:root.view.leadingAnchor],
        [wv.trailingAnchor constraintEqualToAnchor:root.view.trailingAnchor]
    ]];

    [self setupRemoteCommands:wv];

    dispatch_async(dispatch_get_global_queue(0, 0), ^{
        AVAudioSession *sess = [AVAudioSession sharedInstance];
        [sess setCategory:AVAudioSessionCategoryPlayback error:nil];
        [sess setActive:YES error:nil];
    });

    NSString *path = [[NSBundle mainBundle] pathForResource:@"index" ofType:@"html" inDirectory:@"www"];
    if (path) {
        NSURL *nu = [NSURL fileURLWithPath:path];
        [wv loadFileURL:nu allowingReadAccessToURL:[NSBundle mainBundle].bundleURL];
    } else {
        NSString *html = @"<body style='background:#08080d;color:#fff;font-family:-apple-system;padding:40px'><h2>index.html not found</h2></body>";
        [wv loadHTMLString:html baseURL:nil];
    }

    [win makeKeyAndVisible];
}
@end

@interface SWAppDelegate : NSObject <UIApplicationDelegate>
@end

@implementation SWAppDelegate
- (UISceneConfiguration *)application:(UIApplication *)application
    configurationForConnectingSceneSession:(UISceneSession *)connectingSceneSession
    options:(UISceneConnectionOptions *)options {
    UISceneConfiguration *cfg = [[UISceneConfiguration alloc]
        initWithName:@"Default" sessionRole:connectingSceneSession.role];
    cfg.delegateClass = [SWSceneDelegate class];
    return cfg;
}
@end

int main(int argc, char *argv[]) {
    return UIApplicationMain(argc, argv, nil, @"SWAppDelegate");
}
