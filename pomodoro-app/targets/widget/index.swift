import WidgetKit
import SwiftUI

// Entry point — only export the Live Activity widget
@main
struct exportWidgets: WidgetBundle {
    var body: some Widget {
        WidgetLiveActivity()
    }
}
