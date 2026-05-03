  import { NativeModules } from 'react-native';                                                                  
                                              
  const { LiveActivityModule } = NativeModules;                                                                  
                           
  // Fire and forget — no promise needed, JS doesn't need to await these                                         
  export function startActivity(          
    sessionType: string,                                                                                         
    totalSeconds: number,                                                                                        
    endTimestamp: number,                     
    pomodoroCount: number                                                                                        
  ): void {                
    if (!LiveActivityModule) return;                                                                             
    LiveActivityModule.startActivity(sessionType, totalSeconds, endTimestamp, pomodoroCount);
  }                                                                                                              
                                          
  export function updateActivity(
    endTimestamp: number,                                                                                        
    isPaused: boolean,
    timeRemaining: number                                                                                        
  ): void {                
    if (!LiveActivityModule) return;
    LiveActivityModule.updateActivity(endTimestamp, isPaused, timeRemaining);
  }                                           
                                          
  export function dismissActivity(): void {
    if (!LiveActivityModule) return;                                                                             
    LiveActivityModule.dismissActivity();
  } 