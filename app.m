/* SoundWave + визуальный лог запуска (UILabel поверх всего) */
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

/* ---------- визуальный лог ---------- */
static UILabel *g_lab = nil;
static void SWLog(NSString *s) {
    if (!g_lab) return;
    dispatch_async(dispatch_get_main_queue(), ^{
        g_lab.text = [g_lab.text stringByAppendingFormat:@"\n%@", s];
    });
}

/* ---------- сетевой мост ---------- */
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
@interface SWAppDelegate : NSObject <UIApplicationDelegate, WKNavigationDelegate>
@end

@implementation SWAppDelegate

- (BOOL)application:(UIApplication *)application
    didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {

    CGRect bounds = [UIScreen mainScreen].bounds;
    UIWindow *win = [[UIWindow alloc] initWithFrame:bounds];
    UIViewController *root = [[UIViewController alloc] init];
    root.view.frame = bounds;

    /* лог-метка поверх всего экрана */
    g_lab = [[UILabel alloc] initWithFrame:CGRectMake(16, 60, bounds.size.width - 32, bounds.size.height - 120)];
    g_lab.numberOfLines = 0;
    g_lab.font = [UIFont fontWithName:@"Menlo" size:12];
    g_lab.textColor = [UIColor greenColor];
    g_lab.backgroundColor = [UIColor colorWithWhite:0 alpha:0.75];
    g_lab.text = @"SoundWave diag v2.1 start";

    WKUserContentController *ucc = [[WKUserContentController alloc] init];
    SWBridge *bridge = [[SWBridge alloc] init];
    [ucc addScriptMessageHandler:bridge name:@"sw"];
    WKUserScript *us = [[WKUserScript alloc]
        initWithSource:SW_BRIDGE_JS
        injectionTime:WKUserScriptInjectionTimeAtDocumentStart
        forMainFrameOnly:YES];
    [ucc addUserScript:us];
    SWLog(@"bridge ok");

    WKWebViewConfiguration *cfg = [[WKWebViewConfiguration alloc] init];
    cfg.userContentController = ucc;

    WKWebView *wv = [[WKWebView alloc] initWithFrame:bounds configuration:cfg];
    wv.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    bridge.webView = wv;
    wv.navigationDelegate = self;
    wv.backgroundColor = [UIColor colorWithWhite:0 alpha:1];
    [root.view addSubview:wv];
    [root.view addSubview:g_lab]; /* лог поверх вебвью */
    SWLog(@"webview ok");

    dispatch_async(dispatch_get_global_queue(0, 0), ^{
        AVAudioSession *sess = [AVAudioSession sharedInstance];
        [sess setCategory:AVAudioSessionCategoryPlayback error:nil];
        [sess setActive:YES error:nil];
    });

    NSString *path = [[NSBundle mainBundle] pathForResource:@"index" ofType:@"html" inDirectory:@"www"];
    if (path) {
        SWLog([@"path ok: " stringByAppendingString:path.lastPathComponent]);
        NSURL *nu = [NSURL fileURLWithPath:path];
        [wv loadFileURL:nu allowingReadAccessToURL:[NSBundle mainBundle].bundleURL];
        SWLog(@"load called");
    } else {
        NSArray *files = [[NSFileManager defaultManager]
            contentsOfDirectoryAtPath:[NSBundle mainBundle].bundlePath error:nil];
        SWLog([@"NO index.html; bundle: " stringByAppendingString:[files componentsJoinedByString:@", "]]);
    }

    win.rootViewController = root;
    [win makeKeyAndVisible];
    SWLog(@"window visible");
    return YES;
}

- (void)webView:(WKWebView *)wv didStartProvisionalNavigation:(WKNavigation *)nav {
    SWLog(@"nav start");
}
- (void)webView:(WKWebView *)wv didFinishNavigation:(WKNavigation *)nav {
    SWLog(@"nav finished — страница жива, лог можно скрыть");
}
- (void)webView:(WKWebView *)wv didFailProvisionalNavigation:(WKNavigation *)nav
      withError:(NSError *)error {
    SWLog([@"FAIL prov: " stringByAppendingString:error.localizedDescription]);
}
- (void)webView:(WKWebView *)wv didFailNavigation:(WKNavigation *)nav
      withError:(NSError *)error {
    SWLog([@"FAIL nav: " stringByAppendingString:error.localizedDescription]);
}
- (void)webViewWebContentProcessDidTerminate:(WKWebView *)wv {
    SWLog(@"WebContent process died");
}
@end

int main(int argc, char *argv[]) {
    return UIApplicationMain(argc, argv, nil, @"SWAppDelegate");
}
