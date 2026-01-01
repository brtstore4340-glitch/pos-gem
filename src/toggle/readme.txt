
After researching 50+ methods claiming to have an accessible solution, I realized it just isn't
out there yet. I wanted a lean distiction between light/dark mode via CSS, no pre-processors,
no bloat, and control over fallback logic to be as respectful to user intentions as possible.

Intro:
1.) History (Dark-mode is the next 'responsive'-like trend)
2.) Future of the web
3.) I built this with JavaScript logs

Requirements:
1.) Design a beautiful, minimal toggle switch with a buttery-smooth animation.
2.) Crystal-clear states and affordances. Clickable, subtle, dual-state toggle labels.
3.) On the first visit, respect the user's OS-level choice of dark/light mode (or auto).
4.) As a fallback, default to the brand's choice by adding or omitting the “dark” class on the body tag in the markup.
5.) While viewing the website and updating the OS-level preference, auto-update via a listener (no refresh required).
6.) Allow the user to manually override their OS-level preference by clicking or tapping the toggle switch.
     - At first, I had the favicon synchronized with both manual and OS-level changes. I changed that. See #8.
7.) Remember the user's most recent choice (via the toggle or OS), store that locally, and serve again next time.
     - If a user clears their browser's cache, the next visit will respect their OS-level preference like during the first visit.
     - If a user changes their OS-level preference without the web page currently open, that setting will not apply on their next visit.
8.) Keep the favicon synchronized with the OS-level setting at all times for optimal favicon contrast against the browser chrome.
