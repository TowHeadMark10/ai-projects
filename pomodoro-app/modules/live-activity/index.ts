import { requireNativeModule } from 'expo-modules-core';                                                  
                                                                                                            
  // Load the native Swift module by its registered name                                                    
  const LiveActivityModule = requireNativeModule('LiveActivity');
                                                                                                            
  // Start a new Live Activity when the timer begins                                                        
  export async function startActivity(                                                                      
    sessionType: string,  // "Focus" or "Break"                                                             
    totalSeconds: number, // total session duration in seconds                                              
    endTimestamp: number  // Unix seconds when the timer expires                                            
  ): Promise<void> {                      
    return LiveActivityModule.startActivity(sessionType, totalSeconds, endTimestamp);
  }                                                                                                         
   
  // Update the Live Activity on pause or resume                                                            
  export async function updateActivity(
    endTimestamp: number,  // updated expiry time in Unix seconds                                           
    isPaused: boolean,                        
    timeRemaining: number  // seconds remaining
  ): Promise<void> {
    return LiveActivityModule.updateActivity(endTimestamp, isPaused, timeRemaining);                        
  }                                           
                                                                                                            
  // End the Live Activity when the timer completes or is reset
  export async function endActivity(timeRemaining: number): Promise<void> {                                 
    return LiveActivityModule.endActivity(timeRemaining);
  }  
