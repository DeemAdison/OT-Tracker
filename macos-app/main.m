#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>

@interface AssetSchemeHandler : NSObject <WKURLSchemeHandler>
@property (nonatomic, copy) NSString *distPath;
@end

@implementation AssetSchemeHandler

- (instancetype)initWithDistPath:(NSString *)path {
    self = [super init];
    if (self) {
        _distPath = [path copy];
    }
    return self;
}

- (void)webView:(WKWebView *)webView startURLSchemeTask:(id<WKURLSchemeTask>)urlSchemeTask {
    NSURL *url = urlSchemeTask.request.URL;
    NSString *path = url.path;
    if (path.length == 0 || [path isEqualToString:@"/"]) {
        path = @"/index.html";
    }

    NSString *filePath = [self.distPath stringByAppendingPathComponent:path];
    BOOL isDir = NO;
    if (![[NSFileManager defaultManager] fileExistsAtPath:filePath isDirectory:&isDir] || isDir) {
        // Fallback for SPA routing
        filePath = [self.distPath stringByAppendingPathComponent:@"index.html"];
    }

    NSData *data = [NSData dataWithContentsOfFile:filePath];
    if (data) {
        NSString *ext = [filePath pathExtension].lowercaseString;
        NSString *mimeType = @"application/octet-stream";
        if ([ext isEqualToString:@"html"]) mimeType = @"text/html; charset=utf-8";
        else if ([ext isEqualToString:@"js"] || [ext isEqualToString:@"mjs"]) mimeType = @"application/javascript; charset=utf-8";
        else if ([ext isEqualToString:@"css"]) mimeType = @"text/css; charset=utf-8";
        else if ([ext isEqualToString:@"json"]) mimeType = @"application/json";
        else if ([ext isEqualToString:@"png"]) mimeType = @"image/png";
        else if ([ext isEqualToString:@"jpg"] || [ext isEqualToString:@"jpeg"]) mimeType = @"image/jpeg";
        else if ([ext isEqualToString:@"svg"]) mimeType = @"image/svg+xml";
        else if ([ext isEqualToString:@"woff2"]) mimeType = @"font/woff2";
        else if ([ext isEqualToString:@"woff"]) mimeType = @"font/woff";
        else if ([ext isEqualToString:@"ttf"]) mimeType = @"font/ttf";
        else if ([ext isEqualToString:@"wasm"]) mimeType = @"application/wasm";
        else if ([ext isEqualToString:@"pdf"]) mimeType = @"application/pdf";

        NSDictionary *headers = @{
            @"Content-Type": mimeType,
            @"Access-Control-Allow-Origin": @"*",
            @"Cache-Control": @"no-cache"
        };
        NSHTTPURLResponse *response = [[NSHTTPURLResponse alloc] initWithURL:url statusCode:200 HTTPVersion:@"HTTP/1.1" headerFields:headers];
        [urlSchemeTask didReceiveResponse:response];
        [urlSchemeTask didReceiveData:data];
        [urlSchemeTask didFinish];
    } else {
        NSHTTPURLResponse *response = [[NSHTTPURLResponse alloc] initWithURL:url statusCode:404 HTTPVersion:@"HTTP/1.1" headerFields:nil];
        [urlSchemeTask didReceiveResponse:response];
        [urlSchemeTask didFinish];
    }
}

- (void)webView:(WKWebView *)webView stopURLSchemeTask:(id<WKURLSchemeTask>)urlSchemeTask {
}

@end

