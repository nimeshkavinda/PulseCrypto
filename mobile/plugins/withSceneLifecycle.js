/* eslint-disable no-undef, @typescript-eslint/no-require-imports */
/**
 * Adopts the UIScene life cycle on iOS, which iOS 27 requires: apps without it assert at launch
 * (`_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`).
 *
 * Expo SDK 57 ships `ExpoAppSceneDelegate`, but its app template still uses the app-delegate window.
 * This plugin applies the SDK 58 template's wiring so `expo prebuild` output is iOS 27 compatible:
 *  - Info.plist `UIApplicationSceneManifest` pointing at `SceneDelegate`
 *  - `SceneDelegate.swift` subclassing `ExpoAppSceneDelegate`, added to the app target
 *  - `AppDelegate` conforms to `ExpoReactNativeFactoryProvider` and leaves window creation to the scene
 * Idempotent: running prebuild again does not duplicate anything.
 */
const fs = require('fs');
const path = require('path');
const { withInfoPlist, withAppDelegate, withXcodeProject, IOSConfig } = require('expo/config-plugins');

const SCENE_DELEGATE = `internal import Expo

@objc(SceneDelegate)
class SceneDelegate: ExpoAppSceneDelegate {
  // Extension point for config plugins.
}
`;

function withSceneManifest(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return cfg;
  });
}

function withSceneAwareAppDelegate(config) {
  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error('withSceneLifecycle supports Swift AppDelegates only');
    }
    let src = cfg.modResults.contents;
    if (!src.includes('ExpoReactNativeFactoryProvider')) {
      src = src.replace(
        /class AppDelegate: ExpoAppDelegate \{/,
        'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {'
      );
    }
    // The scene delegate creates the window and starts React Native.
    src = src.replace(
      /#if os\(iOS\) \|\| os\(tvOS\)\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\s*factory\.startReactNative\([\s\S]*?\)\s*#endif\s*/,
      '// The window is created and React Native is started by `SceneDelegate` (iOS 27 scene life cycle).\n    '
    );
    cfg.modResults.contents = src;
    return cfg;
  });
}

function withSceneDelegateFile(config) {
  return withXcodeProject(config, (cfg) => {
    const projectName = IOSConfig.XcodeUtils.getProjectName(cfg.modRequest.projectRoot);
    const target = path.join(cfg.modRequest.platformProjectRoot, projectName, 'SceneDelegate.swift');
    fs.writeFileSync(target, SCENE_DELEGATE);
    const project = cfg.modResults;
    const groupPath = `${projectName}/SceneDelegate.swift`;
    if (!project.hasFile(groupPath)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath: groupPath,
        groupName: projectName,
        project,
      });
    }
    return cfg;
  });
}

module.exports = function withSceneLifecycle(config) {
  return withSceneDelegateFile(withSceneAwareAppDelegate(withSceneManifest(config)));
};
