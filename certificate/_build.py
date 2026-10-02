"""Regenerates every HTML page in /certificate. Run: python3 _build.py"""
import pathlib
from string import Template

OUT = pathlib.Path(__file__).parent
BASE = "https://www.rockettyping.com"
TESTS = [
    ("10-seconds-typing-test", 10, "10 Seconds"), ("15-seconds-typing-test", 15, "15 Seconds"),
    ("30-seconds-typing-test", 30, "30 Seconds"), ("one-minute-typing-test", 60, "1 Minute"),
    ("two-minute-typing-test", 120, "2 Minutes"), ("three-minute-typing-test", 180, "3 Minutes"),
    ("four-minute-typing-test", 240, "4 Minutes"), ("five-minute-typing-test", 300, "5 Minutes"),
    ("ten-minute-typing-test", 600, "10 Minutes"), ("one-hour-typing-test", 3600, "1 Hour"),
]

HEAD = Template("""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>$title</title>
<meta name="description" content="$desc">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
<meta name="author" content="Rocket Typing">
<link rel="canonical" href="$url">
<meta property="og:type" content="website">
<meta property="og:title" content="$title">
<meta property="og:description" content="$desc">
<meta property="og:url" content="$url">
<meta property="og:image" content="https://www.rockettyping.com/images/og-banner.webp">
<meta property="og:site_name" content="Rocket Typing">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="$title">
<meta name="twitter:description" content="$desc">
<meta name="twitter:image" content="https://www.rockettyping.com/images/og-banner.webp">
<link rel="icon" type="image/webp" sizes="32x32" href="/images/favicon-32.webp">
<link rel="icon" type="image/webp" sizes="16x16" href="/images/favicon-16.webp">
<link rel="apple-touch-icon" href="/images/logo-192.webp">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#0a0a23">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Great+Vibes&family=Inter:wght@400;600;700&family=Playfair+Display:ital,wght@0,500;1,500&family=Roboto+Mono:wght@400;700&display=swap">
<link rel="stylesheet" href="/certificate/assets/cert.css?v=1">
<!-- Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-136SVFZRDF"></script>
<script>
    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    gtag('js', new Date());
    gtag('config', 'G-136SVFZRDF');
</script>
<!-- Mediavine -->
<script type="text/javascript" async="async" data-noptimize="1" data-cfasync="false" src="//scripts.scriptwrapper.com/tags/31b6b722-d3b7-49a8-acd3-2264f19c9dc5.js"></script>
<script type="application/ld+json">
{"@context":"https://schema.org","@graph":[
{"@type":"WebPage","name":"$h1","url":"$url","description":"$desc","isPartOf":{"@type":"WebSite","name":"Rocket Typing","url":"https://www.rockettyping.com/"}},
{"@type":"BreadcrumbList","itemListElement":[
{"@type":"ListItem","position":1,"name":"Home","item":"https://www.rockettyping.com/"},
{"@type":"ListItem","position":2,"name":"Typing Certificates","item":"https://www.rockettyping.com/certificate/"}$crumb2]}]}
</script>
</head>
""")

CHROME_TOP = """<body$attrs>
<header class="top">
<a class="brand" href="/"><img src="/images/rocket-typing-logo.webp" alt="Rocket Typing" width="36" height="36">ROCKET TYPING</a>
<nav aria-label="Main"><a href="/">Typing test</a><a href="/certificate/">Certificates</a><a href="/learn">Learn</a><a href="/leaderboard">Leaderboard</a></nav>
</header>
<main>
"""

FOOT = """</main>
<footer>
<a href="/about">About</a><a href="/privacy">Privacy Policy</a><a href="/terms">Terms of Service</a><a href="/contact">Contact</a>
<p>&copy; 2026 <strong>Rocket Typing</strong>. All rights reserved.</p>
</footer>
"""