@interface AppDelegate : NSObject <NSApplicationDelegate, WKUIDelegate, WKNavigationDelegate, WKScriptMessageHandler, NSWindowDelegate>
@property (nonatomic, strong) NSWindow *window;
@property (nonatomic, strong) WKWebView *webView;
@property (nonatomic, strong) WKWebView *hiddenPrintWebView;
@end

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
    // 1. Setup Main Menu
    [self setupMenu];

    // 2. Setup Window
    NSRect screenRect = [[NSScreen mainScreen] visibleFrame];
    CGFloat width = MIN(1260, screenRect.size.width * 0.92);
    CGFloat height = MIN(860, screenRect.size.height * 0.92);
    NSRect frame = NSMakeRect((screenRect.size.width - width) / 2 + screenRect.origin.x,
                              (screenRect.size.height - height) / 2 + screenRect.origin.y,
                              width, height);

    NSWindowStyleMask style = NSWindowStyleMaskTitled |
                              NSWindowStyleMaskClosable |
                              NSWindowStyleMaskMiniaturizable |
                              NSWindowStyleMaskResizable;

    self.window = [[NSWindow alloc] initWithContentRect:frame
                                              styleMask:style
                                                backing:NSBackingStoreBuffered
                                                  defer:NO];

    self.window.title = @"ระบบบันทึกและคำนวณเงิน OT (Personal OT Tracker)";
    self.window.minSize = NSMakeSize(960, 640);
    self.window.delegate = self;
    [self.window center];

    // 3. Locate dist folder
    NSString *bundleResPath = [[NSBundle mainBundle] resourcePath];
    NSString *distPath = [bundleResPath stringByAppendingPathComponent:@"dist"];
    
    // Development fallback if running directly without app bundle
    if (![[NSFileManager defaultManager] fileExistsAtPath:distPath]) {
        NSString *currentDir = [[NSFileManager defaultManager] currentDirectoryPath];
        distPath = [currentDir stringByAppendingPathComponent:@"dist"];
    }

    // 4. Setup WKWebView Configuration
    WKWebViewConfiguration *config = [[WKWebViewConfiguration alloc] init];
    config.websiteDataStore = [WKWebsiteDataStore defaultDataStore];
    
    // Register app:// scheme handler
    AssetSchemeHandler *schemeHandler = [[AssetSchemeHandler alloc] initWithDistPath:distPath];
    [config setURLSchemeHandler:schemeHandler forURLScheme:@"app"];

    // Register script message handlers for native file saving, printing, and PDF export
    WKUserContentController *userContent = [[WKUserContentController alloc] init];
    [userContent addScriptMessageHandler:self name:@"nativeSaveFile"];
    [userContent addScriptMessageHandler:self name:@"nativePrint"];
    [userContent addScriptMessageHandler:self name:@"nativeSavePDF"];
    [userContent addScriptMessageHandler:self name:@"nativeSaveDatabase"];
    [userContent addScriptMessageHandler:self name:@"nativeLoadDatabase"];
    config.userContentController = userContent;

    // Enable developer extras in debug
    [config.preferences setValue:@YES forKey:@"developerExtrasEnabled"];

    // 5. Create WKWebView
    self.webView = [[WKWebView alloc] initWithFrame:self.window.contentView.bounds configuration:config];
    self.webView.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
    self.webView.UIDelegate = self;
    self.webView.navigationDelegate = self;

    [self.window.contentView addSubview:self.webView];

    // Load app
    NSURL *appURL = [NSURL URLWithString:@"app://localhost/index.html"];
    [self.webView loadRequest:[NSURLRequest requestWithURL:appURL]];

    [self.window makeKeyAndOrderFront:nil];
    [NSApp activateIgnoringOtherApps:YES];
}

- (NSString *)databaseFilePath {
    NSArray *paths = NSSearchPathForDirectoriesInDomains(NSApplicationSupportDirectory, NSUserDomainMask, YES);
    NSString *appSupportDir = [paths firstObject];
    NSString *otDir = [appSupportDir stringByAppendingPathComponent:@"OT_Tracker"];
    BOOL isDir = NO;
    if (![[NSFileManager defaultManager] fileExistsAtPath:otDir isDirectory:&isDir]) {
        [[NSFileManager defaultManager] createDirectoryAtPath:otDir withIntermediateDirectories:YES attributes:nil error:nil];
    }
    return [otDir stringByAppendingPathComponent:@"ot_database.json"];
}

- (void)webView:(WKWebView *)webView didFinishNavigation:(WKNavigation *)navigation {
    NSString *dbPath = [self databaseFilePath];
    if ([[NSFileManager defaultManager] fileExistsAtPath:dbPath]) {
        NSString *jsonString = [NSString stringWithContentsOfFile:dbPath encoding:NSUTF8StringEncoding error:nil];
        if (jsonString && jsonString.length > 0) {
            NSData *jsonData = [jsonString dataUsingEncoding:NSUTF8StringEncoding];
            NSString *base64 = [jsonData base64EncodedStringWithOptions:0];
            NSString *js = [NSString stringWithFormat:@"window.__INITIAL_NATIVE_DB__ = decodeURIComponent(escape(atob('%@'))); if (window.__onNativeDatabaseLoaded) window.__onNativeDatabaseLoaded(window.__INITIAL_NATIVE_DB__);", base64];
            [webView evaluateJavaScript:js completionHandler:nil];
        }
    }
}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)sender {
    return YES;
}

