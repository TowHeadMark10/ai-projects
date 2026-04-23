#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE (LiveActivityModule, NSObject)

RCT_EXTERN_METHOD(startActivity : (NSString *)sessionType totalSeconds : (
    double)totalSeconds endTimestamp : (double)
                      endTimestamp resolve : (RCTPromiseResolveBlock)
                          resolve reject : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(updateActivity : (double)endTimestamp isPaused : (BOOL)
                      isPaused timeRemaining : (double)
                          timeRemaining resolve : (RCTPromiseResolveBlock)
                              resolve reject : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(dismissActivity : (RCTPromiseResolveBlock)
                      resolve reject : (RCTPromiseRejectBlock)reject)

@end