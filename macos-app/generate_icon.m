#import <Cocoa/Cocoa.h>

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        int size = 1024;
        NSBitmapImageRep *rep = [[NSBitmapImageRep alloc]
            initWithBitmapDataPlanes:NULL
            pixelsWide:size
            pixelsHigh:size
            bitsPerSample:8
            samplesPerPixel:4
            hasAlpha:YES
            isPlanar:NO
            colorSpaceName:NSDeviceRGBColorSpace
            bytesPerRow:size * 4
            bitsPerPixel:32];

        NSGraphicsContext *context = [NSGraphicsContext graphicsContextWithBitmapImageRep:rep];
        [NSGraphicsContext setCurrentContext:context];

        // Background transparent
        [[NSColor clearColor] set];
        NSRectFill(NSMakeRect(0, 0, size, size));

        // macOS Squircle Icon Background
        CGFloat padding = 90;
        NSRect iconRect = NSMakeRect(padding, padding, size - padding * 2, size - padding * 2);
        NSBezierPath *squircle = [NSBezierPath bezierPathWithRoundedRect:iconRect xRadius:185 yRadius:185];

        // Red Gradient (#b31b27 to #800e17)
        NSColor *topColor = [NSColor colorWithCalibratedRed:0.75 green:0.12 blue:0.16 alpha:1.0];
        NSColor *bottomColor = [NSColor colorWithCalibratedRed:0.48 green:0.06 blue:0.09 alpha:1.0];
        NSGradient *gradient = [[NSGradient alloc] initWithStartingColor:bottomColor endingColor:topColor];
        [gradient drawInBezierPath:squircle angle:90];

        // Inner border highlight
        [squircle setLineWidth:4];
        [[NSColor colorWithCalibratedWhite:1.0 alpha:0.25] setStroke];
        [squircle stroke];

        // Draw Clock / Timer Circle
        CGFloat clockRadius = 160;
        NSPoint clockCenter = NSMakePoint(size / 2.0, size / 2.0 + 70);
        NSRect clockRect = NSMakeRect(clockCenter.x - clockRadius, clockCenter.y - clockRadius, clockRadius * 2, clockRadius * 2);
        NSBezierPath *clockCircle = [NSBezierPath bezierPathWithOvalInRect:clockRect];
        [clockCircle setLineWidth:18];
        [[NSColor colorWithCalibratedWhite:1.0 alpha:0.95] setStroke];
        [clockCircle stroke];

        // Clock hands (showing overtime ~ 18:30)
        NSBezierPath *hands = [NSBezierPath bezierPath];
        [hands moveToPoint:clockCenter];
        [hands lineToPoint:NSMakePoint(clockCenter.x, clockCenter.y + 100)]; // minute hand
        [hands moveToPoint:clockCenter];
        [hands lineToPoint:NSMakePoint(clockCenter.x + 65, clockCenter.y - 15)]; // hour hand
        [hands setLineWidth:14];
        [hands setLineCapStyle:NSLineCapStyleRound];
        [[NSColor colorWithCalibratedWhite:1.0 alpha:0.95] setStroke];
        [hands stroke];

        // Draw "OT" Text below clock
        NSString *text = @"OT";
        NSFont *font = [NSFont systemFontOfSize:170 weight:NSFontWeightBold];
        NSDictionary *attrs = @{
            NSFontAttributeName: font,
            NSForegroundColorAttributeName: [NSColor whiteColor]
        };
        NSSize textSize = [text sizeWithAttributes:attrs];
        NSPoint textOrigin = NSMakePoint((size - textSize.width) / 2.0, padding + 105);
        [text drawAtPoint:textOrigin withAttributes:attrs];

        // Small subtitle "TRACKER"
        NSString *subText = @"TRACKER";
        NSFont *subFont = [NSFont systemFontOfSize:46 weight:NSFontWeightSemibold];
        NSDictionary *subAttrs = @{
            NSFontAttributeName: subFont,
            NSForegroundColorAttributeName: [NSColor colorWithCalibratedWhite:1.0 alpha:0.8]
        };
        NSSize subTextSize = [subText sizeWithAttributes:subAttrs];
        NSPoint subTextOrigin = NSMakePoint((size - subTextSize.width) / 2.0, padding + 55);
        [subText drawAtPoint:subTextOrigin withAttributes:subAttrs];

        [context flushGraphics];

        NSData *pngData = [rep representationUsingType:NSBitmapImageFileTypePNG properties:@{}];
        NSString *outputPath = argc > 1 ? [NSString stringWithUTF8String:argv[1]] : @"icon_1024.png";
        [pngData writeToFile:outputPath atomically:YES];
        NSLog(@"Icon written to %@", outputPath);
    }
    return 0;
}