- (void)windowWillClose:(NSNotification *)notification {
    if (self.webView) {
        [self.webView evaluateJavaScript:@"if (window.__syncDatabaseToNative) window.__syncDatabaseToNative();" completionHandler:nil];
        [[NSRunLoop currentRunLoop] runUntilDate:[NSDate dateWithTimeIntervalSinceNow:0.1]];
    }
}

- (NSApplicationTerminateReply)applicationShouldTerminate:(NSApplication *)sender {
    if (self.webView) {
        [self.webView evaluateJavaScript:@"if (window.__syncDatabaseToNative) window.__syncDatabaseToNative();" completionHandler:nil];
        [[NSRunLoop currentRunLoop] runUntilDate:[NSDate dateWithTimeIntervalSinceNow:0.1]];
    }
    return NSTerminateNow;
}

// WKUIDelegate: Handle <input type="file"> dialog
- (void)webView:(WKWebView *)webView runOpenPanelWithParameters:(WKOpenPanelParameters *)parameters initiatedByFrame:(WKFrameInfo *)frame completionHandler:(void (^)(NSArray<NSURL *> * _Nullable URLs))completionHandler {
    NSOpenPanel *panel = [NSOpenPanel openPanel];
    panel.allowsMultipleSelection = parameters.allowsMultipleSelection;
    panel.canChooseDirectories = parameters.allowsDirectories;
    panel.canChooseFiles = YES;
    panel.title = @"เลือกไฟล์รายงานการลงเวลา (HR_RP_003_TimeToWork.pdf)";
    panel.allowedFileTypes = @[@"pdf"];

    [panel beginSheetModalForWindow:self.window completionHandler:^(NSModalResponse result) {
        if (result == NSModalResponseOK) {
            completionHandler(panel.URLs);
        } else {
            completionHandler(nil);
        }
    }];
}

// WKUIDelegate: Handle JavaScript Alert
- (void)webView:(WKWebView *)webView runJavaScriptAlertPanelWithMessage:(NSString *)message initiatedByFrame:(WKFrameInfo *)frame completionHandler:(void (^)(void))completionHandler {
    NSAlert *alert = [[NSAlert alloc] init];
    alert.messageText = message;
    [alert addButtonWithTitle:@"ตกลง"];
    [alert beginSheetModalForWindow:self.window completionHandler:^(NSModalResponse returnCode) {
        completionHandler();
    }];
}

