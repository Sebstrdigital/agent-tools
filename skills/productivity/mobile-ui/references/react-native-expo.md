# React Native and Expo UI

Read this reference when `mobile-ui` applies to a React Native or Expo project. Check the installed React Native, Expo SDK, navigation and library versions against their matching documentation; current online guidance may describe newer behavior. Reuse the project's existing components, navigation and dependencies instead of introducing a parallel stack.

## Layout, input and navigation

- Use the app's established safe-area provider and inset handling for notches, status bars, home indicators and Android edge-to-edge. Apply insets at the appropriate boundary; avoid double padding when a navigator or parent already handles them. React Native's built-in `SafeAreaView` is deprecated; if the project uses `react-native-safe-area-context`, follow its existing provider and APIs.
- Use flexible layout and scrollable content where needed. Check narrow screens, supported rotation and enlarged system text; avoid fixed heights that clip labels or controls. Keep primary actions reachable.
- Test focused fields and submit actions with the keyboard open on both targeted platforms. Use the existing keyboard strategy; `KeyboardAvoidingView` behavior and offsets depend on platform, navigation headers, window settings and SDK version. Avoid applying keyboard or inset adjustment twice. Preserve normal dismissal and form navigation.
- Follow the existing router and native platform navigation conventions. Verify back navigation, modal dismissal and gestures, including Android system back where relevant. Do not add a navigation library solely to follow this reference.

## Accessible interaction

- Prefer existing accessible native controls. Give interactive elements meaningful labels, appropriate roles and state (such as disabled, selected or expanded); label icon-only controls. Group elements only where it makes sense, because VoiceOver and TalkBack differ in focus behavior. Announce important dynamic changes using the appropriate platform mechanism.
- Aim for at least 44 × 44 points on iOS and 48 × 48 dp on Android, with no overlapping touch regions. A `Pressable` `hitSlop` can expand an area but cannot extend beyond its parent bounds, and overlapping siblings affect hit testing; validate actual interaction rather than relying on the prop alone.
- Preserve system font scaling and readable reflow; avoid disabling scaling to make a layout fit. Support contrast, non-color cues and reduced motion. Test screen-reader order and actions, not just accessibility properties.

## Responsiveness and performance

- Use the project's established virtualized list for large or unbounded collections; `FlatList`/`SectionList` are options. Supply stable keys and use accurate fixed-item layout information only when dimensions really are fixed. Tune batching, memoization or clipping only for a measured problem and check for missing content.
- Use appropriately sized images and the existing image/cache policy. Keep animation and expensive work from blocking interactions; honor reduced motion. Profile representative flows in a release-like build on appropriate devices before claiming performance improvements.

## Verification

Run the project-prescribed checks and launch the actual changed screen on available targeted simulators or devices. Exercise layout/insets, scroll and touch, keyboard, navigation and meaningful states; test large text and VoiceOver/TalkBack where feasible. Record actual platform and device coverage and any missing runtime or accessibility verification. A web preview or component test does not establish native iOS or Android behavior.

## Sources

- [Expo: safe areas](https://docs.expo.dev/develop/user-interface/safe-areas/) and [keyboard handling](https://docs.expo.dev/guides/keyboard-handling/)
- [React Native: accessibility](https://reactnative.dev/docs/accessibility), [Pressable](https://reactnative.dev/docs/pressable), [SafeAreaView](https://reactnative.dev/docs/safeareaview), [FlatList optimization](https://reactnative.dev/docs/optimizing-flatlist-configuration) and [performance](https://reactnative.dev/docs/performance)
- [Apple UI design tips](https://developer.apple.com/design/tips/) and [Android touch target size](https://support.google.com/accessibility/android/answer/7101858?hl=en)
