---
name: mobile-ui
description: Design, implement, or verify mobile app interfaces. Use for iOS or Android UI work, including React Native and Expo, and load the relevant stack-specific guidance.
---

# Mobile UI

Use for native or cross-platform mobile UI work. Inspect the project, target platforms, existing design system, dependencies, navigation, and relevant framework versions before choosing an approach. Follow project conventions and user requirements; this skill grants no tools or permissions.

## Select stack guidance

Read the applicable reference relative to this skill directory before implementing or reviewing the UI:

- **React Native or Expo:** [React Native and Expo UI](references/react-native-expo.md), for either or both target platforms.
- **Other stacks, including native iOS or Android:** no stack-specific reference is currently provided. Apply the general guidance below and consult the project's version-appropriate framework and platform documentation. Do not pretend React Native guidance applies to a native stack. Additional stack references can be added here later.

## Mobile UI principles

- Fit content to available screen space, system bars, cutouts, and gesture areas. Support small and large screens, rotation or resizing where the app supports it, and larger system text without clipping essential content.
- Make controls easy to tap without overlapping adjacent hit areas. Apple recommends at least 44 × 44 points; Android recommends at least 48 × 48 dp. Preserve appropriate platform conventions for navigation, back actions, gestures, and system feedback.
- Support accessible names, roles, states, focus order, meaningful announcements, contrast, and screen readers. Do not convey meaning by color alone. Respect user text-size and reduced-motion settings where applicable.
- Keep focused inputs and primary actions reachable with the keyboard open. Account for loading, empty, error, disabled and offline states when relevant; do not introduce new behavior outside the assignment.
- Keep scrolling and interaction responsive. Measure real issues before adding complexity. Handle images and long lists using the project's existing patterns.

## Verify the actual surface

Exercise the changed screen and relevant interactions on each targeted platform when the available runtime permits. Check safe areas, small screens and large text, touch targets, keyboard visibility and dismissal, navigation/back behavior, and relevant loading/error states. For accessibility changes, exercise VoiceOver and/or TalkBack and focus order when available. For performance-sensitive work, measure a representative scenario in a release-like build.

Report which devices/simulators, platforms, accessibility settings and scenarios were actually checked; identify unavailable platforms or untested behavior rather than claiming equivalent coverage. Never install dependencies, alter a live environment, or expand permissions solely because this skill recommends verification.

## Platform references

- [Apple UI design tips](https://developer.apple.com/design/tips/) and [Human Interface Guidelines: accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [Android touch target size](https://support.google.com/accessibility/android/answer/7101858?hl=en) and [Android accessibility principles](https://developer.android.com/guide/topics/ui/accessibility/principles)
