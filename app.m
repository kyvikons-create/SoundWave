/* SoundWave — нативная оболочка (обычный Objective-C, сборка на macOS/Xcode) */
#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>
#import <AVFAudio/AVFAudio.h>

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

/* ---------- сетевой мост: JS -> нативный NSURLSession -> JS ---------- */
@interface SWBridge : NSObject <WKScriptMessageHandler>
@property (weak, nonatomic) WKWebView *webView;
@end

@implementation SWBridge
- (void)userContentController:(WKUserContentController *)uc
       didReceiveScriptMessage:(WKScriptMessage *)m {
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

/* ---------- делегат приложения ---------- */
@interface SWAppDelegate : NSObject <UIApplicationDelegate>
@end

@implementation SWAppDelegate
- (BOOL)application:(UIApplication *)application
    didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
    /* фоновое воспроизведение */
    AVAudioSession *sess = [AVAudioSession sharedInstance];
    [sess setCategory:AVAudioSessionCategoryPlayback error:nil];
    [sess setActive:YES error:nil];

    CGRect bounds = [UIScreen mainScreen].bounds;
    UIWindow *win = [[UIWindow alloc] initWithFrame:bounds];
    UIViewController *root = [[UIViewController alloc] init];

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

    UIView *rv = root.view;
    WKWebView *wv = [[WKWebView alloc] initWithFrame:rv.bounds configuration:cfg];
    bridge.webView = wv;
    [rv addSubview:wv];
    rv.backgroundColor = [UIColor colorWithWhite:0 alpha:1];

    NSString *path = [[NSBundle mainBundle] pathForResource:@"index" ofType:@"html" inDirectory:@"www"];
    if (path) {
        NSURL *nu = [NSURL fileURLWithPath:path];
        [wv loadFileURL:nu allowingReadAccessToURL:[NSBundle mainBundle].bundleURL];
    }

    win.rootViewController = root;
    [win makeKeyAndVisible];
    return YES;
}
@end

int main(int argc, char *argv[]) {
    return UIApplicationMain(argc, argv, nil, @"SWAppDelegate");
}
