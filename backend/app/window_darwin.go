//go:build darwin

package app

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework Cocoa
#import <Cocoa/Cocoa.h>

static NSWindow* activeWindow(void) {
    NSWindow *window = [NSApp keyWindow];
    if (window == nil) {
        window = [NSApp mainWindow];
    }
    return window;
}

static bool activeWindowIsFullscreen(void) {
    NSWindow *window = activeWindow();
    if (window == nil) {
        return false;
    }

    NSUInteger mask = [window styleMask];
    return (mask & NSWindowStyleMaskFullScreen) == NSWindowStyleMaskFullScreen;
}

static void toggleActiveWindowFullscreen(void) {
    NSWindow *window = activeWindow();
    if (window == nil) {
        return;
    }

    NSWindowCollectionBehavior behavior = [window collectionBehavior];
    behavior |= NSWindowCollectionBehaviorFullScreenPrimary;
    [window setCollectionBehavior:behavior];
    [window toggleFullScreen:nil];
}

static bool isMacFullscreen(void) {
    if ([NSThread isMainThread]) {
        return activeWindowIsFullscreen();
    }

    __block bool result = false;
    dispatch_sync(dispatch_get_main_queue(), ^{
        result = activeWindowIsFullscreen();
    });
    return result;
}

static void toggleMacFullscreen(void) {
    if ([NSThread isMainThread]) {
        toggleActiveWindowFullscreen();
        return;
    }

    dispatch_async(dispatch_get_main_queue(), ^{
        toggleActiveWindowFullscreen();
    });
}
*/
import "C"

func (a *App) ToggleMacFullscreen() {
	C.toggleMacFullscreen()
}

func (a *App) IsMacFullscreen() bool {
	return bool(C.isMacFullscreen())
}
