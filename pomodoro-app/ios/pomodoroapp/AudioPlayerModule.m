#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(AudioPlayerModule, NSObject)
RCT_EXTERN_METHOD(startAudio)
RCT_EXTERN_METHOD(pauseAudio)
RCT_EXTERN_METHOD(stopAudio)
@end
