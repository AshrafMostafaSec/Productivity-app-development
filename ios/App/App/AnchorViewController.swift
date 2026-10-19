import Capacitor

class AnchorViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(AnchorNativePlugin())
    }
}
