/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
  module.exports = config => ({                                                                                      
    type: "widget",                                                                                                  
    icon: 'https://github.com/expo.png',                                                                             
    // ActivityKit is required for Live Activities support                                                           
    frameworks: ['ActivityKit'],                                                                                     
    entitlements: {                                                                                                  
      // App Groups allow the main app and widget extension to share data                                            
      'com.apple.security.application-groups': [                                                                     
        'group.com.towheadmark10.pomodoroapp'                                                                        
      ]                                                                                                              
    },                                                                                                               
  });   