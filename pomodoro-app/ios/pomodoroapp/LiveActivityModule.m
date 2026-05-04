#import <React/RCTBridgeModule.h>                                                                              
                                                                                                                 
  @interface RCT_EXTERN_MODULE (LiveActivityModule, NSObject)                                                    

  // No promise blocks — fire and forget from JS                                                                 
  RCT_EXTERN_METHOD(startActivity : (NSString *)sessionType
                    totalSeconds : (double)totalSeconds                                                          
                    endTimestamp : (double)endTimestamp                                                          
                    pomodoroCount : (double)pomodoroCount)
                                                                                                                 
  RCT_EXTERN_METHOD(updateActivity : (double)endTimestamp
                    isPaused : (BOOL)isPaused                                                                    
                    timeRemaining : (double)timeRemaining)
                                                                                                                 
  RCT_EXTERN_METHOD(dismissActivity)
                                                                                                                 
  @end
                               