METHOD = """<h2>How your score is calculated</h2>
<p class="fine">Every result follows the standard typing-test formulas, and the same numbers are printed on your certificate.</p>
<table class="dt">
<tr><td>Gross WPM</td><td><code>(characters typed &divide; 5) &divide; minutes</code></td></tr>
<tr><td>Net WPM</td><td><code>Gross WPM &minus; (incorrect words &divide; minutes)</code></td></tr>
<tr><td>Accuracy</td><td><code>(keystrokes &minus; incorrect keystrokes) &divide; keystrokes</code></td></tr>
</table>
<p class="fine">A character is any letter, number, punctuation mark or space you type; five characters count as one standard word. A word is incorrect if it does not match the passage exactly, including capital letters and punctuation. A mistake you correct with Backspace still counts against accuracy. Pasting is disabled, and the timer starts at your first keystroke and ends at exactly the test duration.</p>
<h2>Typing speed levels</h2>
<table class="dt">
<tr><td>Below 20 WPM</td><td>Novice</td></tr><tr><td>20&ndash;39 WPM</td><td>Beginner</td></tr>
<tr><td>40&ndash;59 WPM</td><td>Average</td></tr><tr><td>60&ndash;79 WPM</td><td>Fast</td></tr>
<tr><td>80&ndash;99 WPM</td><td>Professional</td></tr><tr><td>100+ WPM</td><td>Elite</td></tr>
</table>
"""

SCRIPTS = ('<script src="/certificate/assets/certificate.js?v=1"></script>\n'
           '<script src="/certificate/assets/typing-test.js?v=1"></script>\n</body>\n</html>\n')


def mmss(s):
    return "%d:%02d" % (s // 60, s % 60)


def tiles(current=None):
    return "\n".join(
        '<a class="tile%s" href="/certificate/%s.html"><b>%s</b><span>Typing test + certificate</span></a>'
        % (" on" if slug == current else "", slug, label)
        for slug, _, label in TESTS)


for slug, secs, label in TESTS:
    h1 = "%s Typing Test" % label
    desc = ("Take a free %s typing test and get an instant, printable typing certificate with your net WPM, "
            "accuracy and proficiency level. No sign-up required." % label.lower())
    url = "%s/certificate/%s" % (BASE, slug)
    page = HEAD.substitute(
        title="%s with Certificate | Free Online WPM Test - RocketTyping.com" % h1, desc=desc, url=url, h1=h1,
        crumb2=',\n{"@type":"ListItem","position":3,"name":"%s","item":"%s"}' % (h1, url))
    page += Template(CHROME_TOP).substitute(attrs=' data-secs="%d" data-label="%s" data-slug="%s"' % (secs, label, slug))
    page += """<p class="crumbs"><a href="/">Home</a> / <a href="/certificate/">Certificates</a> / %s</p>
<h1>%s<small>with downloadable certificate</small></h1>
<p class="lead">Type the passage below for %s. When time is up you get your net WPM, accuracy and a certificate you can download as PNG or PDF.</p>
<section class="card" id="test" aria-label="%s">
<div class="meta"><span>Duration: <b>%s</b></span><span>Passage: <b>English prose</b></span><span>Scoring: <b>Net WPM</b></span></div>
<div id="bar" aria-hidden="true"><i></i></div>
<div class="hud"><div>Time left<b id="time">%s</b></div><div>Words<b id="wc">0</b></div><div>Accuracy<b id="ac">100%%</b></div></div>
<div id="passage"><div id="track"></div></div>
<input id="typing" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="Type the passage here">
<p class="fine">The timer starts with your first keystroke. Press Space after each word.</p>
</section>
<section class="card" id="results" hidden aria-live="polite"></section>
%s
<h2>More typing tests with certificate</h2>
<div class="grid">
%s
</div>
""" % (h1, h1, label.lower(), h1, label, mmss(secs), METHOD, tiles(slug))
    page += FOOT + SCRIPTS
    (OUT / (slug + ".html")).write_text(page, encoding="utf-8")

# Hub page
desc = ("Free typing tests from 10 seconds to 1 hour, each ending with a printable typing certificate "
        "showing your net WPM, accuracy and level.")
hub = HEAD.substitute(title="Typing Test Certificate - Free Online Typing Certificates | RocketTyping.com",
                      desc=desc, url=BASE + "/certificate/", h1="Typing Certificates", crumb2="")
hub += Template(CHROME_TOP).substitute(attrs="")
hub += """<p class="crumbs"><a href="/">Home</a> / Certificates</p>
<h1>Typing test certificate<small>10 seconds to 1 hour</small></h1>
<p class="lead">Choose a test length, type the passage, and download a certificate with your net WPM, accuracy and proficiency level. Free, with no sign-up.</p>
<div class="grid">
%s
</div>
%s""" % (tiles(), METHOD)
hub += FOOT + "</body>\n</html>\n"
(OUT / "index.html").write_text(hub, encoding="utf-8")
print("built", len(TESTS) + 1, "pages")
