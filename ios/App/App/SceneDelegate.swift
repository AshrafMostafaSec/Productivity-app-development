import UIKit
import Capacitor
import GoogleSignIn

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    private var backgroundTask: UIBackgroundTaskIdentifier = .invalid

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = AnchorViewController()
        window?.makeKeyAndVisible()

        for context in connectionOptions.urlContexts {
            if GIDSignIn.sharedInstance.handle(context.url) { break }
        }
        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        let unhandled = URLContexts.filter { !GIDSignIn.sharedInstance.handle($0.url) }
        if !unhandled.isEmpty { SceneDelegateProxy.shared.scene(scene, openURLContexts: Set(unhandled)) }
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
    func sceneDidEnterBackground(_ scene: UIScene) {
        guard backgroundTask == .invalid else { return }
        backgroundTask = UIApplication.shared.beginBackgroundTask(withName: "AnchorOS pending save") { [weak self] in
            self?.finishBackgroundTask()
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 25) { [weak self] in self?.finishBackgroundTask() }
    }
    func sceneWillEnterForeground(_ scene: UIScene) { finishBackgroundTask() }
    private func finishBackgroundTask() {
        if backgroundTask != .invalid { UIApplication.shared.endBackgroundTask(backgroundTask); backgroundTask = .invalid }
    }

}