// WKScriptMessageHandler: Handle nativeSaveFile from JS
- (void)userContentController:(WKUserContentController *)userContentController didReceiveScriptMessage:(WKScriptMessage *)message {
    if ([message.name isEqualToString:@"nativeSaveFile"]) {
        NSDictionary *dict = (NSDictionary *)message.body;
        NSString *suggestedFilename = dict[@"filename"] ?: @"OT_Document.xlsx";
        NSString *base64Str = dict[@"base64"] ?: @"";

        dispatch_async(dispatch_get_main_queue(), ^{
            NSData *data = [[NSData alloc] initWithBase64EncodedString:base64Str options:NSDataBase64DecodingIgnoreUnknownCharacters];
            if (!data) {
                NSString *cb = @"if (window.__macSaveCallback) window.__macSaveCallback({ error: 'Invalid Base64' });";
                [self.webView evaluateJavaScript:cb completionHandler:nil];
                return;
            }

            NSSavePanel *savePanel = [NSSavePanel savePanel];
            savePanel.nameFieldStringValue = suggestedFilename;
            savePanel.title = @"เลือกโฟลเดอร์สำหรับบันทึกเอกสาร";
            savePanel.prompt = @"บันทึกไฟล์";

            NSModalResponse result = [savePanel runModal];
            if (result == NSModalResponseOK && savePanel.URL) {
                NSError *writeErr = nil;
                BOOL success = [data writeToURL:savePanel.URL options:NSDataWritingAtomic error:&writeErr];
                if (success) {
                    NSString *savedPath = [savePanel.URL.path stringByReplacingOccurrencesOfString:@"'" withString:@"\\'"];
                    NSString *savedName = [savePanel.URL.lastPathComponent stringByReplacingOccurrencesOfString:@"'" withString:@"\\'"];
                    NSString *cb = [NSString stringWithFormat:@"if (window.__macSaveCallback) window.__macSaveCallback({ success: true, path: '%@', filename: '%@' });", savedPath, savedName];
                    [self.webView evaluateJavaScript:cb completionHandler:nil];
                } else {
                    NSString *errDesc = [writeErr.localizedDescription stringByReplacingOccurrencesOfString:@"'" withString:@"\\'"];
                    NSString *cb = [NSString stringWithFormat:@"if (window.__macSaveCallback) window.__macSaveCallback({ error: '%@' });", errDesc];
                    [self.webView evaluateJavaScript:cb completionHandler:nil];
                }
            } else {
                NSString *cb = @"if (window.__macSaveCallback) window.__macSaveCallback({ cancelled: true });";
                [self.webView evaluateJavaScript:cb completionHandler:nil];
            }
        });
    } else if ([message.name isEqualToString:@"nativePrint"]) {
        dispatch_async(dispatch_get_main_queue(), ^{
            NSDictionary *dict = [message.body isKindOfClass:[NSDictionary class]] ? (NSDictionary *)message.body : nil;
            NSString *orientation = dict[@"orientation"] ?: @"landscape";
            NSString *html = dict[@"html"];
            
            NSPrintInfo *printInfo = [NSPrintInfo sharedPrintInfo];
            if ([orientation isEqualToString:@"portrait"]) {
                [printInfo setOrientation:NSPaperOrientationPortrait];
            } else {
                [printInfo setOrientation:NSPaperOrientationLandscape];
            }
            [printInfo setTopMargin:15];
            [printInfo setBottomMargin:15];
            [printInfo setLeftMargin:15];
            [printInfo setRightMargin:15];

            if (html && html.length > 0) {
                CGFloat w = [orientation isEqualToString:@"portrait"] ? 794.0 : 1123.0;
                CGFloat h = [orientation isEqualToString:@"portrait"] ? 1123.0 : 794.0;
                WKWebViewConfiguration *pConfig = [[WKWebViewConfiguration alloc] init];
                self.hiddenPrintWebView = [[WKWebView alloc] initWithFrame:CGRectMake(0, 0, w, h) configuration:pConfig];
                [self.hiddenPrintWebView loadHTMLString:html baseURL:[NSURL URLWithString:@"app://localhost/"]];
                
                dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(350 * NSEC_PER_MSEC)), dispatch_get_main_queue(), ^{
                    NSPrintOperation *op = [self.hiddenPrintWebView printOperationWithPrintInfo:printInfo];
                    op.showsPrintPanel = YES;
                    [op runOperationModalForWindow:self.window delegate:nil didRunSelector:nil contextInfo:nil];
                });
            } else {
                NSPrintOperation *op = [self.webView printOperationWithPrintInfo:printInfo];
                op.showsPrintPanel = YES;
                [op runOperationModalForWindow:self.window delegate:nil didRunSelector:nil contextInfo:nil];
            }
        });
    } else if ([message.name isEqualToString:@"nativeSavePDF"]) {
        dispatch_async(dispatch_get_main_queue(), ^{
            NSDictionary *dict = [message.body isKindOfClass:[NSDictionary class]] ? (NSDictionary *)message.body : nil;
            NSString *suggestedFilename = dict[@"filename"] ?: @"OT_Document.pdf";
            NSString *orientation = dict[@"orientation"] ?: @"landscape";
            NSString *html = dict[@"html"];
            
            if (@available(macOS 11.0, *)) {
                NSSavePanel *savePanel = [NSSavePanel savePanel];
                savePanel.nameFieldStringValue = suggestedFilename;
                savePanel.title = @"บันทึกเอกสารเป็นไฟล์ PDF";
                savePanel.prompt = @"บันทึก";
                savePanel.allowedFileTypes = @[@"pdf"];
                
                NSModalResponse res = [savePanel runModal];
                if (res == NSModalResponseOK && savePanel.URL) {
                    NSURL *destURL = savePanel.URL;
                    CGFloat w = [orientation isEqualToString:@"portrait"] ? 794.0 : 1123.0;
                    CGFloat h = [orientation isEqualToString:@"portrait"] ? 1123.0 : 794.0;
                    
                    WKWebViewConfiguration *pConfig = [[WKWebViewConfiguration alloc] init];
                    WKWebView *pdfView = [[WKWebView alloc] initWithFrame:CGRectMake(0, 0, w, h) configuration:pConfig];
                    
                    if (html && html.length > 0) {
                        [pdfView loadHTMLString:html baseURL:[NSURL URLWithString:@"app://localhost/"]];
                    } else {
                        pdfView = self.webView;
                    }
                    
                    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(350 * NSEC_PER_MSEC)), dispatch_get_main_queue(), ^{
                        WKPDFConfiguration *pdfConfig = [[WKPDFConfiguration alloc] init];
                        [pdfView createPDFWithConfiguration:pdfConfig completionHandler:^(NSData * _Nullable pdfData, NSError * _Nullable error) {
                            if (pdfData && pdfData.length > 0) {
                                NSError *err = nil;
                                [pdfData writeToURL:destURL options:NSDataWritingAtomic error:&err];
                                NSString *cb = [NSString stringWithFormat:@"if (window.__macPdfCallback) window.__macPdfCallback({ success: true, filename: '%@' });", destURL.lastPathComponent];
                                [self.webView evaluateJavaScript:cb completionHandler:nil];
                            } else {
                                NSString *cb = @"if (window.__macPdfCallback) window.__macPdfCallback({ error: 'Failed to generate PDF' });";
                                [self.webView evaluateJavaScript:cb completionHandler:nil];
                            }
                        }];
                    });
                } else {
                    NSString *cb = @"if (window.__macPdfCallback) window.__macPdfCallback({ cancelled: true });";
                    [self.webView evaluateJavaScript:cb completionHandler:nil];
                }
            }
        });
    } else if ([message.name isEqualToString:@"nativeSaveDatabase"]) {
        NSString *jsonString = nil;
        if ([message.body isKindOfClass:[NSString class]]) {
            jsonString = (NSString *)message.body;
        } else if ([NSJSONSerialization isValidJSONObject:message.body]) {
            NSData *jsonData = [NSJSONSerialization dataWithJSONObject:message.body options:NSJSONWritingPrettyPrinted error:nil];
            if (jsonData) {
                jsonString = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
            }
        }
        if (jsonString && jsonString.length > 0) {
            NSString *dbPath = [self databaseFilePath];
            NSError *err = nil;
            BOOL success = [jsonString writeToFile:dbPath atomically:YES encoding:NSUTF8StringEncoding error:&err];
            if (success) {
                NSLog(@"✅ [Native] Successfully saved database to disk: %@", dbPath);
            } else {
                NSLog(@"❌ [Native] Failed to save database: %@", err);
            }
        }
    } else if ([message.name isEqualToString:@"nativeLoadDatabase"]) {
        NSString *dbPath = [self databaseFilePath];
        if ([[NSFileManager defaultManager] fileExistsAtPath:dbPath]) {
            NSString *jsonString = [NSString stringWithContentsOfFile:dbPath encoding:NSUTF8StringEncoding error:nil];
            if (jsonString && jsonString.length > 0) {
                NSData *jsonData = [jsonString dataUsingEncoding:NSUTF8StringEncoding];
                NSString *base64 = [jsonData base64EncodedStringWithOptions:0];
                NSString *js = [NSString stringWithFormat:@"if (window.__onNativeDatabaseLoaded) window.__onNativeDatabaseLoaded(decodeURIComponent(escape(atob('%@'))));", base64];
                [self.webView evaluateJavaScript:js completionHandler:nil];
            }
        }
    }
}

