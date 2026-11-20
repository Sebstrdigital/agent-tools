# agent-browser — Full Command Reference

CLI browser automation tool by Vercel Labs (Rust binary). Replaces `playwright-cli`.

## Installation

```bash
npm install -g agent-browser
agent-browser install          # Download Chromium
```

## Core Workflow

```bash
agent-browser open <url>       # Open URL (headless by default)
agent-browser open <url> --headed  # Visible browser
agent-browser snapshot         # Accessibility tree with @e1, @e2 refs
agent-browser click @e1        # Click element by ref
agent-browser fill @e2 "text"  # Clear + fill input
agent-browser type @e2 "text"  # Type into element (keystroke simulation)
agent-browser screenshot       # Full page screenshot
agent-browser screenshot --full  # Full scrollable page
agent-browser close            # Close browser
```

## Navigation & Interaction

```bash
agent-browser open <url>                  # Navigate (aliases: goto, navigate)
agent-browser click <sel>                 # Click (--new-tab opens in new tab)
agent-browser dblclick <sel>              # Double-click
agent-browser focus <sel>                 # Focus element
agent-browser fill <sel> "text"           # Clear and fill
agent-browser type <sel> "text"           # Type into element
agent-browser press Enter                 # Press key (Enter, Tab, Control+a)
agent-browser keyboard type "text"        # Real keystrokes
agent-browser keyboard inserttext "text"  # Insert without key events
agent-browser hover <sel>                 # Hover
agent-browser select <sel> "value"        # Select dropdown option
agent-browser check <sel>                 # Check checkbox
agent-browser uncheck <sel>               # Uncheck checkbox
```

## Selectors

Three selector types:

1. **Refs from snapshot:** `@e1`, `@e2` — most common for AI agents
2. **CSS selectors:** `"#submit"`, `".btn-primary"`, `"input[name=email]"`
3. **Semantic locators:** `find` commands (see below)

## Semantic Locators (find)

Find elements by accessibility properties — no snapshot needed:

```bash
agent-browser find role button click --name "Submit"
agent-browser find text "Sign In" click
agent-browser find label "Email" fill "user@test.com"
agent-browser find placeholder "Search..." fill "query"
agent-browser find alt "Logo" click
agent-browser find title "Close" click
agent-browser find testid "submit-btn" click
agent-browser find first ".item" click       # First match
agent-browser find last ".item" click        # Last match
agent-browser find nth 2 ".item" click       # Nth match (0-indexed)
```

Actions: `click`, `fill`, `type`, `hover`, `focus`, `check`, `uncheck`, `text`
Options: `--name "accessible name"`, `--exact` (exact text match)

## Get Information

```bash
agent-browser get text @e1          # Text content
agent-browser get html @e1          # innerHTML
agent-browser get value @e1         # Input value
agent-browser get attr @e1 href     # Attribute value
agent-browser get title             # Page title
agent-browser get url               # Current URL
agent-browser get count ".items"    # Count matching elements
agent-browser get box @e1           # Bounding box {x,y,w,h}
agent-browser get styles @e1        # Computed styles
```

## State Checks

```bash
agent-browser is visible @e1
agent-browser is enabled @e1
agent-browser is checked @e1
```

## Scrolling

```bash
agent-browser scroll down           # Scroll down (default amount)
agent-browser scroll down 500       # Scroll down 500px
agent-browser scroll up 200         # Scroll up 200px
agent-browser scrollintoview @e1    # Scroll element into view
```

## Waiting

```bash
agent-browser wait @e1              # Wait for element visible
agent-browser wait 2000             # Wait 2 seconds
agent-browser wait --text "Success" # Wait for text to appear
agent-browser wait --url "**/dashboard"  # Wait for URL pattern
agent-browser wait --load networkidle    # Wait for network idle
agent-browser wait --fn "document.querySelector('.done')"  # JS condition
```

## Screenshots & Snapshots

