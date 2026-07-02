# Security Policy

Rocket Typing takes the security of its users seriously. If you believe you've
found a security vulnerability (data exposure, authentication bypass,
leaderboard/score manipulation, XSS, etc.), please report it privately rather
than opening a public issue.

## Reporting a Vulnerability

- Preferred: use GitHub's **Private Vulnerability Reporting** on this repo
  (Security tab → "Report a vulnerability").
- Alternative: email **[email protected]** with steps to reproduce.

Please include:
- A description of the issue and its impact
- Steps to reproduce (proof-of-concept if possible)
- Any relevant browser/console output

## What to expect

- Acknowledgement within 3 business days
- A fix or mitigation timeline once the issue is confirmed
- Credit in release notes if you'd like it (optional)

## Scope

In scope: the live site, its Firebase project (Auth, Firestore rules,
client-side score/anti-cheat logic).
Out of scope: third-party services we merely embed (fonts, analytics, CDNs).

## Supported Versions

Only the latest deployed version of the site is supported; there are no
older versions to patch since this is a continuously-deployed web app.