- (void)setupMenu {
    NSMenu *mainMenu = [[NSMenu alloc] init];

    // App Menu
    NSMenuItem *appMenuItem = [[NSMenuItem alloc] init];
    NSMenu *appMenu = [[NSMenu alloc] initWithTitle:@"OT Tracker"];
    [appMenu addItemWithTitle:@"เกี่ยวกับระบบบันทึก OT" action:@selector(orderFrontStandardAboutPanel:) keyEquivalent:@""];
    [appMenu addItem:[NSMenuItem separatorItem]];
    [appMenu addItemWithTitle:@"ซ่อน OT Tracker" action:@selector(hide:) keyEquivalent:@"h"];
    NSMenuItem *hideOthers = [[NSMenuItem alloc] initWithTitle:@"ซ่อนหน้าต่างอื่น" action:@selector(hideOtherApplications:) keyEquivalent:@"h"];
    hideOthers.keyEquivalentModifierMask = NSEventModifierFlagCommand | NSEventModifierFlagOption;
    [appMenu addItem:hideOthers];
    [appMenu addItemWithTitle:@"แสดงทั้งหมด" action:@selector(unhideAllApplications:) keyEquivalent:@""];
    [appMenu addItem:[NSMenuItem separatorItem]];
    [appMenu addItemWithTitle:@"ออกจาก OT Tracker" action:@selector(terminate:) keyEquivalent:@"q"];
    [appMenuItem setSubmenu:appMenu];
    [mainMenu addItem:appMenuItem];

    // File Menu (Print / Save)
    NSMenuItem *fileMenuItem = [[NSMenuItem alloc] init];
    NSMenu *fileMenu = [[NSMenu alloc] initWithTitle:@"ไฟล์ (File)"];
    [fileMenu addItemWithTitle:@"พิมพ์เอกสาร (Print)..." action:@selector(printAction:) keyEquivalent:@"p"];
    [fileMenuItem setSubmenu:fileMenu];
    [mainMenu addItem:fileMenuItem];

    // Edit Menu (Essential for Cut / Copy / Paste / Select All)
    NSMenuItem *editMenuItem = [[NSMenuItem alloc] init];
    NSMenu *editMenu = [[NSMenu alloc] initWithTitle:@"แก้ไข (Edit)"];
    [editMenu addItemWithTitle:@"ยกเลิก (Undo)" action:@selector(undo:) keyEquivalent:@"z"];
    NSMenuItem *redo = [[NSMenuItem alloc] initWithTitle:@"ทำซ้ำ (Redo)" action:@selector(redo:) keyEquivalent:@"Z"];
    [editMenu addItem:redo];
    [editMenu addItem:[NSMenuItem separatorItem]];
    [editMenu addItemWithTitle:@"ตัด (Cut)" action:@selector(cut:) keyEquivalent:@"x"];
    [editMenu addItemWithTitle:@"คัดลอก (Copy)" action:@selector(copy:) keyEquivalent:@"c"];
    [editMenu addItemWithTitle:@"วาง (Paste)" action:@selector(paste:) keyEquivalent:@"v"];
    [editMenu addItemWithTitle:@"เลือกทั้งหมด (Select All)" action:@selector(selectAll:) keyEquivalent:@"a"];
    [editMenuItem setSubmenu:editMenu];
    [mainMenu addItem:editMenuItem];

    // View Menu
    NSMenuItem *viewMenuItem = [[NSMenuItem alloc] init];
    NSMenu *viewMenu = [[NSMenu alloc] initWithTitle:@"มุมมอง (View)"];
    [viewMenu addItemWithTitle:@"โหลดใหม่ (Reload)" action:@selector(reloadAction:) keyEquivalent:@"r"];
    [viewMenu addItemWithTitle:@"เต็มจอ (Full Screen)" action:@selector(toggleFullScreen:) keyEquivalent:@"f"];
    [viewMenuItem setSubmenu:viewMenu];
    [mainMenu addItem:viewMenuItem];

    // Window Menu
    NSMenuItem *windowMenuItem = [[NSMenuItem alloc] init];
    NSMenu *windowMenu = [[NSMenu alloc] initWithTitle:@"หน้าต่าง (Window)"];
    [windowMenu addItemWithTitle:@"ย่อหน้าต่าง (Minimize)" action:@selector(performMiniaturize:) keyEquivalent:@"m"];
    [windowMenu addItemWithTitle:@"ขยายหน้าต่าง (Zoom)" action:@selector(performZoom:) keyEquivalent:@""];
    [windowMenuItem setSubmenu:windowMenu];
    [mainMenu addItem:windowMenuItem];

    [NSApp setMainMenu:mainMenu];
}

- (void)reloadAction:(id)sender {
    [self.webView reload];
}

- (void)printAction:(id)sender {
    NSPrintInfo *printInfo = [NSPrintInfo sharedPrintInfo];
    NSPrintOperation *op = [self.webView printOperationWithPrintInfo:printInfo];
    op.showsPrintPanel = YES;
    [op runOperationModalForWindow:self.window delegate:nil didRunSelector:nil contextInfo:nil];
}

@end

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        NSApplication *app = [NSApplication sharedApplication];
        [app setActivationPolicy:NSApplicationActivationPolicyRegular];
        AppDelegate *delegate = [[AppDelegate alloc] init];
        [app setDelegate:delegate];
        [app run];
    }
    return 0;
}
