/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
  module.exports = config => ({                                                                                      
    type: "widget",                                                                                                  
    icon: 'https://github.com/expo.png',                                                                             
    // Minimum iOS 16.2 required for ActivityKit Live Activities                                   
    deploymentTarget: "16.2",                                                          
    frameworks: ['ActivityKit'],                                                                                     
    entitlements: {                                                                                                  
      // App Groups allow the main app and widget extension to share data                                            
      'com.apple.security.application-groups': [                                                                     
        'group.com.towheadmark10.pomodoroapp'                                                                        
      ]                                                                                                              
    },                                                                                                               
  });   