```bash
agent-browser snapshot              # Accessibility tree (compact, ~200-400 tokens)
agent-browser screenshot            # Screenshot to default path
agent-browser screenshot page.png   # Screenshot to specific file
agent-browser screenshot --full     # Full scrollable page
agent-browser screenshot --annotate # Annotated with numbered labels
agent-browser pdf output.pdf        # Save as PDF
```

## Diffing (unique to agent-browser)

```bash
agent-browser diff snapshot                          # Current vs last snapshot
agent-browser diff snapshot --baseline saved.txt     # Current vs saved file
agent-browser diff screenshot --baseline before.png  # Visual pixel diff
agent-browser diff url url1 url2                     # Compare two URLs
agent-browser diff url url1 url2 --screenshot        # Visual diff of two URLs
agent-browser diff url url1 url2 --selector "#main"  # Scope diff to element
```

## Network Mocking & Monitoring

```bash
agent-browser network route "*/api/*"                    # Intercept requests
agent-browser network route "*/api/*" --abort            # Block requests
agent-browser network route "*/api/data" --body '{"ok":true}'  # Mock response
agent-browser network unroute                            # Remove all routes
agent-browser network requests                           # View tracked requests
agent-browser network requests --filter api              # Filter requests
```

## Cookies & Storage

```bash
agent-browser cookies                    # Get all cookies
agent-browser cookies set name value     # Set cookie
agent-browser cookies clear              # Clear all cookies
agent-browser storage local              # Get all localStorage
agent-browser storage local key          # Get specific key
agent-browser storage local set k v      # Set localStorage value
agent-browser storage session            # sessionStorage (same API)
```

## Auth State Persistence

```bash
agent-browser state save auth.json       # Save cookies + storage
agent-browser state load auth.json       # Restore saved state
agent-browser state list                 # List saved states
agent-browser state show auth.json       # Show state summary
agent-browser state clean --older-than 7 # Delete states older than 7 days
```

## Tabs & Windows

```bash
agent-browser tab                # List open tabs
agent-browser tab new            # New blank tab
agent-browser tab new <url>      # New tab with URL
agent-browser tab 2              # Switch to tab 2
agent-browser tab close          # Close current tab
agent-browser tab close 2        # Close tab 2
agent-browser window new         # New browser window
```

## Frames

```bash
agent-browser frame "#iframe-id"  # Switch to iframe
agent-browser frame main          # Back to main frame
```

## Dialogs

```bash
agent-browser dialog accept           # Accept alert/confirm
agent-browser dialog accept "text"    # Accept prompt with text
agent-browser dialog dismiss          # Dismiss dialog
```

## Device Emulation & Settings

```bash
agent-browser set viewport 1280 720        # Set viewport size
agent-browser set device "iPhone 14"        # Emulate device
agent-browser set geo 59.33 18.07           # Set geolocation (Stockholm)
agent-browser set offline on               # Toggle offline mode
agent-browser set headers '{"X-Custom":"val"}'  # Extra HTTP headers
agent-browser set credentials user pass     # HTTP basic auth
agent-browser set media dark               # Emulate dark mode
```

## Debugging

```bash
agent-browser eval "document.title"        # Run JavaScript
agent-browser eval -b "btoa('hello')"      # Base64 output
agent-browser console                      # View console messages
agent-browser console --clear              # Clear console
agent-browser errors                       # View page errors
agent-browser highlight @e1                # Highlight element visually
agent-browser trace start                  # Start recording trace
agent-browser trace stop trace.zip         # Save trace
agent-browser profiler start              # Start DevTools profiling
agent-browser profiler stop profile.json  # Save profile
```

## Mouse Control

```bash
agent-browser mouse move 100 200          # Move cursor
agent-browser mouse down                  # Press left button
agent-browser mouse up                    # Release
agent-browser mouse wheel 100             # Scroll wheel
agent-browser drag @e1 @e2                # Drag and drop
agent-browser upload @e1 file.png         # Upload file
```

## Connect to Existing Browser

```bash
agent-browser connect 9222               # Connect via Chrome DevTools Protocol
```
