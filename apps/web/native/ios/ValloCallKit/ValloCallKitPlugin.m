#import <Capacitor/Capacitor.h>

CAP_PLUGIN(ValloCallKitPlugin, "ValloCallKit",
    CAP_PLUGIN_METHOD(reportNewCall, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(configureAudio, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(updateCall, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(endCall, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(isAvailable, CAPPluginReturnPromise);
)
