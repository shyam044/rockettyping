let config = {
            mode: 'time',
            time: 30,
            words: 50,
            difficulty: 'easy',
            quoteLength: 'medium',
            lineMode: 3
        };
        let currentLeaderboardDuration = 15;
        const savedConfig = JSON.parse(localStorage.getItem('typingTestConfig')) || {};
        config.mode = savedConfig.mode || config.mode;
        config.time = savedConfig.time || config.time;
        config.words = savedConfig.words || config.words;
        config.difficulty = savedConfig.difficulty || config.difficulty;
        config.quoteLength = savedConfig.quoteLength || config.quoteLength;
        config.lineMode = savedConfig.lineMode === 1 || savedConfig.lineMode === 2 || savedConfig.lineMode === 3
            ? savedConfig.lineMode : config.lineMode;
        document.querySelectorAll('.mode').forEach(b => b.classList.remove('active'));
        // Kick off the lazy quotes.js load: right away if this returning user's
        // saved mode is Quotes (so the real database is ready before the fallback
        // pool would otherwise be used), otherwise during browser idle time so it
        // costs nothing against initial load/interactivity but is warm by the
        // time anyone clicks the Quotes tab.
        if (config.mode === 'quotes') {
            loadQuotesDB();
        } else if ('requestIdleCallback' in window) {
            requestIdleCallback(function () { loadQuotesDB(); }, { timeout: 4000 });
        } else {
            setTimeout(function () { loadQuotesDB(); }, 2000);
        }
        // ==================== NEW DIFFICULTY BUTTONS ====================
        function initDifficultyButtons() {
            const diffButtons = document.querySelectorAll('.diff-btn');

            diffButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    // Remove active from all
                    diffButtons.forEach(b => b.classList.remove('active'));
                    // Activate clicked
                    btn.classList.add('active');

                    config.difficulty = btn.dataset.difficulty;
                    saveConfig();
                    resetTest();
                });
            });

            // Set initial active state from localStorage/config
            const activeBtn = Array.from(diffButtons).find(
                b => b.dataset.difficulty === config.difficulty
            );
            if (activeBtn) activeBtn.classList.add('active');
        }

        // ==================== QUOTE LENGTH BUTTONS (Short / Medium / Long) ====================
        function initQuoteLengthButtons() {
            const qlenButtons = document.querySelectorAll('.qlen-btn');

            qlenButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    qlenButtons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    config.quoteLength = btn.dataset.qlen;
                    saveConfig();
                    resetTest();
                });
            });

            // Set initial active state from localStorage/config (defaults to "medium")
            qlenButtons.forEach(b => b.classList.remove('active'));
            const activeQlenBtn = Array.from(qlenButtons).find(
                b => b.dataset.qlen === config.quoteLength
            ) || Array.from(qlenButtons).find(b => b.dataset.qlen === 'medium');
            if (activeQlenBtn) activeQlenBtn.classList.add('active');
        }

        // Call it once after resetTest()
        initDifficultyButtons();
        initQuoteLengthButtons();
        const activeModeBtn = document.querySelector(`.mode[data-mode="${config.mode}"]`);
        if (activeModeBtn) activeModeBtn.classList.add('active');
        toggleDifficultyVsQuoteLengthUI();
        function saveConfig() {
            localStorage.setItem('typingTestConfig', JSON.stringify(config));
        }
        let words = [];
        let currentWordIndex = 0;
        let currentLetterIndex = 0;
        let typedHistory = [];
        let startTime = null;
        let timerInterval = null;
        let testActive = false;
        let testEnded  = false;   // true once endTest() fires; cleared by resetTest() only
        let correctChars = 0;
        let rawChars = 0;
        let correctKeystrokes = 0;
        let totalKeystrokes = 0;
        let keystrokeTimestamps = [];
        let caret = document.createElement('div');
        let typedWords = [];
        let missedChars = 0;
        let earlySpaces = 0;   // spaces pressed before word was complete — NOT a separate "error char"
        let spaces = 0;
        let correctSpaces = 0;
        let correctTimestamps = [];   // timestamp of every correct letter keystroke
        let errorTimestamps = [];     // timestamp of every wrong letter keystroke

        // === PERFORMANCE FIXES (Issues 5 & 6) ===
        let cachedRows = [];
        let rowsCacheInvalid = true;
        // NOTE: caretUpdateRAF removed — replaced by persistent _caretDirty/loop system below
        // PERF: Cache active word DOM element and its letter spans — avoids querySelector on every keystroke
        let activeWordEl = null;
        let activeLetterSpansArr = [];
        // PERF: Cache the ordered list of .word DOM elements so moveToNextWord()
        // never has to call wordsDiv.querySelectorAll('.word') (a full DOM scan)
        // on every single space press. Kept in sync by renderWords() and by
        // extendWordsIfNeeded() whenever new word nodes are appended.
        let wordElsCache = [];

        caret.id = 'caret';
        caret.classList.add('blink');
        const wordsDiv = document.getElementById('words');
        // #words-track holds the actual word/letter spans + caret (see the CSS
        // restructure notes in styles.css). #words itself stays a plain fixed-size
        // clipping viewport; this element is what gets scrolled/transformed.
        const wordsTrack = document.getElementById('words-track') || wordsDiv;
        const input = document.getElementById('input');
        document.body.addEventListener('click', (e) => {
            if (!testActive
                && !e.target.closest('#difficulty-container')
                && !e.target.closest('#test-config')
                && !e.target.closest('#result')
                && !e.target.closest('#timer')
                && !e.target.closest('#rt-settings-panel')
                && !e.target.closest('#rt-settings-btn')
                && !e.target.closest('#rt-custom-panel')) {
                input.focus();
            }
        });
        window.addEventListener('focus', () => {
            if (!testActive && !window._rtCustomModeActive) input.focus();
        });
        const timerDiv = document.getElementById('timer');
        const resultDiv = document.getElementById('result');
        const restartBtn = document.getElementById('restart');
        document.querySelectorAll('.mode').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.mode').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                config.mode = btn.dataset.mode;
                saveConfig();
                /* Ensure the quotes database is loading the instant the user shows
                   intent to use Quotes mode — a no-op if it's already loaded/loading. */
                if (config.mode === 'quotes') loadQuotesDB();
                /* Hide attribution bar immediately when leaving quotes mode */
                if (config.mode !== 'quotes') setQuoteAuthor('');
                toggleDifficultyVsQuoteLengthUI();
                resetTest();
            });
        });

        /* Show the Short/Medium/Long selector in Quotes mode, and the
           Easy/Medium/Hard selector in Time/Words mode. */
        function toggleDifficultyVsQuoteLengthUI() {
            const diffGroup = document.getElementById('difficulty-group');
            const qlenGroup = document.getElementById('quote-length-group');
            if (!diffGroup || !qlenGroup) return;
            if (config.mode === 'quotes') {
                diffGroup.style.display = 'none';
                qlenGroup.style.display = 'flex';
            } else {
                diffGroup.style.display = 'flex';
                qlenGroup.style.display = 'none';
            }
        }
        input.addEventListener('keydown', handleKeydown);
        restartBtn.addEventListener('click', resetTest);

        // Tab + Enter (or Enter alone) from result page → go back to test (works even when input is blurred)
        document.addEventListener('keydown', function(e) {
            // Only act when the result screen is visible
            var resDiv = document.getElementById('result');
            if (!resDiv || resDiv.style.display === 'none' || !resDiv.classList.contains('visible')) return;

            // FIX 1: Block Space from scrolling the page while result is shown
            if (e.key === ' ') {
                e.preventDefault();
                return;
            }

            if (e.key === 'Tab') {
                e.preventDefault();
                window._resultTabHeld = true;
                var hint = document.getElementById('tab-redo-hint');
                if (hint) hint.style.display = 'block';
                clearTimeout(window._resultTabTimer);
                window._resultTabTimer = setTimeout(function() {
                    window._resultTabHeld = false;
                    var h = document.getElementById('tab-redo-hint');
                    if (h) h.style.display = 'none';
                }, 2000);
                return;
            }

            // FIX 2: Enter alone OR Tab+Enter both restart the test
            if (e.key === 'Enter') {
                e.preventDefault();
                window._resultTabHeld = false;
                clearTimeout(window._resultTabTimer);
                var hint2 = document.getElementById('tab-redo-hint');
                if (hint2) hint2.style.display = 'none';
                resetTest();
                return;
            }

            if (e.key !== 'Tab' && e.key !== 'Enter') {
                window._resultTabHeld = false;
            }
        });
        timerDiv.addEventListener('click', () => {
            if (testActive) return;
            if (config.mode === 'quotes') return;
            if (timerDiv.querySelector('input')) return;
            const inputField = document.createElement('input');
            timerDiv.textContent = '';
            timerDiv.appendChild(inputField);
            inputField.focus();
            inputField.style.background = 'none';
            inputField.style.color = '#e2b714';
            inputField.style.fontSize = '48px';
            inputField.style.fontWeight = 'bold';
            inputField.style.border = 'none';
            inputField.style.outline = 'none';
            inputField.style.textAlign = 'center';
            inputField.style.width = '100%';
            inputField.style.padding = '0';
            inputField.style.letterSpacing = '2px';
            if (config.mode === 'time') {
                inputField.type = 'text';
            } else {
                inputField.type = 'number';
                inputField.min = 1;
            }
            function finalize() {
                let num;
                if (config.mode === 'time') {
                    num = parseTime(inputField.value);
                } else {
                    num = parseInt(inputField.value);
                }
                if (!isNaN(num) && num > 0) {
                    if (config.mode === 'time') {
                        config.time = num;
                    } else if (config.mode === 'words') {
                        config.words = num;
                    }
                    saveConfig();
                }
                resetTest();
            }

            inputField.addEventListener('blur', finalize);
            inputField.addEventListener('keydown', e => {
                if (e.key === 'Enter') finalize();
            });
        });
        function formatTime(secs) {
            if (secs <= 0) return '0:00';

            const days = Math.floor(secs / 86400);
            secs %= 86400;
            const hours = Math.floor(secs / 3600);
            secs %= 3600;
            const minutes = Math.floor(secs / 60);
            const seconds = secs % 60;

            const parts = [];
            if (days > 0) {
                parts.push(days);
                parts.push(hours.toString().padStart(2, '0'));
                parts.push(minutes.toString().padStart(2, '0'));
                parts.push(seconds.toString().padStart(2, '0'));
            } else if (hours > 0) {
                parts.push(hours);
                parts.push(minutes.toString().padStart(2, '0'));
                parts.push(seconds.toString().padStart(2, '0'));
            } else {
                parts.push(minutes);
                parts.push(seconds.toString().padStart(2, '0'));
            }
            return parts.join(':');
        }

        function parseTime(str) {
            const parts = str.split(':').map(p => parseInt(p, 10));
            if (parts.some(isNaN)) return NaN;

            let total = 0;
            const multipliers = [1, 60, 3600, 86400];
            for (let i = parts.length - 1, j = 0; i >= 0; i--, j++) {
                if (j >= multipliers.length) return NaN;
                total += parts[i] * multipliers[j];
            }
            return total;
        }
        // vocabulary + templates (categorized: nouns/verbs/adjectives/etc.)
        // are already loaded from vocabulary.js above, before this script.
        /**
         * getQuotesPool() — sourced from quotes.js (QUOTES_DB), filtered by the
         * currently selected quote length (short / medium / long). Falls back to
         * QUOTES_ALL, then to a minimal built-in set, if quotes.js didn't load.
         */
        const FALLBACK_QUOTES_POOL = [
            { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
            { text: "In the middle of every difficulty lies opportunity.", author: "Albert Einstein" },
            { text: "The journey of a thousand miles begins with one step.", author: "Lao Tzu" }
        ];
        function getQuotesPool() {
            const len = config.quoteLength || 'medium';
            if (typeof QUOTES_DB !== 'undefined' && QUOTES_DB[len] && QUOTES_DB[len].length > 0) {
                return QUOTES_DB[len];
            }
            if (typeof QUOTES_ALL !== 'undefined' && QUOTES_ALL.length > 0) {
                return QUOTES_ALL;
            }
            return FALLBACK_QUOTES_POOL;
        }

        /* Track the active quote's author so we can display it */
        let activeQuoteAuthor = '';

        /* Helper: show or hide the author attribution bar */
        function setQuoteAuthor(author) {
            const metaEl = document.getElementById('quote-meta');
            const labelEl = document.getElementById('quote-author-label');
            if (!metaEl || !labelEl) return;
            if (author) {
                labelEl.textContent = '— ' + author;
                metaEl.style.display = 'block';
            } else {
                metaEl.style.display = 'none';
                labelEl.textContent = '';
            }
        }

        function randomItem(arr) {
            return arr[Math.floor(Math.random() * arr.length)];
        }

        // PERF: Build weighted index pool ONCE at startup — compact indices instead of duplicating word strings.
        // Old approach stored thousands of duplicate string copies; this stores only integer indices.
        function _buildWeightedPool(list) {
            const weights = { 1: 10, 2: 25, 3: 30, 4: 20, 5: 10, 6: 4, 7: 1, 8: 0.5 };
            const pool = [];
            for (let idx = 0; idx < list.length; idx++) {
                const w = Math.max(1, Math.round((weights[list[idx].length] || 0.3) * 10));
                for (let i = 0; i < w; i++) pool.push(idx);
            }
            return pool;
        }
        const _pools = {
            nouns:      _buildWeightedPool(vocabulary.nouns),
            verbs:      _buildWeightedPool(vocabulary.verbs),
            adjectives: _buildWeightedPool(vocabulary.adjectives),
            adverbs:    _buildWeightedPool(vocabulary.adverbs),
        };
        function weightedWord(pool, list) {
            return list[pool[Math.floor(Math.random() * pool.length)]];
        }
        function generateSentence() {
            const diff = config.difficulty;
            const currentTemplates = templates[diff] || templates.medium;
            let sentence = randomItem(currentTemplates)
                .replace("{article}",     randomItem(vocabulary.articles))
                .replace("{noun}",        weightedWord(_pools.nouns,      vocabulary.nouns))
                .replace("{verb}",        weightedWord(_pools.verbs,      vocabulary.verbs))
                .replace("{adjective}",   weightedWord(_pools.adjectives, vocabulary.adjectives))
                .replace("{adverb}",      weightedWord(_pools.adverbs,    vocabulary.adverbs))
                .replace("{preposition}", randomItem(vocabulary.prepositions))
                .replace("{article}",     randomItem(vocabulary.articles))
                .replace("{adjective}",   weightedWord(_pools.adjectives, vocabulary.adjectives))
                .replace("{noun}",        weightedWord(_pools.nouns,      vocabulary.nouns))
                .replace("{year}",        randomItem(vocabulary.years))
                .replace("{age}",         randomItem(vocabulary.ages))
                .replace("{month}",       randomItem(vocabulary.months))
                .replace("{day}",         randomItem(vocabulary.days));

            sentence = diff === 'easy'
                ? sentence.toLowerCase()
                : sentence.charAt(0).toUpperCase() + sentence.slice(1);

            if (diff !== 'easy' && sentence.endsWith('.') && Math.random() < 0.3) {
                sentence = sentence.slice(0, -1) + '?';
            }
            return sentence;
        }

        function generateWords() {
            words = [];

            if (config.mode === 'quotes') {
                const quoteObj = randomItem(getQuotesPool());
                /* Support both object form { text, author } and legacy plain strings */
                const quoteText = (typeof quoteObj === 'object' && quoteObj.text) ? quoteObj.text : String(quoteObj);
                activeQuoteAuthor = (typeof quoteObj === 'object' && quoteObj.author) ? quoteObj.author : '';
                words = quoteText.split(' ');
                setQuoteAuthor(activeQuoteAuthor);
                return;
            }

            if (config.mode === "words") {
                // Generate only an initial batch; more words are added lazily as the user types
                // (same strategy as time mode). This prevents browser hang on huge word counts.
                const initialBatch = Math.min(config.words, 100);
                while (words.length < initialBatch) {
                    const chunk = generateSentence().split(" ");
                    for (let i = 0; i < chunk.length && words.length < initialBatch; i++) {
                        words.push(chunk[i]);
                    }
                }
            }
            else {
                // time mode: start with only 80 words so initial renderWords() is fast.
                // extendWordsIfNeeded() will silently add more as the user types.
                while (words.length < 80) {
                    const chunk = generateSentence().split(" ");
                    for (let i = 0; i < chunk.length; i++) words.push(chunk[i]);
                }
            }
        }

        function renderWords() {
            // PERF: Use DocumentFragment — single DOM insertion instead of N insertions
            const frag = document.createDocumentFragment();
            wordsTrack.innerHTML = '';
            activeWordEl = null;
            activeLetterSpansArr = [];
            wordElsCache = new Array(words.length);
            words.forEach((word, i) => {
                const wordSpan = document.createElement('div');
                wordSpan.classList.add('word');
                if (i === currentWordIndex) {
                    wordSpan.classList.add('active');
                    activeWordEl = wordSpan;
                }
                word.split('').forEach((letter) => {
                    const letterSpan = document.createElement('span');
                    letterSpan.classList.add('letter');
                    letterSpan.textContent = letter;
                    wordSpan.appendChild(letterSpan);
                });
                frag.appendChild(wordSpan);
                wordElsCache[i] = wordSpan;
            });
            wordsTrack.appendChild(frag);
            // Cache letter spans for the active word right away — use children (faster than querySelectorAll)
            if (activeWordEl) {
                activeLetterSpansArr = Array.from(activeWordEl.children);
            }
            scheduleCaretUpdate();
            rowsCacheInvalid = true;   // ← invalidate cache after full render
        }

        // ==================== PERFORMANCE FIXES ====================

        // Rebuild row cache only when DOM actually changes.
        // PERF FIX: build a Set for O(1) duplicate detection instead of .some() O(n) scan.
        // Also expose a rowTopToIndex Map so findIndex calls elsewhere become O(1).
        let cachedRowsSet = new Set();
        let rowTopToIndex = new Map();

        function rebuildRowsCache() {
            if (!rowsCacheInvalid) return;

            cachedRows = [];
            cachedRowsSet.clear();
            rowTopToIndex.clear();

            // PERF FIX: Only scan the first 60 children instead of all 80-300.
            // Row positions stabilise after a few rows — scanning ALL words forces
            // offsetTop reads on every element, triggering a full layout reflow
            // that stalls keystrokes for the first 3-4 words in time mode.
            const children = wordsTrack.children;
            const scanLimit = Math.min(children.length, 60);
            for (let i = 0; i < scanLimit; i++) {
                const top = children[i].offsetTop;
                const snapped = Math.round(top / 5) * 5;
                if (!cachedRowsSet.has(snapped)) {
                    cachedRowsSet.add(snapped);
                    cachedRows.push(snapped);
                }
            }
            cachedRows.sort((a, b) => a - b);
            cachedRows.forEach((r, idx) => rowTopToIndex.set(r, idx));
            rowsCacheInvalid = false;
        }

        // Single row height in px, derived from real measured rows when available,
        // falling back to the computed line-height (always accurate regardless of
        // breakpoint or wrap state) when there's only one row to look at — which
        // is always true in single-line "tape" mode, where the offsetTop-diff
        // technique above has nothing to diff against.
        function getRowHeight() {
            rebuildRowsCache();
            if (cachedRows.length >= 2) return cachedRows[1] - cachedRows[0];
            const lh = parseFloat(getComputedStyle(wordsTrack).lineHeight);
            if (!isNaN(lh) && lh > 0) return lh;
            return 60; // safe fallback: 36px font × 1.5 line-height
        }

        // === Smooth scroll/tape animator ==================================
        // A tiny reusable rAF tween. This deliberately mirrors what MonkeyType's
        // ACTUAL tape-mode implementation does (confirmed from their real source,
        // frontend/src/ts/test/test-ui.ts, function scrollTape()): on every
        // keystroke they call jQuery's `.stop(true, false).animate({marginLeft: ...},
        // 125)` — i.e. stop the in-flight animation exactly where it visually is
        // (not jump to its end), then tween from THAT point to the new target over
        // 125ms with 'swing' easing (mathematically ease-in-out-sine). We do the
        // exact same thing here with a plain rAF loop instead of jQuery, driving a
        // CSS `transform` instead of their `margin-left` (transform is
        // GPU-composited and never triggers layout; margin-left does — this is a
        // known perf quirk of their actual implementation that we don't need to
        // copy). A prior version of this code used a passive CSS `transition` and
        // just set the target value directly — that is NOT what MonkeyType does,
        // and evidently didn't feel the same; this version restores the
        // JS-driven stop-and-retarget tween, which is the verified real technique.
        function _easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
        function _easeInOutSine(t) { return -(Math.cos(Math.PI * t) - 1) / 2; }
        function _makeTween() { return { current: 0, from: 0, to: 0, start: 0, duration: 0, raf: null }; }
        function _tween(state, to, duration, apply, easeFn) {
            easeFn = easeFn || _easeOutCubic;
            const from = state.current;
            if (Math.abs(to - from) < 0.5) {
                state.current = to;
                state.from = to;
                state.to = to;
                apply(to);
                if (state.raf) { cancelAnimationFrame(state.raf); state.raf = null; }
                return;
            }
            state.from = from;
            state.to = to;
            state.start = performance.now();
            state.duration = duration;
            if (state.raf) return; // loop already running — it reads the updated from/to/start next frame
            function step(t) {
                const elapsed = t - state.start;
                const p = Math.min(1, state.duration > 0 ? elapsed / state.duration : 1);
                const eased = easeFn(p);
                state.current = state.from + (state.to - state.from) * eased;
                apply(state.current);
                if (p < 1 && Math.abs(state.to - state.current) >= 0.5) {
                    state.raf = requestAnimationFrame(step);
                } else {
                    state.current = state.to;
                    apply(state.current);
                    state.raf = null;
                }
            }
            state.raf = requestAnimationFrame(step);
        }
        const _vScrollTween = _makeTween();  // drives #words.scrollTop (modes 2/3)
        const _tapeTween = _makeTween();     // drives #words-track translateX (mode 1)

        // === Line-display mode: 1 (single "tape" line), 2, or 3 (default) ===
        // Mode 1 lays words out on a single non-wrapping row on #words-track and
        // horizontally transforms that track so the active word stays centered —
        // MonkeyType's "tape mode". Modes 2/3 keep the existing wrapped
        // multi-line layout, just with a shorter viewport and an earlier
        // scroll-up trigger for mode 2.
        // Shared horizontal anchor (px) for tape mode — the fixed point where the
        // active word/caret should sit. Set by applyLineMode() and read by
        // _updateCaretNow() so the visual start position (track's padding-left)
        // and the running transform math always agree exactly.
        let _tapeAnchorX = 0;

        function applyLineMode(mode) {
            mode = (mode === 1 || mode === 2) ? mode : 3;
            config.lineMode = mode;
            saveConfig();
            const el = wordsDiv;
            if (!el) return;
            el.classList.remove('line-mode-1', 'line-mode-2', 'line-mode-3');
            el.classList.add('line-mode-' + mode);
            el.scrollTop = 0;
            _vScrollTween.current = 0;
            wordsTrack.classList.toggle('tape-track', mode === 1);
            rowsCacheInvalid = true;
            const rowH = getRowHeight();
            if (mode === 1) {
                el.style.height = rowH + 'px';
                // Pre-position the text so word 1 / letter 1 starts AT the center
                // anchor from the very first keystroke (MonkeyType tape behavior) —
                // without this, text starts flush at the left edge and only the
                // caret would appear to move until typing reaches the anchor point.
                // This is applied to #words-track's padding, not #words itself, so
                // it can never affect #words' own box size/overflow — the track is
                // free to grow as wide as it needs since #words just clips it.
                const viewportW = el.clientWidth || (el.parentElement ? el.parentElement.clientWidth : 800) || 800;
                _tapeAnchorX = Math.round(viewportW * 0.5);
                wordsTrack.style.paddingLeft = _tapeAnchorX + 'px';
                wordsTrack.style.transform = 'translateX(0px)';
                _tapeTween.current = 0;
                _tapeTween.from = 0;
                _tapeTween.to = 0;
                if (_tapeTween.raf) { cancelAnimationFrame(_tapeTween.raf); _tapeTween.raf = null; }
            } else if (mode === 2) {
                el.style.height = (rowH * 2) + 'px';
                wordsTrack.style.paddingLeft = '';
                wordsTrack.style.transform = '';
                if (_tapeTween.raf) { cancelAnimationFrame(_tapeTween.raf); _tapeTween.raf = null; }
            } else {
                el.style.height = '';
                wordsTrack.style.paddingLeft = '';
                wordsTrack.style.transform = '';
                if (_tapeTween.raf) { cancelAnimationFrame(_tapeTween.raf); _tapeTween.raf = null; }
            }
            scheduleCaretUpdate();
        }

        // === Tape-mode retarget (MonkeyType's actual scrollTape() technique) ===
        // Called once per keystroke (from _updateCaretNow, which passes in the
        // wordLeft/targetLeft/targetWidth it already read for its own caret
        // positioning — this function used to re-read those same offsetLeft/
        // offsetWidth properties itself, forcing a second synchronous layout
        // pass for no reason). Computes where the current letter needs to be,
        // then hands it to the shared _tween() helper — the SAME stop-and-
        // retarget tween used for vertical line-scroll — with a 125ms duration
        // and ease-in-out-sine easing. Because _tween() always starts the new
        // leg from state.current (wherever the track visually is right this
        // instant, mid-flight or not), this is an exact match for jQuery's
        // `.stop(true, false).animate({marginLeft: ...}, 125)` that MonkeyType
        // itself calls on every keystroke — verified against their real
        // source (frontend/src/ts/test/test-ui.ts, scrollTape()). jQuery's
        // default 'swing' easing is mathematically ease-in-out-sine, so this
        // reproduces both the timing and the curve exactly, not just the
        // general idea of "smoothing" — which is what the previous continuous
        // per-frame version missed despite being smooth in its own right.
        function _updateTapeTarget(wordLeft, tLeft, tW) {
            if (config.lineMode !== 1) return;
            const targetX = Math.max(0, (wordLeft + tLeft + tW) - _tapeAnchorX);
            _tween(_tapeTween, targetX, 125, function (v) {
                wordsTrack.style.transform = 'translateX(-' + v + 'px)';
            }, _easeInOutSine);
        }



        // === ZERO-LAG CARET ENGINE ===
        // Problem: old code did cancelAnimationFrame()+requestAnimationFrame() on every keystroke.
        // At 80+ WPM that's a keystroke every ~120 ms but vsync is ~16 ms, so the caret always
        // painted 1-2 frames behind. Worse: cancelAnimationFrame() on a pending RAF means the
        // caret update from the PREVIOUS keystroke was thrown away and only the last one was ever
        // painted — giving the illusion that the cursor "jumps" to the current position.
        //
        // Fix: use a dirty flag + a single persistent RAF loop that runs at 60 fps regardless.
        // The loop only does work when _caretDirty is true, so it is essentially free when idle.

        let _caretDirty = false;
        let _caretRAFRunning = false;

        function _caretLoop() {
            if (_caretDirty) {
                _caretDirty = false;
                _updateCaretNow();
            }
            _caretRAFRunning = _caretDirty; // keep loop alive only if more work pending
            if (_caretRAFRunning) requestAnimationFrame(_caretLoop);
        }

        // Schedule caret update — called on every keystroke.
        // Sets the dirty flag and starts the RAF loop if not already running.
        function scheduleCaretUpdate() {
            _caretDirty = true;
            if (!_caretRAFRunning) {
                _caretRAFRunning = true;
                requestAnimationFrame(_caretLoop);
            }
        }

        // Improved updateCaret with cached rows (Issues 5 + 6)
        function updateCaret() {
            scheduleCaretUpdate(); // keep old call-sites working
        }

        function _updateCaretNow() {
            const activeWord = activeWordEl;
            if (!activeWord) return;

            const letters = activeLetterSpansArr;
            const wordLength = words[currentWordIndex] ? words[currentWordIndex].length : 0;

            let target;
            let after = false;

            if (currentLetterIndex < wordLength) {
                target = letters[currentLetterIndex];
            } else {
                target = letters[letters.length - 1];
                after = true;
            }

            if (!target) return;

            // === Batched layout reads — touch offsetTop/offsetLeft only once per frame ===
            // Skip this in tape mode: it exists purely to support the row-scroll
            // geometry used by the 2/3-line modes below (cachedRows/rowTopToIndex),
            // which tape mode's branch never reads. Running it anyway forced an
            // extra synchronous layout reflow (offsetTop on up to 60 elements) on
            // every keystroke — worst of all on space, since moveToNextWord() marks
            // the cache invalid on every word completion, so the reflow landed at
            // the exact moment the space-triggered tween was starting, causing that
            // specific movement to visibly hitch compared to mid-word letters.
            if (config.lineMode !== 1) rebuildRowsCache();

            const wordLeft   = activeWord.offsetLeft;
            const wordTop    = activeWord.offsetTop;
            const targetLeft = target.offsetLeft;
            const targetTop  = target.offsetTop;
            const targetW    = after ? target.offsetWidth : 0;
            const targetH    = target.offsetHeight;

            const x = wordLeft + targetLeft + targetW;
            const y = wordTop  + targetTop;

            // In single-line "tape" mode, MonkeyType keeps the caret perfectly
            // still — only the text glides underneath it. The track's transform
            // (set below) is what brings the correct letter to this fixed anchor
            // point; the caret itself never needs to move at all. Using the raw
            // per-letter `x` here (like modes 2/3 do) was the actual bug — that
            // gave the caret its own independent motion on top of the track's
            // motion, and the two aren't perfectly synced, which is what read as
            // "the cursor is also moving" instead of only the words.
            const caretX = (config.lineMode === 1) ? _tapeAnchorX : x;

            // ── Geometry-based scrolling ───────────────────────────────────────────
            // The old approach looked up the active word's row index in cachedRows[].
            // cachedRows is populated by scanning only the FIRST 60 word-spans, so any
            // word beyond index ~60 had no cached row → currentRowIdx = -1 → scroll
            // condition never fired → words past line 3 were never visible.
            //
            // New approach: use raw offsetTop geometry. No row cache needed for scrolling.
            // Works correctly for 10 words or 10,000,000 words.
            let rowH = 60; // safe fallback: 36px × 1.5 line-height + 6px flex gap
            if (cachedRows.length >= 2) rowH = cachedRows[1] - cachedRows[0];

            if (config.lineMode === 1) {
                // ── Single-line "tape" mode: retarget the stop-and-retarget
                // tween exactly the way MonkeyType's own scrollTape() does —
                // once per keystroke, from wherever the track visually is
                // right now. See _updateTapeTarget() above.
                _updateTapeTarget(wordLeft, targetLeft, targetW);
            } else {
                // BUG FIX: this used to compare against wordsDiv.clientHeight (the #words
                // box's CSS height). Because that height doesn't divide evenly into whole
                // rows at every breakpoint, the box was effectively showing ~2.9-3.1 rows
                // instead of exactly 3 — which pushed the scroll trigger to fire after the
                // 3RD row instead of the 2nd, unlike MonkeyType.
                //
                // FIX: work in row counts instead of pixels. visibleRowIdx is which visible
                // row (0 = top row currently on screen) the active word sits on. MonkeyType
                // scrolls up by one row the moment the active word reaches the LAST visible
                // row — i.e. right after the 2nd-to-last row is finished. In 2-line mode
                // that's row idx 1; in 3-line mode (default) that's row idx 2.
                const currentScrollTop = wordsDiv.scrollTop;
                const scrollTrigger = (config.lineMode === 2) ? 1 : 2;
                const visibleRowIdx = Math.round((wordTop - currentScrollTop) / rowH);
                if (visibleRowIdx >= scrollTrigger) {
                    const targetTop = Math.max(0, wordTop - rowH);
                    _vScrollTween.current = currentScrollTop;
                    _tween(_vScrollTween, targetTop, 125, function (v) {
                        wordsDiv.scrollTop = v;
                    }, _easeInOutSine);
                }
            }

            caret.style.height    = `${targetH}px`;
            caret.style.transform = `translate3d(${caretX}px, ${y}px, 0)`;

            // Caret lives directly under #words (never under #words-track), so
            // single-line tape mode's track transform can never affect its
            // on-screen position — only the words move, exactly like MonkeyType.
            if (!wordsDiv.contains(caret) || wordsTrack.contains(caret)) {
                wordsDiv.appendChild(caret);
            }
        }

        function handleKeydown(e) {
// Defense in depth: the real input is also disabled while the Custom
// layout panel is open (see showCustomPanel), but this guarantees a test
// can never start from a stray keystroke while arranging the layout.
if (window._rtCustomModeActive) return;

// ── Block modifier combos (Alt+*, Ctrl+*, Meta+*) — never type these ──
if (e.altKey || e.ctrlKey || e.metaKey) return;

// ── Tab → show "tab + enter to restart" hint (MonkeyType-style) ──
if (e.key === 'Tab') {
    e.preventDefault();
    var hint = document.getElementById('tab-redo-hint');
    if (hint) {
        hint.style.display = 'block';
        // Auto-hide after 2 s if user doesn't press Enter
        clearTimeout(window._tabHintTimer);
        window._tabHintTimer = setTimeout(function() {
            hint.style.display = 'none';
            window._tabHeld = false;
        }, 2000);
    }
    window._tabHeld = true;
    return;
}

// ── Enter while Tab was recently held → restart ──
if (e.key === 'Enter' && window._tabHeld) {
    e.preventDefault();
    var hint2 = document.getElementById('tab-redo-hint');
    if (hint2) hint2.style.display = 'none';
    clearTimeout(window._tabHintTimer);
    window._tabHeld = false;
    resetTest();
    return;
}

// Any other key cancels the tab-held state
if (e.key !== 'Tab') {
    window._tabHeld = false;
    var hint3 = document.getElementById('tab-redo-hint');
    if (hint3 && e.key !== 'Enter') hint3.style.display = 'none';
}

// Only start the test on printable single-character keys (a-z, 0-9, punctuation, space).
// This intentionally excludes F1-F12, Escape, Tab, Arrow keys, Shift, Ctrl, etc.
// e.key.length === 1 is true for every typeable character and false for all named keys.
if (!testActive && !testEnded && e.key.length === 1) {
    testActive = true;
    startTimer();
    caret.classList.remove('blink');

    // PERF FIX: Defer all DOM hide/class operations to a macrotask so they
    // do NOT block processing of the very first keypress. The first key now
    // registers instantly; the UI hides on the next event-loop tick (~0 ms
    // visual delay) without causing a synchronous layout flush on key-1.
    setTimeout(function() {
        document.body.classList.add('typing-active'); // pause bg animations while typing

        // === HIDE DISTRACTIONS WHILE TYPING ===
        document.body.classList.add('test-running');

        // Hide keymap toggle button during typing
        var kmToggleRow = document.getElementById('km-toggle-row');
        if (kmToggleRow) kmToggleRow.classList.add('km-toggle-hidden');

        // Hide Musk & Elon score badges during typing
        var kmScoresPanel = document.getElementById('km-scores-panel');
        if (kmScoresPanel) kmScoresPanel.classList.add('km-scores-hidden');

        // Keep timer visible
        document.getElementById("test-config").style.display = "none";
        document.getElementById("difficulty-container").style.display = "none";
        document.getElementById("leaderboard-btn").style.display = "none";
        document.getElementById("play-game").style.display = "none";

        // Strip the timer's background pill while typing — only the bare
        // number should show. The pill comes back automatically next time
        // resetTest() runs (new test / idle state), which already re-adds
        // 'highlight' for the pre-typing display.
        timerDiv.classList.remove('highlight');

        // Switch words/quotes counter to MonkeyType's "current/total" format
        // (e.g. 1/5) right as typing starts. Before typing, it shows just the
        // plain total (e.g. 5) — set by resetTest().
        if (config.mode === 'words') {
            timerDiv.textContent = (currentWordIndex + 1) + '/' + config.words;
        } else if (config.mode === 'quotes') {
            timerDiv.textContent = (currentWordIndex + 1) + '/' + words.length;
        }
    }, 0);
}
            if (!testActive) return;

            const key = e.key;
            const now = Date.now();

            if (key === 'Backspace') {
                handleBackspace();
                e.preventDefault();
                return;
            }

            // Only count printable single-char keys and space — ignore Shift, Enter, arrows, etc.
            if (key.length !== 1 && key !== ' ') return;

            totalKeystrokes++;
            keystrokeTimestamps.push(now);

            if (key === ' ') {
                const wordLen = words[currentWordIndex].length;
                const isCorrectSpace = (currentLetterIndex >= wordLen);   // ← changed to >=

                if (isCorrectSpace) {
                    correctKeystrokes++;
                    correctSpaces++;
                    correctTimestamps.push(now);   // ← FIX: spaces count toward WPM line
                } else {
                    earlySpaces++;                             // track for accurate accuracy formula
                    missedChars += wordLen - currentLetterIndex;   // always positive now
                    // PERF: use cached letter spans
                    for (let i = currentLetterIndex; i < activeLetterSpansArr.length; i++) {
                        activeLetterSpansArr[i].classList.add('incorrect');
                    }
                }

                moveToNextWord();
                e.preventDefault();
                return;
            }

            if (key.length === 1) {
                typeLetter(key);
                e.preventDefault();
            }
        }
        function typeLetter(key) {
            const word = words[currentWordIndex];
            let wordObj = typedWords[currentWordIndex];
            if (!wordObj) {
                typedWords[currentWordIndex] = { letters: [], correct: [], extra: [] };
                wordObj = typedWords[currentWordIndex];
            }
            if (currentLetterIndex < word.length) {
                wordObj.letters[currentLetterIndex] = key;
                if (key === word[currentLetterIndex]) {
                    wordObj.correct[currentLetterIndex] = true;
                    correctKeystrokes++;
                    correctChars++;
                    correctTimestamps.push(Date.now());
                } else {
                    wordObj.correct[currentLetterIndex] = false;
                    errorTimestamps.push(Date.now());
                }
                // PERF: use cached letter spans array — no DOM query per keystroke
                const span = activeLetterSpansArr[currentLetterIndex];
                if (span) {
                    span.classList.toggle('correct', key === word[currentLetterIndex]);
                    span.classList.toggle('incorrect', key !== word[currentLetterIndex]);
                }
                currentLetterIndex++;
                if (config.mode === "words" &&
                    currentWordIndex === config.words - 1 &&
                    currentLetterIndex === words[currentWordIndex].length) {
                    endTest();
                }
                if (config.mode === "quotes" &&
                    currentWordIndex === words.length - 1 &&
                    currentLetterIndex === words[currentWordIndex].length) {
                    endTest();
                }
            } else {
                wordObj.extra.push(key);
                // PERF: use cached activeWordEl
                const extraSpan = document.createElement('span');
                extraSpan.classList.add('letter', 'extra');
                extraSpan.textContent = key;
                activeWordEl.appendChild(extraSpan);
                // Keep letter spans cache in sync
                activeLetterSpansArr.push(extraSpan);
                currentLetterIndex++;
            }
            scheduleCaretUpdate();
        }
        function handleBackspace() {
            if (currentLetterIndex === 0) {
                return;
            }
            if (currentLetterIndex > 0) {
                const wordObj = typedWords[currentWordIndex];
                // PERF: use cached references — no DOM query
                const lettersSpans = activeLetterSpansArr;
                const lastIndex = currentLetterIndex - 1;
                totalKeystrokes = Math.max(0, totalKeystrokes - 1);
                rawChars = Math.max(0, rawChars - 1);
                if (wordObj.extra.length > 0 && lastIndex >= words[currentWordIndex].length) {
                    wordObj.extra.pop();
                    if (lettersSpans[lastIndex]) lettersSpans[lastIndex].remove();
                    activeLetterSpansArr.splice(lastIndex, 1); // sync cache
                } else if (wordObj.correct[lastIndex]) {
                    correctKeystrokes = Math.max(0, correctKeystrokes - 1);
                    correctChars = Math.max(0, correctChars - 1);
                }
                if (lettersSpans[lastIndex]) {
                    lettersSpans[lastIndex].classList.remove('correct', 'incorrect');
                }
                wordObj.letters[lastIndex] = undefined;
                wordObj.correct[lastIndex] = undefined;

                currentLetterIndex--;
                scheduleCaretUpdate();
            }
        }
        function checkWordComplete() {
            if (currentLetterIndex === words[currentWordIndex].length) {
                // Word complete, wait for space
            }
            if (config.mode === 'words' && currentWordIndex === config.words - 1 && currentLetterIndex === words[currentWordIndex].length) {
                timerDiv.textContent = config.words + '/' + config.words;
                endTest();
            }
            if (config.mode === 'quotes' && currentWordIndex === words.length - 1 && currentLetterIndex === words[currentWordIndex].length) {
                timerDiv.textContent = words.length + '/' + words.length;
                endTest();
            }
        }
        function moveToNextWord() {
            spaces++;
            if (currentWordIndex < words.length - 1) {
                // PERF: update cached active word reference
                if (activeWordEl) activeWordEl.classList.remove('active');
                currentWordIndex++;
                // PERF: use the cached word-element array instead of re-scanning the DOM
                // with querySelectorAll('.word') on every space press (this was an O(n)
                // full-subtree query, once per word, wasted work at high WPM / long tests).
                // Falls back to a live query only if the cache somehow got out of sync.
                activeWordEl = wordElsCache[currentWordIndex]
                    || wordsTrack.querySelectorAll('.word')[currentWordIndex]
                    || null;
                if (activeWordEl) {
                    activeWordEl.classList.add('active');
                    activeLetterSpansArr = Array.from(activeWordEl.children);
                }

                if (config.mode === 'words') {
                    timerDiv.textContent = (currentWordIndex + 1) + '/' + config.words;
                } else if (config.mode === 'quotes') {
                    timerDiv.textContent = (currentWordIndex + 1) + '/' + words.length;
                }
                currentLetterIndex = 0;
                extendWordsIfNeeded();
                scheduleCaretUpdate();
                rowsCacheInvalid = true;
            } else {
                if (config.mode === 'words' || config.mode === 'quotes') {
                    endTest();
                }
            }
        }
        function extendWordsIfNeeded() {
            if (config.mode !== 'time' && config.mode !== 'words') return;
            // For words mode: stop extending once we have reached the total target count
            if (config.mode === 'words' && words.length >= config.words) return;
            // Trigger with a 50-word buffer so we never reach the end of available words
            if (currentWordIndex > words.length - 50) {
                const remaining = (config.mode === 'words') ? (config.words - words.length) : 150;
                const batchSize = Math.min(150, remaining);
                if (batchSize <= 0) return;
                const newWords = [];
                while (newWords.length < batchSize) {
                    const chunk = generateSentence().split(" ");
                    for (let i = 0; i < chunk.length && newWords.length < batchSize; i++) {
                        newWords.push(chunk[i]);
                    }
                }
                // Extend the logical array immediately (needed for boundary checks)
                words = words.concat(newWords);

                function _buildWordNodes(wordList, outCache) {
                    const frag = document.createDocumentFragment();
                    wordList.forEach(function(word) {
                        const wordSpan = document.createElement('div');
                        wordSpan.classList.add('word');
                        word.split('').forEach(function(letter) {
                            const letterSpan = document.createElement('span');
                            letterSpan.classList.add('letter');
                            letterSpan.textContent = letter;
                            wordSpan.appendChild(letterSpan);
                        });
                        frag.appendChild(wordSpan);
                        if (outCache) outCache.push(wordSpan);
                    });
                    return frag;
                }

                if (config.mode === 'words') {
                    // Words mode: add DOM elements SYNCHRONOUSLY — they must be available
                    // immediately for the next word the user advances to (no setTimeout delay).
                    // PERF: append to wordElsCache in the same pass so moveToNextWord()
                    // never needs a live DOM query.
                    wordsTrack.appendChild(_buildWordNodes(newWords, wordElsCache));
                    rowsCacheInvalid = true;
                } else {
                    // Time mode: defer DOM work to the next macrotask — never blocks a keystroke
                    setTimeout(function() {
                        wordsTrack.appendChild(_buildWordNodes(newWords, wordElsCache));
                        rowsCacheInvalid = true;
                    }, 0);
                }
            }
        }
        function startTimer() {
            startTime = Date.now();
            window._lastTestStartTime = startTime; // Musk Score: track start
            // ── Live WPM: show circle, hide Sunday Champ ──
            var liveWpmEl   = document.getElementById('live-wpm-display');
            var sundayChamp = document.getElementById('sunday-champ-nav');
            if (sundayChamp) sundayChamp.style.display = 'none';
            if (liveWpmEl)  { liveWpmEl.style.display = 'block'; liveWpmEl.classList.add('show'); }
            // kick off live WPM updater
            if (window._liveWpmInterval) clearInterval(window._liveWpmInterval);
            window._liveWpmInterval = setInterval(function() {
                if (!testActive || !startTime) return;
                var elapsed = (Date.now() - startTime) / 60000;
                if (elapsed < 0.01) return;
                var wpm = Math.round(correctKeystrokes / 5 / elapsed);
                var numEl = document.getElementById('live-wpm-number');
                if (numEl) {
                    numEl.textContent = wpm;
                    numEl.className = 'live-wpm-number' + (wpm >= 70 ? ' fast' : wpm >= 40 ? ' great' : ' slow');
                }
            }, 300);

            if (config.mode === 'time') {
                timerInterval = setInterval(updateTimer, 1000);
            }
            /* Quotes mode: no ticking interval needed — the word countdown
               (see moveToNextWord) updates the display as the user types. */
        }
        function updateTimer() {
            if (config.mode !== 'time') return;
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const remaining = config.time - elapsed;
            timerDiv.textContent = formatTime(remaining);

            // Musk Score milestone toast is shown ONLY after the test ends (not during typing)

            if (remaining <= 0) {
                endTest();
            }
        }
        function endTest() {
            if (!testActive) return;   // ← guard: prevents double-call from typeLetter + timer + moveToNextWord
            clearInterval(timerInterval);
            if (window._liveWpmInterval) { clearInterval(window._liveWpmInterval); window._liveWpmInterval = null; }
            testActive = false;
            testEnded  = true;   // ← lock out the "start on keypress" path until resetTest() clears this
            input.blur();

            // Show Musk & Elon score badges again when test ends
            var kmScoresPanelEnd = document.getElementById('km-scores-panel');
            if (kmScoresPanelEnd) kmScoresPanelEnd.classList.remove('km-scores-hidden');
            const elapsedMinutes = (Date.now() - startTime) / 60000 || 0.001;

            // === Musk Score: track for ALL modes (time, words, quotes) ===
            // 60 seconds of typing = 1 Musk Score point, regardless of mode
            try {
                var _muskUid = (window._currentUser && window._currentUser.uid) ? window._currentUser.uid : 'guest';
                var _muskKey = 'rt_musk_' + _muskUid;
                var _elapsedMsMusk = Math.round(elapsedMinutes * 60000);
                var _addSecsMusk   = Math.max(1, Math.round(_elapsedMsMusk / 1000));
                var _prevSecsMusk  = parseFloat(localStorage.getItem(_muskKey) || '0');
                var _newTotalMusk  = _prevSecsMusk + _addSecsMusk;
                localStorage.setItem(_muskKey, _newTotalMusk.toString());
                var _prevMuskScore = Math.floor(_prevSecsMusk / 60);
                var _newMuskScore  = Math.floor(_newTotalMusk / 60);
                window._muskScorePrev  = _prevMuskScore;
                window._muskScoreNew   = _newMuskScore;
                window._muskScoreDelta = _newMuskScore - _prevMuskScore;
                if (typeof updateKmScoreBadges === 'function') updateKmScoreBadges();

                // ── Firestore sync: only when Musk score hits a new multiple of 60 ──
                // e.g. muskScore = 60, 120, 180 … triggers a save; 59→61 saves at 60.
                // Stores muskSecs floored to the completed multiple of 60 × 60 seconds.
                if (_muskUid !== 'guest' && window._currentUser && window._currentUser.uid) {
                    var _storedMultiple = window._lastMuskSyncMultiple || 0;
                    var _currentMultipleOf60 = Math.floor(_newMuskScore / 60); // how many 60-Musk milestones passed
                    if (_currentMultipleOf60 > _storedMultiple) {
                        window._lastMuskSyncMultiple = _currentMultipleOf60;
                        // Store musk seconds floored to the last completed 60-point boundary
                        var _syncMuskSecs = _currentMultipleOf60 * 60 * 60; // each 60 musk = 3600 secs
                        // Grab latest elon state at time of save
                        var _syncElonState = {};
                        try { _syncElonState = JSON.parse(localStorage.getItem('rt_elon_' + _muskUid) || '{}'); } catch(_ee) {}
                        var _syncElonScore  = _syncElonState.elonScore || 0;
                        if (window.db && window.doc && window.setDoc) {
                            window.setDoc(
                                window.doc(window.db, 'user_scores', _muskUid),
                                {
                                    muskSecs  : _syncMuskSecs,
                                    elonScore : _syncElonScore,
                                    elonState : _syncElonState,
                                    updatedAt : Date.now()
                                },
                                { merge: true }
                            ).catch(function(_fsErr) { console.warn('Musk/Elon Firestore save failed:', _fsErr); });
                        }
                    }
                }
            } catch(_me) {}

            // WPM & Raw - use the counters you already maintain (much cleaner + accurate)
            const wpm = Math.round(correctKeystrokes / 5 / elapsedMinutes);
            const rawWpm = Math.round(totalKeystrokes / 5 / elapsedMinutes);

            // ── Accuracy ────────────────────────────────────────────────────────────
            // MonkeyType formula: correct / (correct + incorrect)
            // incorrectChars = wrong letters + extra letters + missed letters
            //   — early-space keystrokes are NOT a separate error; only the MISSED
            //     letters of the skipped word are counted (tracked in missedChars).
            // We subtract earlySpaces from totalKeystrokes so the space press itself
            // never inflates the error count.
            const incorrectTyped = (totalKeystrokes - earlySpaces) - correctKeystrokes;
            const totalErrors    = incorrectTyped + missedChars;
            const accuracy = (correctKeystrokes + totalErrors > 0)
                ? Math.round((correctKeystrokes / (correctKeystrokes + totalErrors)) * 100)
                : 100;

            // ── Consistency ─────────────────────────────────────────────────────────
            // MonkeyType method:
            //   1. Bucket all keystrokes into 1-second windows → per-second raw WPM
            //   2. Drop zero-keystroke seconds (idle gaps)
            //   3. Trim the first and last second (ramp-up / tail artefacts)
            //   4. CoV = σ / μ × 100
            //   5. consistency = max(1, round(100 − CoV))   ← LINEAR, not exponential
            let consistency = 100;
            if (keystrokeTimestamps.length > 5) {
                const windowSize = 1000;
                const numBuckets = Math.ceil((Date.now() - startTime) / windowSize) || 1;
                const buckets = new Array(numBuckets).fill(0);
                keystrokeTimestamps.forEach(ts => {
                    const b = Math.floor((ts - startTime) / windowSize);
                    if (b >= 0 && b < numBuckets) buckets[b]++;
                });

                // Convert counts → WPM values; keep only non-zero seconds
                let rawWpms = buckets
                    .map(c => (c * (60000 / windowSize)) / 5)
                    .filter(w => w > 0);

                // Trim first & last second (ramp-up / tailing-off artefacts)
                if (rawWpms.length > 4) rawWpms = rawWpms.slice(1, -1);

                if (rawWpms.length > 0) {
                    const mean = rawWpms.reduce((a, b) => a + b, 0) / rawWpms.length;
                    const variance = rawWpms.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / rawWpms.length;
                    const std = Math.sqrt(variance);
                    const covPercent = mean > 0 ? (std / mean) * 100 : 0;
                    // MonkeyType: linear formula (not exponential)
                    consistency = Math.max(1, Math.round(100 - covPercent));
                }
            }
            // === NEW RESULT POPULATION + COUNT-UP + DYNAMIC TIP ===
            const wpmEl = document.getElementById('wpm');
            wpmEl.innerHTML = `<span class="stat-label">YOUR SPEED</span><span class="stat-value" id="wpm-value">0</span>`;

            const rawEl = document.getElementById('raw');
            rawEl.innerHTML = `<span class="stat-label">RAW</span><span class="stat-value" id="raw-value">0</span>`;

            const accEl = document.getElementById('acc');
            accEl.innerHTML = `<span class="stat-label">ACCURACY</span><span class="stat-value" id="acc-value">0</span>`;

            const consEl = document.getElementById('consistency');
            consEl.innerHTML = `<span class="stat-label">CONSISTENCY</span><span class="stat-value" id="cons-value">0</span>`;

            // Dynamic tip based on performance
            let tipText = "Solid run! Keep launching every day.";
            if (wpm >= 120) tipText = "You're a typing GOD! 🌌 No one can catch you!";
            else if (wpm >= 90) tipText = "Elite pilot! You're dominating the leaderboard.";
            else if (accuracy >= 97) tipText = "Near-perfect accuracy — precision like a laser!";
            else if (consistency >= 92) tipText = "Incredible rhythm! Your fingers are on fire.";
            else if (wpm >= 60) tipText = "Great momentum! You're on track for supersonic speeds.";
            document.getElementById('tip-text').textContent = tipText;

            // === Build per-second chart data (PERF: O(n) two-pointer, replaces O(n²) filter loops) ===
            window._testStartTime = startTime;
            const testEndTime = Date.now();
            const elapsedMs = testEndTime - startTime;
            const totalSecs = Math.max(1, Math.ceil(elapsedMs / 1000));

            const _wpmPerSec = [], _rawPerSec = [], _burstPerSec = [];
            const sortedCorr = correctTimestamps.slice().sort((a, b) => a - b);
            const sortedKeys = keystrokeTimestamps.slice().sort((a, b) => a - b);

            let corrPtr = 0, rawPtr = 0;
            const burstBuckets = new Array(totalSecs).fill(0);
            sortedKeys.forEach(ts => {
                const b = Math.min(Math.floor((ts - startTime) / 1000), totalSecs - 1);
                if (b >= 0) burstBuckets[b]++;
            });

            for (let s = 1; s <= totalSecs; s++) {
                const tAtSec = Math.min(startTime + s * 1000, testEndTime);
                while (corrPtr < sortedCorr.length && sortedCorr[corrPtr] <= tAtSec) corrPtr++;
                while (rawPtr < sortedKeys.length && sortedKeys[rawPtr] <= tAtSec) rawPtr++;
                const minElapsed = (tAtSec - startTime) / 60000;
                _wpmPerSec.push(minElapsed > 0 ? Math.round(corrPtr / 5 / minElapsed) : 0);
                _rawPerSec.push(minElapsed > 0 ? Math.round(rawPtr  / 5 / minElapsed) : 0);
                const bucketIdx = s - 1;
                const wStart2 = startTime + bucketIdx * 1000;
                const wEnd2   = Math.min(startTime + s * 1000, testEndTime);
                const wDur    = wEnd2 - wStart2;
                if (wDur >= 900) {
                    _burstPerSec.push(Math.round((burstBuckets[bucketIdx] / 5) * (60000 / wDur)));
                } else {
                    _burstPerSec.push(_burstPerSec.length > 0 ? _burstPerSec[_burstPerSec.length - 1] : 0);
                }
            }

            window._chartData = {
                wpm: _wpmPerSec,
                raw: _rawPerSec,
                burst: _burstPerSec,
                errors: errorTimestamps,
                elapsed: elapsedMs
            };

            // === Populate Test Type + Time meta boxes ===
            const elapsedSecs = Math.round((Date.now() - startTime) / 1000);
            const modeLabels = { time: 'time', words: 'words', quotes: 'quotes' };
            const modeLabel = modeLabels[config.mode] || config.mode;
            let modeDisplay = modeLabel;
            if (config.mode === 'time') modeDisplay = 'time ' + config.time;
            else if (config.mode === 'words') modeDisplay = 'words ' + config.words;

            const modEl = document.getElementById('result-mode-display');
            const timeEl = document.getElementById('result-time-display');
            if (modEl) modEl.textContent = modeDisplay;
            if (timeEl) timeEl.textContent = elapsedSecs;

            // Show result
            resultDiv.style.display = 'block';
            resultDiv.classList.add('visible');
            // Mark that the result-ad slot is now visible/loaded, so the next
            // resetTest() (Retake Test / Tab+Enter / Enter) knows to swap in a
            // fresh native banner ad ready for the *next* result screen.
            window._resultAdShown = true;
            document.getElementById('main-header').style.display = 'none';
            wordsDiv.style.display = 'none';
            timerDiv.style.display = 'none';
            // Show keymap toggle button once test is finished
            var kmToggleRowEnd = document.getElementById('km-toggle-row');
            if (kmToggleRowEnd) kmToggleRowEnd.classList.remove('km-toggle-hidden');

            // Count-up animations (super satisfying)
            setTimeout(() => {
                animateCount('wpm-value', 0, wpm, 1400);
                animateCount('raw-value', 0, rawWpm, 1200);
                animateCount('acc-value', 0, accuracy, 900);
                animateCount('cons-value', 0, consistency, 1000);
            }, 400);

            // Rocket chart animation — starts after a short delay so result is laid out
            setTimeout(() => drawRocketChart(), 400);

            // === Elon Score: update session data with this test's wpm & accuracy ===
            try {
                var _elonUid = (window._currentUser && window._currentUser.uid) ? window._currentUser.uid : 'guest';
                if (typeof updateElonScoreAfterTest === 'function' && wpm > 0) {
                    // Read the CURRENT total Musk seconds AFTER the Musk update above
                    var _elonMuskKey  = 'rt_musk_' + _elonUid;
                    var _elonMuskSecs = parseFloat(localStorage.getItem(_elonMuskKey) || '0');
                    updateElonScoreAfterTest(_elonUid, wpm, accuracy, _elonMuskSecs);
                    if (typeof updateKmScoreBadges === 'function') updateKmScoreBadges();
                }
            } catch(_elonErr) {}

            // Save score to leaderboard (only registered users, time mode)
            const registeredName = window._currentUser?.name;
            window._lastConsistency = consistency; // store for profile stats
            // Always save to localStorage; Firestore leaderboard only for logged-in + time mode
            // SECURITY: wpm/accuracy are NOT passed as params — saveScore recalculates
            // them from closure variables (correctKeystrokes, startTime) that are `let`
            // declarations and therefore inaccessible from the browser console.
            if (config.mode === 'time') {
                saveScore(registeredName || 'guest', config.time);
            }

            // Save words-mode scores to word leaderboard (only for 10/25/50/100 word counts)
            if (config.mode === 'words' && [10, 25, 50, 100].includes(config.words)) {
                saveWordScore(registeredName || 'guest', config.words);
            }

            // ── Save words / quotes results to localStorage for logged-in users ──
            // (time mode is already saved inside saveScore above)
            if (config.mode === 'words' || config.mode === 'quotes') {
                try {
                    const _lsAuthUser = auth.currentUser;
                    if (_lsAuthUser) {
                        const _lsUid    = _lsAuthUser.uid;
                        const LS_KEY2   = 'rt_scores_' + _lsUid;
                        const AGG_KEY2  = 'rt_agg_'    + _lsUid;
                        const _lsNow    = Date.now();
                        const _lsCons   = typeof window._lastConsistency === 'number' ? window._lastConsistency : null;

                        // Update running aggregate
                        // Profile stats gate: only count tests where time >= 10s AND words >= 10
                        const _wordsCount2 = config.mode === 'words' ? config.words : words.length;
                        const _qualifies2  = elapsedSecs >= 10 && _wordsCount2 >= 10;
                        let agg2 = {};
                        try { agg2 = JSON.parse(localStorage.getItem(AGG_KEY2) || '{}'); } catch(_e) { agg2 = {}; }
                        if (_qualifies2) {
                            agg2.count     = (agg2.count    || 0) + 1;
                            agg2.wpmSum    = (agg2.wpmSum   || 0) + wpm;
                            agg2.accSum    = (agg2.accSum   || 0) + accuracy;
                            agg2.bestWpm   = Math.max(agg2.bestWpm  || 0, wpm);
                            agg2.lowestWpm = agg2.count === 1 ? wpm : Math.min(agg2.lowestWpm || wpm, wpm);
                            if (_lsCons !== null) {
                                agg2.consSum   = (agg2.consSum   || 0) + _lsCons;
                                agg2.consCount = (agg2.consCount || 0) + 1;
                            }
                        }
                        localStorage.setItem(AGG_KEY2, JSON.stringify(agg2));

                        // Append entry to recent list (capped at 200)
                        // Gate: words mode requires wordCount >= 10; quotes requires wordCount >= 10
                        const _recentQualifies = config.mode === 'words'
                            ? _wordsCount2 >= 10
                            : config.mode === 'quotes'
                                ? _wordsCount2 >= 10
                                : true; // future modes: save by default
                        if (_recentQualifies) {
                        let scores2 = [];
                        try { scores2 = JSON.parse(localStorage.getItem(LS_KEY2) || '[]'); } catch(_e) { scores2 = []; }
                        const _lsEntry = {
                            wpm:         wpm,
                            accuracy:    accuracy,
                            mode:        config.mode,
                            time:        _lsNow,
                            consistency: _lsCons,
                            elapsedSecs: elapsedSecs
                        };
                        if (config.mode === 'words') _lsEntry.wordCount = config.words;
                        if (config.mode === 'quotes') _lsEntry.wordCount = words.length;
                        scores2.push(_lsEntry);
                        if (scores2.length > 200) scores2 = scores2.slice(-200);
                        localStorage.setItem(LS_KEY2, JSON.stringify(scores2));
                        } // end _recentQualifies
                    }
                } catch(_lsErr) { console.warn('localStorage words/quotes save failed:', _lsErr); }
            }

            fireConfetti({
                particleCount: 80,
                spread: 65,
                origin: { y: 0.6 },
                colors: ['#ffd700', '#ff9900', '#ffffff']
            });
            // Adsterra Native Banner: no longer injected here. The ad script loads
            // once in <head> and renders into the #result-ad container in the
            // background while the user is still typing, so it's already sitting
            // there — ready instantly — the moment results are shown.
        }
        // ============================================================
        //  ROCKET CHART  v3  — accurate, permanent drops, stays alive
        // ============================================================
        function drawRocketChart() {
            const data      = window._chartData;
            const canvas    = document.getElementById('rocket-chart');
            if (!data || !canvas) return;

            // ── canvas sizing ──────────────────────────────────────
            const W = canvas.offsetWidth || 560;
            const H = 240;
            canvas.width  = W;
            canvas.height = H;
            const ctx = canvas.getContext('2d');

            const PAD = { top: 28, right: 20, bottom: 32, left: 44 };
            const cW  = W - PAD.left - PAD.right;
            const cH  = H - PAD.top  - PAD.bottom;

            // ── data ───────────────────────────────────────────────
            const wpmArr   = data.wpm;
            const rawArr   = data.raw;
            const burstArr = data.burst;
            const errTimes = data.errors.slice().sort((a, b) => a - b);
            const testStart    = window._testStartTime;
            const actualElapsed = data.elapsed;   // actual ms the test ran
            const n = wpmArr.length;
            if (n === 0) return;

            const maxVal  = Math.max(...wpmArr, ...rawArr, ...burstArr, 20) * 1.18;
            const floorY  = PAD.top + cH;  // bottom edge of chart area

            // ── coordinate helpers ─────────────────────────────────
            // i is a 0-based second index (0 = second 1)
            const getX = i => PAD.left + (n === 1 ? cW / 2 : (i / (n - 1)) * cW);
            const getY = v => PAD.top + cH - Math.max(0, Math.min(v, maxVal)) / maxVal * cH;

            // smooth Y for any fractional progress 0..1
            function yAtProgress(arr, prog) {
                if (arr.length === 1) return getY(arr[0]);
                const raw = prog * (arr.length - 1);
                const i0  = Math.min(Math.floor(raw), arr.length - 1);
                const i1  = Math.min(i0 + 1, arr.length - 1);
                const t   = raw - i0;
                return getY(arr[i0] + (arr[i1] - arr[i0]) * t);
            }

            // X of an error timestamp (using actual ms, not ceiling)
            const errXs = errTimes.map(ts => {
                const r = Math.max(0, Math.min(1, (ts - testStart) / actualElapsed));
                return PAD.left + r * cW;
            });

            // ── drops (two-phase) ──────────────────────────────────
            const liveDrops    = [];  // { x, y, vy }  — falling
            const restingDrops = [];  // { x, y }       — permanent, drawn every frame
            let   nextErrIdx   = 0;  // index into errTimes

            function spawnNewErrors(progress) {
                while (nextErrIdx < errTimes.length) {
                    const ratio = (errTimes[nextErrIdx] - testStart) / actualElapsed;
                    if (ratio > progress) break;
                    // Drop falls from the WPM rocket's current y at this error's x
                    const ex = errXs[nextErrIdx];
                    const ey = yAtProgress(wpmArr, ratio);
                    liveDrops.push({ x: ex, y: ey, vy: 1.2 });
                    nextErrIdx++;
                }
            }

            function drawSingleDrop(x, y) {
                // Teardrop: circle body + pointed top
                ctx.beginPath();
                ctx.arc(x, y, 4.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(x - 3, y - 2);
                ctx.quadraticCurveTo(x, y - 10, x + 3, y - 2);
                ctx.fill();
            }

            function tickAndDrawDrops() {
                // Move live drops downward with gravity
                for (let i = liveDrops.length - 1; i >= 0; i--) {
                    const d = liveDrops[i];
                    d.y  += d.vy;
                    d.vy += 0.28;   // gravity acceleration
                    if (d.y >= floorY - 5) {
                        // Land → become permanent resting drop
                        restingDrops.push({ x: d.x, y: floorY - 5 });
                        liveDrops.splice(i, 1);
                    }
                }

                // Draw all resting drops (permanent, full opacity)
                ctx.save();
                ctx.fillStyle   = '#ff2244';
                restingDrops.forEach(d => drawSingleDrop(d.x, d.y));
                ctx.restore();

                // Draw falling live drops (full opacity, they haven't landed yet)
                ctx.save();
                ctx.fillStyle   = '#ff4466';
                liveDrops.forEach(d => drawSingleDrop(d.x, d.y));
                ctx.restore();
            }

            // ── smoke particles ────────────────────────────────────
            const smokePools = { wpm: [], raw: [], burst: [] };

            function spawnSmoke(key, x, y, color) {
                const pool = smokePools[key];
                pool.push({
                    x: x - 8 + Math.random() * 5,
                    y: y + 3 + Math.random() * 5,
                    r: 1.8 + Math.random() * 2,
                    alpha: 0.45 + Math.random() * 0.2,
                    vx: -0.7 - Math.random() * 0.5,
                    vy:  0.2 + Math.random() * 0.35,
                    color
                });
                if (pool.length > 35) pool.splice(0, 8);
            }

            function tickSmoke(key) {
                const pool = smokePools[key];
                for (let i = pool.length - 1; i >= 0; i--) {
                    const p = pool[i];
                    p.x += p.vx;  p.y += p.vy;
                    p.r += 0.09;  p.alpha -= 0.011;
                    if (p.alpha <= 0) { pool.splice(i, 1); continue; }
                    ctx.save();
                    ctx.globalAlpha = p.alpha;
                    ctx.fillStyle   = p.color;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
            }

            // ── grid + axes ────────────────────────────────────────
            function drawGrid() {
                // Dark background panel
                ctx.save();
                ctx.fillStyle = 'rgba(0,0,0,0.28)';
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(PAD.left, PAD.top, cW, cH, 6);
                else               ctx.rect(PAD.left, PAD.top, cW, cH);
                ctx.fill();
                ctx.restore();

                // Y grid lines + labels
                ctx.font      = `9px 'Roboto Mono', monospace`;
                ctx.textAlign = 'right';
                for (let g = 0; g <= 4; g++) {
                    const v = Math.round(maxVal * (1 - g / 4));
                    const y = PAD.top + (g / 4) * cH;
                    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
                    ctx.lineWidth   = 1;
                    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + cW, y); ctx.stroke();
                    ctx.fillStyle   = 'rgba(255,255,255,0.42)';
                    ctx.fillText(v, PAD.left - 4, y + 3);
                }

                // X axis second labels
                const step = n <= 12 ? 1 : n <= 35 ? 5 : 10;
                ctx.textAlign = 'center';
                ctx.fillStyle = 'rgba(255,255,255,0.38)';
                for (let s = 0; s < n; s += step) {
                    ctx.fillText(s + 1, getX(s), H - 5);
                }

                // Axis borders
                ctx.strokeStyle = 'rgba(255,255,255,0.15)';
                ctx.lineWidth   = 1.5;
                ctx.beginPath();
                ctx.moveTo(PAD.left, PAD.top);
                ctx.lineTo(PAD.left, PAD.top + cH);
                ctx.lineTo(PAD.left + cW, PAD.top + cH);
                ctx.stroke();
            }

            // ── trail line ─────────────────────────────────────────
            function drawTrail(arr, color, upToIndex) {
                if (upToIndex < 0) return;
                ctx.save();
                ctx.strokeStyle = color;
                ctx.lineWidth   = 2.4;
                ctx.globalAlpha = 0.6;
                ctx.lineJoin    = 'round';
                ctx.lineCap     = 'round';
                ctx.beginPath();
                ctx.moveTo(getX(0), getY(arr[0]));
                for (let i = 1; i <= upToIndex; i++) ctx.lineTo(getX(i), getY(arr[i]));
                ctx.stroke();
                ctx.restore();
            }

            // ── rocket emoji ───────────────────────────────────────
            function drawRocket(x, y) {
                ctx.save();
                ctx.font          = '14px serif';
                ctx.textAlign     = 'center';
                ctx.textBaseline  = 'middle';
                ctx.fillText('🚀', x + 1, y);
                ctx.restore();
            }

            // ── rocket config ──────────────────────────────────────
            const ROCKETS = [
                { key: 'wpm',   arr: wpmArr,   color: '#ffd700' },
                { key: 'raw',   arr: rawArr,   color: '#00e6cc' },
                { key: 'burst', arr: burstArr, color: '#ff9900' },
            ];

            // ── final static frame (called once when animation ends) ──
            function drawFinalFrame() {
                // Force all remaining live drops to land
                liveDrops.forEach(d => restingDrops.push({ x: d.x, y: floorY - 5 }));
                liveDrops.length = 0;

                ctx.clearRect(0, 0, W, H);
                drawGrid();
                ROCKETS.forEach(r => drawTrail(r.arr, r.color, n - 1));

                // Resting drops
                ctx.save();
                ctx.fillStyle   = '#ff2244';
                ctx.shadowBlur  = 10;
                ctx.shadowColor = '#ff0000';
                restingDrops.forEach(d => drawSingleDrop(d.x, d.y));
                ctx.restore();

                // Rockets parked at end
                ROCKETS.forEach(r => drawRocket(PAD.left + cW, getY(r.arr[n - 1])));
            }

            // ── animation loop ─────────────────────────────────────
            const ANIM_DUR = 1800; // ms — total flight time
            let animStart  = null;

            function frame(ts) {
                if (!animStart) animStart = ts;
                const progress  = Math.min((ts - animStart) / ANIM_DUR, 1);
                const stepFloat = progress * (n - 1);
                const stepInt   = Math.floor(stepFloat);

                ctx.clearRect(0, 0, W, H);
                drawGrid();

                // Draw completed trail segments
                ROCKETS.forEach(r => drawTrail(r.arr, r.color, stepInt));

                // Spawn + draw error drops at correct times
                spawnNewErrors(progress);
                tickAndDrawDrops();

                // Smoke emission + particles
                ROCKETS.forEach(r => {
                    const x = PAD.left + progress * cW;
                    const y = yAtProgress(r.arr, progress);
                    spawnSmoke(r.key, x, y, r.color);
                    tickSmoke(r.key);
                });

                // Rockets on top of everything
                ROCKETS.forEach(r => {
                    drawRocket(PAD.left + progress * cW, yAtProgress(r.arr, progress));
                });

                if (progress < 1) {
                    requestAnimationFrame(frame);
                } else {
                    drawFinalFrame();
                }
            }

            requestAnimationFrame(frame);

            // ── MonkeyType-style hover tooltip ──────────────────────
            (function attachChartTooltip() {
                const tooltip    = document.getElementById('chart-tooltip');
                const chartPanel = canvas.closest('.result-chart-panel') || canvas.parentElement;
                if (!tooltip || !chartPanel) return;

                chartPanel.style.position = 'relative';

                function getDataAtX(clientX) {
                    const rect   = canvas.getBoundingClientRect();
                    const mouseX = clientX - rect.left;
                    if (mouseX < PAD.left || mouseX > PAD.left + cW) return null;
                    const frac = (mouseX - PAD.left) / cW;
                    const idx  = Math.max(0, Math.min(n - 1, Math.round(frac * (n - 1))));
                    const secStart = window._testStartTime + idx * 1000;
                    const secEnd   = secStart + 1000;
                    const errCount = data.errors.filter(ts => ts >= secStart && ts < secEnd).length;
                    return { sec: idx + 1, wpm: wpmArr[idx], raw: rawArr[idx], burst: burstArr[idx],
                             errors: errCount, canvasX: getX(idx), rect };
                }

                function showTooltip(clientX, clientY) {
                    const d = getDataAtX(clientX);
                    if (!d) { hideTooltip(); return; }

                    document.getElementById('chart-tooltip-sec').textContent   = d.sec + 's';
                    document.getElementById('ctt-errors').textContent          = d.errors;
                    document.getElementById('ctt-wpm').textContent             = d.wpm;
                    document.getElementById('ctt-raw').textContent             = d.raw;
                    document.getElementById('ctt-burst').textContent           = d.burst;
                    document.getElementById('chart-tooltip-errors').style.opacity = d.errors > 0 ? '1' : '0.4';

                    const panelRect = chartPanel.getBoundingClientRect();
                    tooltip.style.display = 'block';
                    const ttW = tooltip.offsetWidth  || 140;
                    const ttH = tooltip.offsetHeight || 100;
                    let tx = d.canvasX + d.rect.left - panelRect.left + 14;
                    let ty = clientY - panelRect.top  - 20;
                    if (tx + ttW > panelRect.width - 4) tx = d.canvasX + d.rect.left - panelRect.left - ttW - 14;
                    if (ty < 0) ty = 0;
                    if (ty + ttH > panelRect.height) ty = panelRect.height - ttH;
                    tooltip.style.left = tx + 'px';
                    tooltip.style.top  = ty + 'px';

                    // Crosshair + dots
                    drawFinalFrame();
                    ctx.save();
                    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
                    ctx.lineWidth   = 1;
                    ctx.setLineDash([4, 4]);
                    ctx.beginPath();
                    ctx.moveTo(d.canvasX, PAD.top);
                    ctx.lineTo(d.canvasX, PAD.top + cH);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    [{ arr: wpmArr, color: '#ffd700' }, { arr: rawArr, color: '#00e6cc' }, { arr: burstArr, color: '#ff9900' }].forEach(r => {
                        const cy = getY(r.arr[d.sec - 1]);
                        ctx.beginPath();
                        ctx.arc(d.canvasX, cy, 4.5, 0, Math.PI * 2);
                        ctx.fillStyle   = r.color;
                        ctx.shadowBlur  = 10;
                        ctx.shadowColor = r.color;
                        ctx.fill();
                    });
                    ctx.restore();
                }

                function hideTooltip() {
                    tooltip.style.display = 'none';
                    drawFinalFrame();
                }

                canvas.addEventListener('mousemove',  e => showTooltip(e.clientX, e.clientY));
                canvas.addEventListener('mouseleave', hideTooltip);
                canvas.addEventListener('touchmove',  e => { e.preventDefault(); showTooltip(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
                canvas.addEventListener('touchend',   hideTooltip);
            })();
        }

        // ============================================================
        //  NATIVE BANNER AD LOADER (safe, reusable)
        //  Loads a native-banner ad into any container by ID, contained
        //  inside its own isolated <iframe>.
        //
        //  WHY AN IFRAME: these ad-network invoke.js scripts render
        //  themselves via document.write(). Calling document.write()
        //  on the MAIN page after it has already loaded is dangerous —
        //  browsers implicitly re-open and WIPE the entire document
        //  when that happens. Putting the ad in its own iframe fixes
        //  this permanently: document.write() inside a freshly-opened
        //  iframe document only ever affects that iframe, never the
        //  parent page — safe on every reload.
        //
        //  NOTE: the ad's script tag is built with doc.createElement +
        //  appendChild below, NOT by writing literal script-tag text
        //  into a string. Some hosts run an HTML/JS auto-minifier over
        //  the page (e.g. Netlify asset optimization, Cloudflare Auto
        //  Minify) that can get confused by a script-open-tag-looking
        //  substring sitting inside another script's own string
        //  content, and mis-close the real surrounding script block —
        //  which turns the rest of the page's JS into plain visible
        //  text instead of running it. Avoiding that substring
        //  anywhere in this file's source sidesteps the problem
        //  entirely.
        // ============================================================
        function loadNativeBannerAd(containerElId, adKey) {
            var container = document.getElementById(containerElId);
            if (!container) return;

            container.innerHTML = '';

            var iframe = document.createElement('iframe');
            iframe.setAttribute('scrolling', 'no');
            iframe.setAttribute('frameborder', '0');
            // Height/width come entirely from the #result-ad iframe CSS rule
            // in styles.css (fixed 330px) — nothing here overrides it, so
            // there's one single source of truth and no scrollbars ever.
            iframe.style.cssText = 'width:100%; height:100%; border:0; display:block; overflow:hidden;';
            container.appendChild(iframe);

            // Build the iframe's contents purely via DOM methods — never
            // doc.write() with an HTML string. A freshly created same-origin
            // iframe (no src set) already has an empty document with a
            // head and body element in place, so we can just populate it
            // directly.
            //
            // WHY THIS MATTERS: dev tools like VS Code's Live Server inject
            // their own live-reload script by doing a naive text search for
            // a closing body tag in the raw file and splicing code in right
            // before it. If that closing-tag text appears anywhere in this
            // file's source — including inside a JS string meant for a
            // doc.write() call — the injector cannot tell the difference and
            // corrupts the middle of this very script block. Building the
            // iframe with createElement/appendChild instead means no such
            // tag text ever exists in this file for anything to misfire on.
            var doc = iframe.contentDocument || iframe.contentWindow.document;

            var styleEl = doc.createElement('style');
            styleEl.textContent = 'html,body{margin:0;padding:0;background:transparent;display:flex;justify-content:center;align-items:center;}';
            doc.head.appendChild(styleEl);

            var adContainer = doc.createElement('div');
            adContainer.id = 'container-' + adKey;
            doc.body.appendChild(adContainer);

            // Build and inject the ad network's script tag via the DOM API too.
            var adScript = doc.createElement('script');
            adScript.async = true;
            adScript.setAttribute('data-cfasync', 'false');
            adScript.src = 'https://pl30277778.effectivecpmnetwork.com/' + adKey + '/invoke.js';
            doc.body.appendChild(adScript);

            // NOTE: intentionally no auto-grow / ResizeObserver here anymore.
            // The iframe height is fixed (see iframe.style.cssText above) so
            // this ad slot can never trigger a layout shift, regardless of
            // how tall the ad network's actual creative renders.
        }

        // ============================================================
        //  DIRECT BANNER AD LOADER (safe, reusable)
        //  For ad-network scripts that read their config off a global
        //  `atOptions` object and typically use document.write() to
        //  inject the ad markup (highperformanceformat.com / Adsterra
        //  "Banner" format). document.write() only works correctly
        //  during a document's initial parse — calling it into an
        //  iframe that's already finished loading gets silently
        //  blocked/wiped by the browser, which is why ads went blank.
        //  Using srcdoc gives the ad script tags a real initial parse,
        //  identical to the original static embed, just isolated in
        //  its own document so repeated calls can't collide or leak.
        // ============================================================
        //  NOTE: the closing body/html tags inside the srcdoc string below
        //  are deliberately written with a backslash (<\/body><\/html>) —
        //  same reasoning as the <\/script> escaping already used elsewhere
        //  in this file. Local dev tools like VS Code's Live Server inject
        //  their live-reload script by doing a naive text search for a
        //  literal closing-tag substring in the raw file and splicing code
        //  in right before it. That search cannot tell a real page's
        //  closing tag from one sitting inside a JS string — if it matches
        //  the one in this string, it splices its script into the middle
        //  of this string literal, breaking the whole enclosing <script>
        //  block for everything after it. The escaped form is functionally
        //  identical once parsed at runtime, but doesn't match that search.
        function loadDirectBannerAd(containerElId, adKey, width, height) {
            var container = document.getElementById(containerElId);
            if (!container) return;

            container.innerHTML = '';

            var iframe = document.createElement('iframe');
            iframe.setAttribute('scrolling', 'no');
            iframe.setAttribute('frameborder', '0');
            iframe.style.cssText = 'display:block; width:' + width + 'px; max-width:100%; height:' + height + 'px; border:0; overflow:hidden; margin:0 auto;';

            // Cache-bust: without this, the browser can silently serve the
            // exact same cached invoke.js response (same embedded ad
            // markup) on every reload instead of asking the ad server for
            // a new one. A unique query string per call forces a real
            // network round-trip every time.
            var cacheBust = Date.now() + Math.random().toString(36).slice(2);

            iframe.srcdoc =
                '<!DOCTYPE html><html><head><style>html,body{margin:0;padding:0;background:transparent;display:flex;justify-content:center;align-items:center;overflow:hidden;}</style></head><body>' +
                '<script>atOptions={"key":"' + adKey + '","format":"iframe","height":' + height + ',"width":' + width + ',"params":{}};<\/script>' +
                '<script src="https://www.highperformanceformat.com/' + adKey + '/invoke.js?_=' + cacheBust + '"><\/script>' +
                '<\/body><\/html>';

            container.appendChild(iframe);
        }

        // ── VIEWABILITY-BASED LAZY LOADING for the 4 ad slots below the typing
        // test (typing-area-ad, ad-slot-2, ad-slot-3, ad-slot-4) ──
        //
        // PROBLEM this fixes: these slots used to fire their ad request the
        // instant the page loaded (or, for ad #1, the instant the user hit
        // Retake) — no matter whether the slot was actually on-screen. Every
        // one of those requests counts as a "served" impression to the ad
        // network, but if the user never scrolls down to actually see it,
        // it's never a "viewed" impression. A high served-but-unviewed ratio
        // is exactly what drags down CPM over time.
        //
        // FIX: don't request an ad for a slot until that slot is actually
        // about to enter the viewport. One IntersectionObserver watches
        // slots 2-4; each of those only ever loads once it's genuinely
        // about to be seen, so every served impression is a real viewable one.
        //
        // Ad #1 (typing-area-ad) gets its own, STRICTER observer below —
        // see the note just above _typingAreaAdObserver for why.
        const _adSlotLoaders = {
            'container-typing-area-ad': () => loadDirectBannerAd('container-typing-area-ad', 'ec2cd2e3ac271efe174e656e9ef09deb', 728, 90),
            'container-ad-slot-2':      () => loadDirectBannerAd('container-ad-slot-2', 'c0570a980250971b0f952672ff8a136a', 300, 250),
            'container-ad-slot-3':      () => loadDirectBannerAd('container-ad-slot-3', 'e8642ebc1588f7663a0e84f1c8058052', 320, 50),
            'container-ad-slot-4':      () => loadDirectBannerAd('container-ad-slot-4', '95b624fbbcc4571e53cd5d3a062f9758', 468, 60),
        };
        const _adSlotLoaded = { 'container-typing-area-ad': false, 'container-ad-slot-2': false, 'container-ad-slot-3': false, 'container-ad-slot-4': false };

        const _adLazyObserver = ('IntersectionObserver' in window) ? new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const id = entry.target.id;
                if (_adSlotLoaded[id]) return; // already loaded, and not marked dirty — nothing to do
                _adSlotLoaded[id] = true;
                _adSlotLoaders[id]();
            });
            // Start loading ~200px before the slot actually reaches the viewport, so
            // the ad has finished its network round-trip by the time it's visible —
            // still a real viewable impression, just without a blank flash on arrival.
        }, { rootMargin: '200px 0px', threshold: 0.01 }) : null;

        function _observeAdSlot(containerId) {
            const el = document.getElementById(containerId);
            if (!el) return;
            if (_adLazyObserver) {
                _adLazyObserver.observe(el);
            } else {
                // No IntersectionObserver support (very old browser) — fall back
                // to loading immediately rather than never loading at all.
                if (!_adSlotLoaded[containerId]) { _adSlotLoaded[containerId] = true; _adSlotLoaders[containerId](); }
            }
        }

        // ── Ad #1 (typing-area-ad): stricter, scroll-gated loading ──────────
        // This slot sits immediately below the typing test, so on plenty of
        // screens its top edge already grazes the bottom of the viewport (or
        // sits within the shared observer's 200px pre-load margin) the moment
        // the page paints — before the user has scrolled at all. That fired
        // the ad request on load / on every Retake, racking up served
        // impressions nobody actually looked at (attention stays on the
        // typing test above), which drags down CPM. Viewed impressions are
        // worth more than served ones, so this slot must only ever load once
        // the user has genuinely scrolled AND the slot is substantially
        // (≥50%) on-screen — no pre-load margin, no "just grazing the edge"
        // counts.
        let _hasUserScrolled = false;
        function _markUserScrolled() {
            if (window.scrollY > 10 || document.documentElement.scrollTop > 10) {
                _hasUserScrolled = true;
                window.removeEventListener('scroll', _markUserScrolled);
                _maybeLoadTypingAreaAd();
            }
        }
        window.addEventListener('scroll', _markUserScrolled, { passive: true });

        let _typingAreaAdIntersecting = false;
        function _maybeLoadTypingAreaAd() {
            const id = 'container-typing-area-ad';
            if (_adSlotLoaded[id]) return;
            if (!_hasUserScrolled) return;            // must be a real scroll, not just page geometry
            if (!_typingAreaAdIntersecting) return;   // must actually be meaningfully on-screen
            _adSlotLoaded[id] = true;
            _adSlotLoaders[id]();
        }

        const _typingAreaAdObserver = ('IntersectionObserver' in window) ? new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                _typingAreaAdIntersecting = entry.isIntersecting;
                if (entry.isIntersecting) _maybeLoadTypingAreaAd();
            });
        }, { rootMargin: '0px', threshold: 0.5 }) : null;

        function _observeTypingAreaAd() {
            const el = document.getElementById('container-typing-area-ad');
            if (!el) return;
            if (_typingAreaAdObserver) {
                _typingAreaAdObserver.observe(el);
            } else {
                // No IntersectionObserver support — fall back to the shared
                // lazy-load behavior rather than never loading at all.
                _observeAdSlot('container-typing-area-ad');
            }
        }

        // Registers all 4 slots for lazy loading. Called once on page init.
        function initAdLazyLoading() {
            _observeTypingAreaAd();
            ['container-ad-slot-2', 'container-ad-slot-3', 'container-ad-slot-4'].forEach(_observeAdSlot);
        }

        // Swaps in a brand-new result-screen ad. Called on page init, and
        // again from resetTest() every time the user leaves a finished
        // result screen (Retake Test / Tab+Enter / Enter) — so the fresh
        // ad has the entire next typing test to finish loading in the
        // background, ready instantly the moment the NEXT result shows.
        function refreshResultAd() {
            loadNativeBannerAd('result-ad', '42f27a48e35d8fefd79d32771cdb9094');
        }

        // Marks the typing-area banner (ad #1) as needing a fresh ad next time
        // the user retakes the test — but does NOT force-load it blind.
        // Previously this checked "any pixel of the slot overlaps the
        // viewport" and loaded immediately if so — but since this slot sits
        // right below the typing test, that overlap is often true the instant
        // Retake is pressed, even though the user hasn't scrolled and isn't
        // looking at it. That served an impression nobody viewed. Now it just
        // marks the slot dirty and defers entirely to the same scroll-gated
        // IntersectionObserver used on initial load — it only loads once the
        // user has genuinely scrolled AND the slot is ≥50% on-screen.
        function refreshTypingAreaAd() {
            const id = 'container-typing-area-ad';
            _adSlotLoaded[id] = false; // mark dirty so it's eligible to reload
            _maybeLoadTypingAreaAd();  // loads immediately only if the user has
                                        // already scrolled and it's still in view;
                                        // otherwise the observer fires it later.
        }

        function resetTest() {
            // Leaving a finished result screen → line up a fresh ad for next time.
            if (window._resultAdShown) {
                window._resultAdShown = false;
                refreshResultAd();
                refreshTypingAreaAd();
            }
            // ── Live WPM: stop updater, hide circle, restore Sunday Champ ──
            if (window._liveWpmInterval) { clearInterval(window._liveWpmInterval); window._liveWpmInterval = null; }
            var liveWpmEl   = document.getElementById('live-wpm-display');
            var sundayChamp = document.getElementById('sunday-champ-nav');
            if (liveWpmEl)  { liveWpmEl.style.display = 'none'; liveWpmEl.classList.remove('show'); }
            if (sundayChamp) sundayChamp.style.display = 'block';
            var numEl = document.getElementById('live-wpm-number');
            if (numEl) { numEl.textContent = '0'; numEl.className = 'live-wpm-number'; }

            document.getElementById("intro-text").style.display = "block";
            document.body.classList.remove('typing-active'); // PERF: restore bg animations
            document.body.classList.remove('test-running');  // PERF: reveal all header elements
            document.getElementById("test-config").style.display = "flex";
            document.getElementById("difficulty-container").style.display = "flex";
            document.getElementById("timer").style.display = "block";
            document.getElementById("leaderboard-btn").style.display = "block";
            document.getElementById('main-header').style.display = 'flex';
            document.getElementById("play-game").style.display = "flex";
                // === SHOW DISTRACTIONS AGAIN AFTER TEST ===
    document.getElementById("page-title").style.display = "block";           // ← new
    document.getElementById("sunday-champ-nav").style.display = "block";     // ← new
    if (document.getElementById("header-auth-btn")) {
        document.getElementById("header-auth-btn").style.display = "flex";   // ← new
    }
            // Show keymap toggle button again after test
            var kmToggleRow = document.getElementById('km-toggle-row');
            if (kmToggleRow) kmToggleRow.classList.remove('km-toggle-hidden');

            // Show Musk & Elon score badges again after test — with gain animation
            var kmScoresPanel = document.getElementById('km-scores-panel');
            if (kmScoresPanel) {
                kmScoresPanel.classList.remove('km-scores-hidden');
                // Animate the musk score gain if there was a delta this session
                if (typeof window._muskScoreDelta === 'number' && window._muskScoreDelta > 0) {
                    _animateMuskGain(window._muskScorePrev, window._muskScoreDelta, window._muskScoreNew);
                    window._muskScoreDelta = 0;
                }
            }
            clearInterval(timerInterval);
            testActive = false;
            testEnded  = false;   // ← allow new test to start on next keypress
            caret.classList.add('blink');
            window._muskLastToastScore = null; // reset per-test milestone tracker
            currentWordIndex = 0;
            currentLetterIndex = 0;
            typedHistory = [];
            startTime = null;
            correctKeystrokes = 0;
            totalKeystrokes = 0;
            keystrokeTimestamps = [];
            missedChars = 0;
            earlySpaces = 0;
            typedWords = [];
            spaces = 0;
            correctSpaces = 0;
            correctTimestamps = [];
            errorTimestamps = [];

            resultDiv.style.display = 'none';
            resultDiv.classList.remove('visible');
            wordsDiv.style.display = 'block';
            wordsDiv.scrollTop = 0;
            _vScrollTween.current = 0;
            if (wordsTrack !== wordsDiv) {
                wordsTrack.style.transform = (config.lineMode === 1) ? 'translateX(0px)' : '';
            }
            _tapeTween.current = 0;
            _tapeTween.from = 0;
            _tapeTween.to = 0;
            if (_tapeTween.raf) { cancelAnimationFrame(_tapeTween.raf); _tapeTween.raf = null; }
            timerDiv.style.display = 'block';

            wordsDiv.style.opacity = 0;
            requestAnimationFrame(() => wordsDiv.style.opacity = 1);
            input.value = '';
            input.focus();

            if (config.mode === 'time' || config.mode === 'words' || config.mode === 'quotes') generateWords();

            /* Show/hide author attribution based on mode */
            if (config.mode !== 'quotes') setQuoteAuthor('');

            timerDiv.classList.remove('highlight');
            if (config.mode === 'time') {
                timerDiv.textContent = formatTime(config.time);
                timerDiv.classList.add('highlight');
            } else if (config.mode === 'words') {
                timerDiv.textContent = config.words;
                timerDiv.classList.add('highlight');
            } else if (config.mode === 'quotes') {
                timerDiv.textContent = words.length;
                timerDiv.classList.add('highlight');
            }

            renderWords();
            rowsCacheInvalid = true;   // ← ensure cache is fresh after full reset
        }
        resetTest();
        applyLineMode(config.lineMode);
        refreshResultAd();
        // All 4 below-the-test ad slots (typing-area-ad, ad-slot-2, ad-slot-3,
        // ad-slot-4) now load lazily — only once each is actually about to be
        // visible — instead of firing every ad request the instant the page
        // loads. See initAdLazyLoading() / IntersectionObserver setup above.
        initAdLazyLoading();

        // CARET FIX: styles.css loads asynchronously (media="print" trick), so when
        // resetTest() runs on page load, styles.css hasn't applied yet.
        // position:relative on #words is now in the inline CSS (Fix 1), which gives
        // letter spans a real offsetHeight from frame 1.
        // But offsetTop/offsetLeft of word elements are still 0 until styles.css
        // applies padding/margin. So we re-run the caret update the moment each
        // stylesheet switches from media="print" to media="all".
        document.querySelectorAll('link[rel="stylesheet"]').forEach(function(link) {
            link.addEventListener('load', function() {
                rowsCacheInvalid = true;
                // Re-measure the real row height now that styles.css has applied
                // (the height set at page-load time used the 60px fallback estimate).
                applyLineMode(config.lineMode);
                scheduleCaretUpdate();
            });
        });

        // FONT-SWAP FIX: Roboto Mono loads asynchronously (display=swap). Until
        // it's actually ready, letters render in the fallback "monospace" font,
        // which has different character widths — so every word/letter
        // offsetLeft measured before the swap (including the caret's position
        // and, in single-line tape mode, #words-track's transform) is based on
        // the WRONG font metrics. When the real font swaps in, the words
        // reflow to their true widths but nothing was telling the caret/track
        // to re-check — leaving a visible gap between the caret and the text.
        // This is barely noticeable on localhost (font is cached, loads near-
        // instantly) but clearly visible on a real deployment, where
        // downloading it from Google Fonts takes real network time — exactly
        // the gap being reported. document.fonts.ready resolves the moment
        // every font requested by this page's CSS has finished loading (or
        // failed), i.e. exactly the swap moment we need to react to.
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(function() {
                rowsCacheInvalid = true;
                applyLineMode(config.lineMode);
                scheduleCaretUpdate();
            });
        }

        // Single/Two line modes set an explicit pixel height derived from the
        // CURRENT breakpoint's measured row height. If the viewport is resized
        // across a responsive breakpoint (font-size/row-height changes), re-measure
        // and reapply so the box never ends up clipped or with extra dead space.
        // Debounced — resize fires continuously, this only ever does real work
        // ~150ms after the user stops dragging.
        let _lineModeResizeTimer = null;
        window.addEventListener('resize', function () {
            if (config.lineMode === 3) return; // default mode has no explicit height to fix up
            clearTimeout(_lineModeResizeTimer);
            _lineModeResizeTimer = setTimeout(function () {
                applyLineMode(config.lineMode);
            }, 150);
        });
        function animateCount(id, start, end, duration) {
            let startTime = null;
            const element = document.getElementById(id);
            if (!element) return;

            function step(timestamp) {
                if (!startTime) startTime = timestamp;
                const progress = Math.min((timestamp - startTime) / duration, 1);
                const current = Math.floor(start + (end - start) * progress);
                element.textContent = current + (id.includes('acc') || id.includes('cons') ? '%' : '');
                if (progress < 1) {
                    requestAnimationFrame(step);
                } else {
                    element.textContent = end + (id.includes('acc') || id.includes('cons') ? '%' : '');
                }
            }
            requestAnimationFrame(step);
        }

/* ═══════════════════════════════════════════════════════════
   SECURITY HELPER — sanitise every string before innerHTML
   Prevents XSS from malicious Firestore data
═══════════════════════════════════════════════════════════ */
function sanitizeStr(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}
        // ═══════════════════════════════════════════════════════════════════
        //  saveScore — SECURITY HARDENED (v4)
        //
        //  WPM and accuracy are NO LONGER parameters.  They are recalculated
        //  here from the closure variables correctKeystrokes / totalKeystrokes /
        //  startTime / missedChars, which are `let` declarations in this script
        //  block and therefore NOT accessible from the browser console.
        //
        //  A console attacker calling  saveScore("me", 30)  gets wpm=0 and is
        //  rejected before any Firestore write happens.
        //
        //  A console attacker calling  window.setDoc(window.doc(window.db,...))
        //  directly is stopped by the Firestore Security Rules, which now
        //  cross-validate correctKeystrokes / keystrokeCount / elapsedMs
        //  against wpm and testDuration — fake values that aren't self-
        //  consistent are rejected at the database level.
        // ═══════════════════════════════════════════════════════════════════
        async function saveScore(name, duration) {
            const authUser = auth.currentUser;
            if (!authUser) return; // must be signed in — no guest writes

            // ── Anti-cheat: recalculate from closure state, not from params ──
            // These `let` variables live in this script's lexical scope.
            // They are NOT on window, so they cannot be set via DevTools console.
            const _now         = Date.now();
            const _elapsedMs   = startTime ? (_now - startTime) : 0;
            const _elapsedMin  = _elapsedMs / 60000 || 0.001;
            const _wpm         = Math.max(0, Math.round(correctKeystrokes / 5 / _elapsedMin));
            const _rawWpm      = Math.max(0, Math.round(totalKeystrokes   / 5 / _elapsedMin));
            const _typedErrors = Math.max(0, totalKeystrokes - correctKeystrokes);
            const _totalErrors = _typedErrors + (missedChars || 0);
            const _accuracy    = (correctKeystrokes + _totalErrors > 0)
                ? Math.round((correctKeystrokes / (correctKeystrokes + _totalErrors)) * 100)
                : 100;
            const _ksc         = totalKeystrokes;   // used for local sanity check

            // ── Client-side sanity gates ─────────────────────────────────────
            // Firestore rules enforce the same checks server-side; these are a
            // fast-fail before we even attempt a network request.
            if (_wpm    <= 0)                { console.warn('[RT] Score rejected: wpm=0');              return; }
            if (_wpm    >= 220)              { console.warn('[RT] Score rejected: wpm unrealistic');     return; }
            if (_accuracy < 50)              { console.warn('[RT] Score rejected: accuracy < 50');       return; }
            if (_elapsedMs < duration * 900) { console.warn('[RT] Score rejected: test ended too fast'); return; }
            if (_ksc < _wpm * 0.3)           { console.warn('[RT] Score rejected: too few keystrokes'); return; }

            const uid = authUser.uid;

            // ── Save every run to localStorage — profile stats, zero Firestore reads ──
            try {
                const KEY        = 'rt_scores_' + uid;
                const AGG_KEY    = 'rt_agg_'    + uid;   // all-time aggregate (never capped)

                // ── 1. Update the running aggregate (all-time stats) ──────────
                let agg = {};
                try { agg = JSON.parse(localStorage.getItem(AGG_KEY) || '{}'); } catch(_e) { agg = {}; }

                const _cons = typeof window._lastConsistency === 'number' ? window._lastConsistency : null;

                // Profile stats gate: only count tests with duration >= 10 seconds
                if (duration >= 10) {
                    agg.count      = (agg.count      || 0) + 1;
                    agg.wpmSum     = (agg.wpmSum      || 0) + _wpm;
                    agg.accSum     = (agg.accSum      || 0) + _accuracy;
                    agg.bestWpm    = Math.max(agg.bestWpm    || 0, _wpm);
                    agg.lowestWpm  = agg.count === 1 ? _wpm : Math.min(agg.lowestWpm || _wpm, _wpm);
                    if (_cons !== null) {
                        agg.consSum   = (agg.consSum  || 0) + _cons;
                        agg.consCount = (agg.consCount || 0) + 1;
                    }
                }
                localStorage.setItem(AGG_KEY, JSON.stringify(agg));

                // ── 2. Keep only the 200 most recent entries for the dashboard ─
                let scores = [];
                try { scores = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch(_e) { scores = []; }
                scores.push({
                    wpm:          _wpm,
                    accuracy:     _accuracy,
                    testDuration: duration,
                    time:         _now,
                    consistency:  _cons
                });
                if (scores.length > 200) scores = scores.slice(-200);
                localStorage.setItem(KEY, JSON.stringify(scores));
            } catch (lsErr) { console.warn('localStorage score save failed:', lsErr); }

            // ── Firestore write ──────────────────────────────────────────────
            try {
                // Always re-fetch username/country from Firestore — prevents
                // a cheater from spoofing their display name via localStorage.
                let verifiedName    = name;
                let verifiedCountry = window._currentUser?.country || '';
                try {
                    const userSnap = await getDoc(doc(db, 'users', authUser.uid));
                    if (userSnap.exists()) {
                        verifiedName    = userSnap.data().name    || name;
                        verifiedCountry = userSnap.data().country || '';
                    }
                } catch(verifyErr) { /* use session values as fallback */ }

                const docId   = `${authUser.uid}_${duration}`;
                const userRef = doc(db, "typing_test_scores", docId);
                const existing     = await getDoc(userRef);
                const existingData = existing.data();

                if (!existing.exists() || _wpm > (existingData?.wpm || 0)) {
                    await setDoc(userRef, {
                        name:         verifiedName,
                        wpm:          _wpm,
                        accuracy:     _accuracy,
                        testDuration: duration,
                        country:      verifiedCountry,
                        uid:          authUser.uid,
                        time:         _now,
                        // Required by the hardened Firestore rules — lets the
                        // server independently verify wpm/accuracy against the
                        // actual keystroke timing instead of trusting them outright.
                        correctKeystrokes: correctKeystrokes,
                        keystrokeCount:    totalKeystrokes,
                        elapsedMs:         _elapsedMs
                    });
                }
            } catch (e) {
                console.warn("Leaderboard save failed:", e);
            }
        }
        async function loadLeaderboard(duration = currentLeaderboardDuration) {
            // ← NEW: hide prompt IMMEDIATELY (sync) so it never shows again after reload
            updateLeaderboardPrompt();

            currentLeaderboardDuration = duration;   // remember last tab

            const body = document.getElementById("leaderboard-body");
            const skeleton = document.getElementById("lb-skeleton");
            if (!body || !skeleton) return; // leaderboard.html not loaded yet (e.g. firebase-ready fired before first open)

            // PERF: 30-second cache — avoid a Firestore round-trip on every tab switch
            if (!window._lbCache) window._lbCache = {};
            const cached = window._lbCache[duration];
            if (cached && (Date.now() - cached.ts) < 30000) {
                skeleton.innerHTML = '';
                body.style.display = 'block';
                _renderLeaderboardRows(body, cached.entries);
                return;
            }

            skeleton.innerHTML = Array(10).fill(`<div class="skeleton-row"></div>`).join('');
            body.style.display = "none";

            const q = query(
                collection(db, "typing_test_scores"),
                where("testDuration", "==", duration),
                orderBy("wpm", "desc"),
                limit(10)
            );

            const snapshot = await getDocs(q);

            /* Collect entries and find names missing country */
            const entries = [];
            const namesToLookup = [];
            const registeredName = localStorage.getItem('rt_registered_name');

            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                entries.push(data);
                if (!data.country) namesToLookup.push(data.name);
            });

            /* Secondary lookup: fetch country from users collection for old entries */
            const countryMap = {};
            if (namesToLookup.length > 0) {
                const lookups = namesToLookup.map(n =>
                    getDocs(query(collection(db, 'users'), where('name', '==', n), limit(1)))
                );
                const results = await Promise.all(lookups);
                results.forEach(snap => {
                    snap.forEach(udoc => {
                        const ud = udoc.data();
                        if (ud.name && ud.country) countryMap[ud.name] = ud.country;
                    });
                });
            }

            body.innerHTML = "";
            let rank = 1;

                             entries.forEach(data => {
                const isYou = window._currentUser && data.uid && data.uid === window._currentUser.uid;

                const row = document.createElement('div');
                row.className = `leaderboard-row ${rank === 1 ? 'top1' : rank === 2 ? 'top2' : rank === 3 ? 'top3' : ''} ${isYou ? 'you' : ''}`;

                var _country = data.country
                    || countryMap[data.name]
                    || (isYou ? (window._currentUser?.country || localStorage.getItem('rt_user_country') || '') : '');

                var _flag = getFlag(_country);
                var _date = fmtDate(data.time);

                // Top 3: Show ONLY emoji (no number)
                let rankDisplay = rank;
                if (rank === 1) rankDisplay = "🥇";
                else if (rank === 2) rankDisplay = "🥈";
                else if (rank === 3) rankDisplay = "🥉";

                const _safeName = sanitizeStr(data.name);
                const _safeWpm  = sanitizeStr(data.wpm);
                const _safeAcc  = sanitizeStr(data.accuracy);
                const _safeDate = sanitizeStr(_date);
                const _safeCountryTitle = sanitizeStr(_country);
                row.innerHTML = `
                    <span class="rank">${rankDisplay}</span>
                    <span class="player">
                        <span class="lb-player-name">${_safeName}</span>
                    </span>
                    <span class="lb-flag-cell" title="${_safeCountryTitle}">${_flag}</span>
                    <span style="font-weight:900;color:#ffd700">${_safeWpm}</span>
                    <span>${_safeAcc}%</span>
                    <span class="lb-date-cell">${_safeDate}</span>
                `;

                body.appendChild(row);
                rank++;
            });

            skeleton.style.display = "none";
            body.style.display = "block";

            // PERF: store in cache after successful render
            if (!window._lbCache) window._lbCache = {};
            window._lbCache[duration] = { ts: Date.now(), entries };

            if (registeredName && [...body.children].some(r => r.classList.contains('you'))) {
                fireConfetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
            }

            // ← REMOVED the old updateLeaderboardPrompt() from here (now at top)
        }

        // ── Words-mode leaderboard ───────────────────────────────────────
        let currentWordLeaderboardCount = 10;
        async function loadWordLeaderboard(wordCount = currentWordLeaderboardCount) {
            updateLeaderboardPrompt();
            currentWordLeaderboardCount = wordCount;

            const body = document.getElementById("leaderboard-body");
            const skeleton = document.getElementById("lb-skeleton");
            if (!body || !skeleton) return;

            // 30-second cache keyed by "w"+wordCount
            if (!window._lbCache) window._lbCache = {};
            const cacheKey = 'w' + wordCount;
            const cached = window._lbCache[cacheKey];
            if (cached && (Date.now() - cached.ts) < 30000) {
                skeleton.innerHTML = '';
                body.style.display = 'block';
                _renderLeaderboardRows(body, cached.entries);
                return;
            }

            skeleton.innerHTML = Array(10).fill(`<div class="skeleton-row"></div>`).join('');
            body.style.display = "none";

            // Use only where() with no orderBy to avoid needing a composite index.
            // We sort and slice client-side — the collection is small so this is fast.
            const q = query(
                collection(db, "typing_word_scores"),
                where("wordCount", "==", wordCount)
            );

            let snapshot;
            try {
                snapshot = await getDocs(q);
            } catch(qErr) {
                console.warn("Word leaderboard query failed:", qErr);
                skeleton.innerHTML = '';
                body.innerHTML = '<div style="text-align:center;color:#aaa;padding:20px">Could not load scores. Try again later.</div>';
                body.style.display = 'block';
                return;
            }

            const allEntries = [];
            snapshot.forEach(docSnap => allEntries.push(docSnap.data()));
            // Sort by wpm desc, take top 10
            allEntries.sort((a, b) => (b.wpm || 0) - (a.wpm || 0));
            const entries = allEntries.slice(0, 10);

            const namesToLookup = [];
            const registeredName = localStorage.getItem('rt_registered_name');

            entries.forEach(data => {
                if (!data.country) namesToLookup.push(data.name);
            });

            const countryMap = {};
            if (namesToLookup.length > 0) {
                const lookups = namesToLookup.map(n =>
                    getDocs(query(collection(db, 'users'), where('name', '==', n), limit(1)))
                );
                const results = await Promise.all(lookups);
                results.forEach(snap => {
                    snap.forEach(udoc => {
                        const ud = udoc.data();
                        if (ud.name && ud.country) countryMap[ud.name] = ud.country;
                    });
                });
            }

            body.innerHTML = "";
            let rank = 1;
            entries.forEach(data => {
                const isYou = window._currentUser && data.uid && data.uid === window._currentUser.uid;
                const row = document.createElement('div');
                row.className = `leaderboard-row ${rank === 1 ? 'top1' : rank === 2 ? 'top2' : rank === 3 ? 'top3' : ''} ${isYou ? 'you' : ''}`;
                const _country = data.country || countryMap[data.name] || (isYou ? (window._currentUser?.country || '') : '');
                const _flag = getFlag(_country);
                const _date = fmtDate(data.time);
                let rankDisplay = rank;
                if (rank === 1) rankDisplay = "🥇";
                else if (rank === 2) rankDisplay = "🥈";
                else if (rank === 3) rankDisplay = "🥉";
                row.innerHTML = `
                    <span class="rank">${rankDisplay}</span>
                    <span class="player"><span class="lb-player-name">${sanitizeStr(data.name)}</span></span>
                    <span class="lb-flag-cell" title="${sanitizeStr(_country)}">${_flag}</span>
                    <span style="font-weight:900;color:#ffd700">${sanitizeStr(data.wpm)}</span>
                    <span>${sanitizeStr(data.accuracy)}%</span>
                    <span class="lb-date-cell">${sanitizeStr(_date)}</span>
                `;
                body.appendChild(row);
                rank++;
            });

            skeleton.innerHTML = '';
            body.style.display = "block";
            window._lbCache[cacheKey] = { ts: Date.now(), entries };

            if (registeredName && [...body.children].some(r => r.classList.contains('you'))) {
                fireConfetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
            }
        }

        // ── Elon-mode leaderboard ─────────────────────────────────────────
        async function loadElonLeaderboard() {
            updateLeaderboardPrompt();

            const body = document.getElementById("leaderboard-body");
            const skeleton = document.getElementById("lb-skeleton");
            if (!body || !skeleton) return;

            // 30-second cache
            if (!window._lbCache) window._lbCache = {};
            const cacheKey = 'elon';
            const cached = window._lbCache[cacheKey];
            if (cached && (Date.now() - cached.ts) < 30000) {
                skeleton.innerHTML = '';
                body.style.display = 'block';
                _renderElonLeaderboardRows(body, cached.entries);
                return;
            }

            skeleton.innerHTML = Array(10).fill(`<div class="skeleton-row"></div>`).join('');
            body.style.display = "none";

            // Query top 10 by elonScore — single-field index, free tier friendly
            const q = query(
                collection(db, "elon_scores"),
                orderBy("elonScore", "desc"),
                limit(10)
            );

            let snapshot;
            try {
                snapshot = await getDocs(q);
            } catch(qErr) {
                console.warn("Elon leaderboard query failed:", qErr);
                skeleton.innerHTML = '';
                body.innerHTML = '<div style="text-align:center;color:#aaa;padding:20px">Could not load Elon scores. Try again later.</div>';
                body.style.display = 'block';
                return;
            }

            const entries = [];
            snapshot.forEach(docSnap => entries.push(docSnap.data()));

            // Secondary country lookup for entries missing country
            const namesToLookup = entries.filter(d => !d.country).map(d => d.name);
            const countryMap = {};
            if (namesToLookup.length > 0) {
                try {
                    const lookups = namesToLookup.map(n =>
                        getDocs(query(collection(db, 'users'), where('name', '==', n), limit(1)))
                    );
                    const results = await Promise.all(lookups);
                    results.forEach(snap => {
                        snap.forEach(udoc => {
                            const ud = udoc.data();
                            if (ud.name && ud.country) countryMap[ud.name] = ud.country;
                        });
                    });
                } catch(_e) {}
            }

            // Attach resolved countries
            entries.forEach(d => { if (!d.country && countryMap[d.name]) d.country = countryMap[d.name]; });

            skeleton.innerHTML = '';
            body.style.display = 'block';
            _renderElonLeaderboardRows(body, entries);

            window._lbCache[cacheKey] = { ts: Date.now(), entries };
        }

        function _renderElonLeaderboardRows(body, entries) {
            body.innerHTML = '';
            let rank = 1;
            entries.forEach(data => {
                const isYou = window._currentUser && data.uid && data.uid === window._currentUser.uid;
                const row = document.createElement('div');
                row.className = `leaderboard-row ${rank === 1 ? 'top1' : rank === 2 ? 'top2' : rank === 3 ? 'top3' : ''} ${isYou ? 'you' : ''}`;
                const _country = data.country || (isYou ? (window._currentUser?.country || '') : '');
                const _flag = getFlag(_country);
                const _date = fmtDate(data.updatedAt || data.time);
                let rankDisplay = rank;
                if (rank === 1) rankDisplay = "🥇";
                else if (rank === 2) rankDisplay = "🥈";
                else if (rank === 3) rankDisplay = "🥉";
                const _score = parseFloat(data.elonScore || 0).toFixed(2);
                row.innerHTML = `
                    <span class="rank">${rankDisplay}</span>
                    <span class="player"><span class="lb-player-name">${sanitizeStr(data.name)}</span></span>
                    <span class="lb-flag-cell" title="${sanitizeStr(_country)}">${_flag}</span>
                    <span style="font-weight:900;color:#00e6cc">${_score}</span>
                    <span style="color:#aaa;font-size:11px">⚡score</span>
                    <span class="lb-date-cell">${_date}</span>
                `;
                body.appendChild(row);
                rank++;
            });
        }

        // Save word-mode score to Firestore (typing_word_scores collection)
        async function saveWordScore(name, wordCount) {
            const authUser = auth.currentUser;
            if (!authUser) return;
            if (![10, 25, 50, 100].includes(wordCount)) return;

            const _now        = Date.now();
            const _elapsedMs  = startTime ? (_now - startTime) : 0;
            const _elapsedMin = _elapsedMs / 60000 || 0.001;
            const _wpm        = Math.max(0, Math.round(correctKeystrokes / 5 / _elapsedMin));
            const _typedErrors= Math.max(0, totalKeystrokes - correctKeystrokes);
            const _totalErrors= _typedErrors + (missedChars || 0);
            const _accuracy   = (correctKeystrokes + _totalErrors > 0)
                ? Math.round((correctKeystrokes / (correctKeystrokes + _totalErrors)) * 100) : 100;

            if (_wpm <= 0 || _wpm >= 220 || _accuracy < 50 || _elapsedMs < 2000) return;

            try {
                let verifiedName    = name;
                let verifiedCountry = window._currentUser?.country || '';
                try {
                    const userSnap = await getDoc(doc(db, 'users', authUser.uid));
                    if (userSnap.exists()) {
                        verifiedName    = userSnap.data().name    || name;
                        verifiedCountry = userSnap.data().country || '';
                    }
                } catch(_e) {}

                const docId  = `${authUser.uid}_${wordCount}`;
                const ref    = doc(db, "typing_word_scores", docId);
                const existing = await getDoc(ref);

                if (!existing.exists() || _wpm > (existing.data()?.wpm || 0)) {
                    await setDoc(ref, {
                        name:      verifiedName,
                        wpm:       _wpm,
                        accuracy:  _accuracy,
                        wordCount: wordCount,
                        country:   verifiedCountry,
                        uid:       authUser.uid,
                        time:      _now,
                        // Required by the hardened Firestore rules — see
                        // saveScore() above for why.
                        correctKeystrokes: correctKeystrokes,
                        keystrokeCount:    totalKeystrokes,
                        elapsedMs:         _elapsedMs
                    });
                }
            } catch(e) {
                console.warn("Word leaderboard save failed:", e);
            }
        }

        // PERF: Helper to render cached leaderboard entries without re-querying Firestore
        function _renderLeaderboardRows(body, entries) {
            body.innerHTML = '';
            let rank = 1;
            entries.forEach(data => {
                const isYou = window._currentUser && data.uid && data.uid === window._currentUser.uid;
                const row = document.createElement('div');
                row.className = `leaderboard-row ${rank === 1 ? 'top1' : rank === 2 ? 'top2' : rank === 3 ? 'top3' : ''} ${isYou ? 'you' : ''}`;
                const _country = data.country || (isYou ? (window._currentUser?.country || '') : '');
                const _flag = getFlag(_country);
                const _date = fmtDate(data.time);
                let rankDisplay = rank;
                if (rank === 1) rankDisplay = "🥇";
                else if (rank === 2) rankDisplay = "🥈";
                else if (rank === 3) rankDisplay = "🥉";
                row.innerHTML = `
                    <span class="rank">${rankDisplay}</span>
                    <span class="player"><span class="lb-player-name">${sanitizeStr(data.name)}</span></span>
                    <span class="lb-flag-cell" title="${sanitizeStr(_country)}">${_flag}</span>
                    <span style="font-weight:900;color:#ffd700">${sanitizeStr(data.wpm)}</span>
                    <span>${sanitizeStr(data.accuracy)}%</span>
                    <span class="lb-date-cell">${sanitizeStr(_date)}</span>
                `;
                body.appendChild(row);
                rank++;
            });
        }
        window.addEventListener('firebase-ready', () => loadLeaderboard());
        // Delegated (not a direct element listener) because #leaderboardModal is
        // lazy-loaded and may not exist in the DOM yet at this point.
        document.addEventListener("click", function (e) {
            const lm = document.getElementById("leaderboardModal");
            if (lm && e.target === lm) {
                closeLeaderboardModal();
            }
        });
    // ══════════════════════════════════════════════════════════════
    //  AUTH MODULE  — Rocket Typing v4
    //  Handles: email/password, Google OAuth, GitHub OAuth,
    //           forgot-password, password-strength, show/hide pw,
    //           username availability check, loading states.
    //  Security: Firebase Auth handles all password hashing (scrypt).
    //            Passwords never stored locally. Rate-limited by Firebase.
    // ══════════════════════════════════════════════════════════════

    // ── Open / Close ─────────────────────────────────────────────
    function openAuthModal(tab = 'login') {
        const mainInput = document.getElementById('input');
        if (mainInput) { mainInput.disabled = true; mainInput.blur(); }
        document.getElementById('authModal').style.display = 'flex';
        switchAuthTab(tab);
        setTimeout(() => {
            const field = tab === 'signup'
                ? document.getElementById('auth-signup-username')
                : document.getElementById('auth-login-email');
            if (field) field.focus();
        }, 120);
    }

    function closeAuthModal() {
        const mainInput = document.getElementById('input');
        if (mainInput) mainInput.disabled = false;
        document.getElementById('authModal').style.display = 'none';
        // Clear all error messages
        ['auth-login-error','auth-signup-error','auth-forgot-msg'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '';
        });
    }

    // Close on backdrop click
    document.getElementById('authModal').addEventListener('click', function(e) {
        if (e.target === this) closeAuthModal();
    });
    // Close on Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && document.getElementById('authModal').style.display === 'flex')
            closeAuthModal();
    });

    // ── Tab Switcher ──────────────────────────────────────────────
    function switchAuthTab(tab) {
        ['login','signup','forgot'].forEach(t => {
            const form = document.getElementById('form-' + t);
            if (form) form.style.display = t === tab ? 'block' : 'none';
        });
        const tLogin  = document.getElementById('tab-login');
        const tSignup = document.getElementById('tab-signup');
        const socialBtns = document.getElementById('auth-social-btns');
        // Show social buttons only on login + signup tabs
        if (socialBtns) socialBtns.style.display = (tab === 'forgot') ? 'none' : 'flex';
        if (tLogin) {
            tLogin.style.color = tab === 'login' ? '#e2b714' : '#646669';
            tLogin.style.borderBottomColor = tab === 'login' ? '#e2b714' : 'transparent';
        }
        if (tSignup) {
            tSignup.style.color = tab === 'signup' ? '#e2b714' : '#646669';
            tSignup.style.borderBottomColor = tab === 'signup' ? '#e2b714' : 'transparent';
        }
        // Pre-fill forgot email from login email
        if (tab === 'forgot') {
            const loginEmail = document.getElementById('auth-login-email');
            const forgotEmail = document.getElementById('auth-forgot-email');
            if (loginEmail && forgotEmail && loginEmail.value)
                forgotEmail.value = loginEmail.value;
        }
    }
    function showForgotPassword() { switchAuthTab('forgot'); }

    // ── Helpers ───────────────────────────────────────────────────
    function togglePw(inputId, btn) {
        const inp = document.getElementById(inputId);
        if (!inp) return;
        const show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        btn.textContent = show ? '🙈' : '👁';
    }

    function setAuthLoading(btnId, textId, loading, label) {
        const btn  = document.getElementById(btnId);
        const span = document.getElementById(textId);
        if (!btn || !span) return;
        if (loading) {
            btn.disabled = true;
            btn.style.opacity = '.75';
            span.innerHTML = '<span style="display:inline-block;animation:rtSpin .7s linear infinite">⟳</span> ' + (label || 'Please wait…');
        } else {
            btn.disabled = false;
            btn.style.opacity = '1';
            span.textContent = label;
        }
    }

    function showError(elId, msg) {
        const el = document.getElementById(elId);
        if (!el) return;
        el.textContent = msg;
        el.style.animation = 'none';
        void el.offsetWidth; // reflow
        el.style.animation = 'rtShake .35s ease';
    }

    function showSuccess(elId, msg) {
        const el = document.getElementById(elId);
        if (!el) return;
        el.textContent = msg;
        el.style.color = '#4caf50';
    }

    // ── Password Strength ─────────────────────────────────────────
    function updatePwStrength(pw) {
        const bar   = document.getElementById('pw-strength-bar');
        const label = document.getElementById('pw-strength-label');
        if (!bar || !label) return;
        let score = 0;
        if (pw.length >= 8)  score++;
        if (pw.length >= 12) score++;
        if (/[A-Z]/.test(pw)) score++;
        if (/[0-9]/.test(pw)) score++;
        if (/[^A-Za-z0-9]/.test(pw)) score++;
        const pct   = ['0%','25%','40%','65%','85%','100%'][score];
        const color = ['#444','#e74c3c','#e67e22','#f1c40f','#2ecc71','#00e6cc'][score];
        const text  = ['','Weak','Fair','Good','Strong','Very strong'][score];
        bar.style.width = pct;
        bar.style.background = color;
        label.textContent = text;
        label.style.color = color;
    }

    // ── Username field validation (live) ─────────────────────────
    function validateUsernameField(inp) {
        const val  = inp.value.trim().toLowerCase();
        const icon = document.getElementById('signup-username-icon');
        const hint = document.getElementById('signup-username-hint');
        if (!val) { if(icon) icon.textContent=''; if(hint) hint.textContent=''; return; }
        if (val.length < 3) {
            if(icon) icon.textContent='❌'; if(hint) { hint.textContent='Too short (min 3)'; hint.style.color='#ff6b6b'; } return;
        }
        if (!/^[a-z0-9_]+$/.test(val)) {
            if(icon) icon.textContent='❌'; if(hint) { hint.textContent='Only lowercase letters, numbers, _'; hint.style.color='#ff6b6b'; } return;
        }
        if(icon) icon.textContent='✅'; if(hint) { hint.textContent='Looks good!'; hint.style.color='#4caf50'; }
    }

    // ── Email/Password Login ──────────────────────────────────────
    async function doLogin() {
        const email    = document.getElementById('auth-login-email').value.trim();
        const password = document.getElementById('auth-login-password').value;
        const errEl    = document.getElementById('auth-login-error');
        errEl.style.color = '#ff6b6b';
        errEl.textContent = '';
        if (!email)    return showError('auth-login-error', 'Please enter your email.');
        if (!password) return showError('auth-login-error', 'Please enter your password.');
        setAuthLoading('btn-login','btn-login-text', true, 'Signing in…');
        try {
            const cred = await signInWithEmailAndPassword(auth, email, password);

            // ── Recovery path for previously "stuck" accounts ──
            // Old versions of signup could leave an email registered in
            // Firebase Auth with no matching /users/{uid} profile (e.g. the
            // profile save failed and the email got left behind). Instead of
            // leaving such accounts stranded, detect that here and let the
            // person finish registration with this same email right now.
            const userSnap = await getDoc(doc(db, 'users', cred.user.uid));
            if (!userSnap.exists()) {
                switchAuthTab('signup');
                const emailField = document.getElementById('auth-signup-email');
                if (emailField) { emailField.value = cred.user.email || ''; emailField.disabled = true; }
                window._pendingOAuthUser = cred.user;
                window._oauthSignupMode  = true;
                const sErrEl = document.getElementById('auth-signup-error');
                if (sErrEl) {
                    sErrEl.style.color = '#e2b714';
                    sErrEl.textContent = '✓ Signed in! Your earlier registration never finished — pick a username to complete it.';
                }
            } else {
                closeAuthModal();
            }
        } catch (e) {
            const msg = {
                'auth/invalid-credential':  'Wrong email or password.',
                'auth/user-not-found':       'Wrong email or password.',
                'auth/wrong-password':       'Wrong email or password.',
                'auth/too-many-requests':    'Too many attempts. Try again later or reset your password.',
                'auth/user-disabled':        'This account has been disabled.',
            }[e.code] || 'Login failed. Please try again.';
            showError('auth-login-error', msg);
        } finally {
            setAuthLoading('btn-login','btn-login-text', false, 'LOGIN →');
        }
    }

    // ── Email/Password Signup ─────────────────────────────────────
    // Registration is atomic from the user's perspective:
    //  1. Every check we CAN do before touching Firebase Auth happens first
    //     (field validation + username availability).
    //  2. createUserWithEmailAndPassword immediately reserves the email in
    //     Firebase Auth — there's no "dry run". So if ANYTHING after that
    //     point fails (username race condition, profile write failure,
    //     network error, etc.), we delete the Auth account we just created.
    //     That frees the email again so it doesn't get stuck as
    //     "already in use" with no working profile behind it.
    //  3. The email is only considered "activated" once the /users profile
    //     document has been written successfully.
    async function doSignup() {
        const username = document.getElementById('auth-signup-username').value.trim().toLowerCase();
        const country  = document.getElementById('auth-signup-country').value.trim();
        const email    = document.getElementById('auth-signup-email').value.trim();
        const password = document.getElementById('auth-signup-password').value;
        const errEl    = document.getElementById('auth-signup-error');
        errEl.style.color = '#ff6b6b';
        errEl.textContent = '';

        // Client-side validation
        if (username.length < 3 || username.length > 15)
            return showError('auth-signup-error', 'Username must be 3–15 characters.');
        if (!/^[a-z0-9_]+$/.test(username))
            return showError('auth-signup-error', 'Only lowercase letters, numbers, and _ allowed.');
        if (!country)  return showError('auth-signup-error', 'Please select your country.');
        if (!email)    return showError('auth-signup-error', 'Please enter your email.');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
            return showError('auth-signup-error', 'Please enter a valid email address.');
        if (password.length < 8)
            return showError('auth-signup-error', 'Password must be at least 8 characters.');

        setAuthLoading('btn-signup','btn-signup-text', true, 'Checking username…');

        // Tracks the Auth account created during this attempt, if any, so it
        // can be rolled back if the rest of registration doesn't complete.
        let cred = null;

        try {
            // STEP 1 — Username availability, checked BEFORE the email is
            // touched at all.
            let snap = await getDocs(query(collection(db, 'users'), where('name','==',username)));
            if (!snap.empty) return showError('auth-signup-error', 'Username taken. Please choose another.');

            // STEP 2 — Create the Firebase Auth account. From this point on
            // the email is reserved — any failure below must roll this back.
            setAuthLoading('btn-signup','btn-signup-text', true, 'Creating account…');
            cred = await createUserWithEmailAndPassword(auth, email, password);

            // STEP 3 — Re-check username right before saving the profile, to
            // guard against the rare race where someone else grabbed it in
            // the moment between step 1 and now.
            snap = await getDocs(query(collection(db, 'users'), where('name','==',username)));
            if (!snap.empty) throw { code: 'profile/username-taken-race' };

            // STEP 4 — Save the public profile to Firestore (no password
            // stored here). Registration only counts as complete once this
            // succeeds.
            await setDoc(doc(db, 'users', cred.user.uid), {
                name: username, country, uid: cred.user.uid, created: Date.now()
            });

            // Everything succeeded — the email is now fully activated.
            // Send email verification (non-blocking)
            sendEmailVerification(cred.user).catch(() => {});

            // ── Instant UI update ──────────────────────────────────────
            // onAuthStateChanged already fired once, back at STEP 2, the
            // moment createUserWithEmailAndPassword resolved — and at that
            // point this /users profile doc didn't exist yet, so it left
            // the header showing "LOGIN / SIGNUP". Firebase only re-fires
            // onAuthStateChanged on actual auth state transitions (not on
            // Firestore writes), so without this, the header would keep
            // showing "LOGIN / SIGNUP" until the next full page reload.
            // We already have every field we need in memory here, so we
            // update state + header directly — no extra network round trip.
            window._currentUser = { uid: cred.user.uid, email: cred.user.email, name: username, country };
            localStorage.setItem('rt_user_country', country);
            localStorage.setItem('rt_registered_name', username);
            updateAuthUI(true, username);

            closeAuthModal();
        } catch (e) {
            // Registration did not fully complete. If we created an Auth
            // account in this attempt, delete it so the email is freed up
            // again instead of being stuck "already in use" with no profile.
            if (cred && cred.user) {
                try { await deleteUser(cred.user); }
                catch (delErr) { console.warn('Rollback (deleteUser) failed:', delErr); }
            }

            const msg = {
                'auth/email-already-in-use': 'This email is already registered. Please log in — if registration never finished last time, logging in will let you complete it.',
                'auth/weak-password':         'Password must be at least 8 characters.',
                'auth/invalid-email':         'Please enter a valid email address.',
                'auth/too-many-requests':     'Too many attempts. Please try again later.',
                'profile/username-taken-race': 'That username was just taken by someone else. Please choose another.',
            }[e.code] || 'Signup failed. Please try again — your email has not been registered.';
            showError('auth-signup-error', msg);
            console.warn('Signup error:', e.code, e);
        } finally {
            setAuthLoading('btn-signup','btn-signup-text', false, 'CREATE ACCOUNT →');
        }
    }

    // ── Forgot Password ───────────────────────────────────────────
    async function doForgotPassword() {
        const email = document.getElementById('auth-forgot-email').value.trim();
        const msgEl = document.getElementById('auth-forgot-msg');
        msgEl.style.color = '#ff6b6b';
        msgEl.textContent = '';
        if (!email) return (msgEl.textContent = 'Please enter your email address.');
        const btn = document.getElementById('btn-forgot');
        btn.disabled = true; btn.style.opacity = '.7'; btn.textContent = 'Sending…';
        try {
            await sendPasswordResetEmail(auth, email);
            // Always show success (don't reveal if email exists — security best practice)
            msgEl.style.color = '#4caf50';
            msgEl.textContent = '✓ Reset link sent! Check your inbox (and spam folder).';
            document.getElementById('auth-forgot-email').value = '';
        } catch (e) {
            // Don't leak whether email exists
            msgEl.style.color = '#4caf50';
            msgEl.textContent = '✓ If that email is registered, a reset link was sent.';
        } finally {
            btn.disabled = false; btn.style.opacity = '1'; btn.textContent = 'SEND RESET LINK';
        }
    }

    // ── Social (Google / GitHub) Login ────────────────────────────
    async function doSocialLogin(provider) {
        const btnId = provider === 'google' ? 'btn-google' : 'btn-github';
        const btn   = document.getElementById(btnId);
        const origHTML = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.style.opacity = '.7'; btn.textContent = 'Opening…'; }

        // Determine which error element to show (whichever tab is active)
        const errElId = document.getElementById('form-login').style.display !== 'none'
            ? 'auth-login-error' : 'auth-signup-error';

        try {
            let p;
            if (provider === 'google') {
                p = new GoogleAuthProvider();
                p.setCustomParameters({ prompt: 'select_account' });
            } else {
                p = new GithubAuthProvider();
            }
            const result = await signInWithPopup(auth, p);
            const user   = result.user;

            // Check if a Firestore profile already exists
            const userSnap = await getDoc(doc(db, 'users', user.uid));
            if (!userSnap.exists()) {
                // First OAuth login — ask for username + country
                switchAuthTab('signup');
                const emailField = document.getElementById('auth-signup-email');
                if (emailField) { emailField.value = user.email || ''; emailField.disabled = true; }
                window._pendingOAuthUser = user;
                window._oauthSignupMode  = true;
                const errEl = document.getElementById('auth-signup-error');
                if (errEl) {
                    errEl.style.color = '#e2b714';
                    errEl.textContent = '✓ Signed in with ' + (provider === 'google' ? 'Google' : 'GitHub') + '! Now pick a username to finish.';
                }
            } else {
                closeAuthModal();
            }
        } catch (e) {
            console.warn('Social login error:', e.code, e.message);
            if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
                // User closed popup — silent
            } else if (e.code === 'auth/popup-blocked') {
                showError(errElId, 'Popup was blocked. Please allow popups for this site and try again.');
            } else if (e.code === 'auth/unauthorized-domain') {
                showError(errElId, 'This domain is not authorized. Add it in Firebase Console → Authentication → Authorized Domains.');
            } else if (e.code === 'auth/account-exists-with-different-credential') {
                showError(errElId, 'An account already exists with the same email. Try logging in with email/password instead.');
            } else {
                showError(errElId, (provider === 'github' ? 'GitHub' : 'Google') + ' sign-in failed. (' + (e.code || e.message) + ')');
            }
        } finally {
            if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.innerHTML = origHTML; }
        }
    }

    // Override doSignup to handle OAuth completion mode
    const _origDoSignup = window.doSignup;
    (function patchOAuthSignup() {
        const originalDoSignup = doSignup;
        window.doSignup = async function() {
            if (!window._oauthSignupMode) return originalDoSignup();
            const username = document.getElementById('auth-signup-username').value.trim().toLowerCase();
            const country  = document.getElementById('auth-signup-country').value.trim();
            const errEl    = document.getElementById('auth-signup-error');
            errEl.style.color = '#ff6b6b';
            errEl.textContent = '';
            if (username.length < 3 || username.length > 15)
                return showError('auth-signup-error', 'Username must be 3–15 characters.');
            if (!/^[a-z0-9_]+$/.test(username))
                return showError('auth-signup-error', 'Only lowercase letters, numbers, and _ allowed.');
            if (!country) return showError('auth-signup-error', 'Please select your country.');

            setAuthLoading('btn-signup','btn-signup-text', true, 'Saving profile…');
            try {
                const snap = await getDocs(query(collection(db, 'users'), where('name','==',username)));
                if (!snap.empty) return showError('auth-signup-error', 'Username taken.');
                const oUser = window._pendingOAuthUser || auth.currentUser;
                await setDoc(doc(db, 'users', oUser.uid), {
                    name: username, country, uid: oUser.uid, created: Date.now()
                });
                // Instant UI update — same reasoning as doSignup() above:
                // onAuthStateChanged already fired for this OAuth sign-in
                // before this profile doc existed, so it won't fire again
                // on its own now that the doc has been written.
                window._currentUser = { uid: oUser.uid, email: oUser.email, name: username, country };
                localStorage.setItem('rt_user_country', country);
                localStorage.setItem('rt_registered_name', username);
                updateAuthUI(true, username);
                window._pendingOAuthUser = null;
                window._oauthSignupMode  = false;
                closeAuthModal();
            } catch (e) {
                showError('auth-signup-error', 'Failed to save profile. Please try again.');
            } finally {
                setAuthLoading('btn-signup','btn-signup-text', false, 'CREATE ACCOUNT →');
            }
        };
    })();

    // ── Sign Out ──────────────────────────────────────────────────
    async function doSignOut() {
        await signOut(auth);
    }

    // ── Expose ALL auth functions to global scope (required for onclick= in HTML) ──
    window.openAuthModal       = openAuthModal;
    window.closeAuthModal      = closeAuthModal;
    window.switchAuthTab       = switchAuthTab;
    window.showForgotPassword  = showForgotPassword;
    window.togglePw            = togglePw;
    window.updatePwStrength    = updatePwStrength;
    window.validateUsernameField = validateUsernameField;
    window.doLogin             = doLogin;
    window.doSignup            = doSignup;
    window.doForgotPassword    = doForgotPassword;
    window.doSocialLogin       = doSocialLogin;
    window.doSignOut           = doSignOut;

// ══════════════════════════════════════════════════════════════
//  PROFILE MODAL MODULE
//  Shows user stats: country, avg/high/low speed, accuracy,
//  consistency, total tests, rank, recent history, avatar upload.
// ══════════════════════════════════════════════════════════════

window.openProfileModal = async function() {
    const user = window._currentUser;
    if (!user) {
        openAuthModal('login');
        if (window.location.pathname === '/profile') {
            window.history.replaceState({}, '', '/');
        }
        return;
    }

    if (window.location.pathname !== '/profile') {
        window.history.pushState({ modal: 'profile' }, '', '/profile');
    }
    document.title = 'Profile | Rocket Typing';

    await ensureProfileModalLoaded();

    const modal = document.getElementById('profileModal');
    modal.classList.add('open');
    // Prevent scrolling on body
    document.body.style.overflow = 'hidden';

    // Show loading
    document.getElementById('pm-loading').style.display = 'block';
    document.getElementById('pm-content').style.display = 'none';

    // Render avatar immediately (from localStorage cache)
    _renderProfileAvatar(user.uid, user.name);

    // ── Instagram-style crop picker ──────────────────────────────
    // Inject crop modal styles once
    if (!document.getElementById('pm-crop-styles')) {
        const cropStyle = document.createElement('style');
        cropStyle.id = 'pm-crop-styles';
        cropStyle.textContent = `
        #pm-crop-overlay {
            position:fixed;inset:0;background:rgba(0,0,0,0.92);
            z-index:9999;display:none;align-items:center;justify-content:center;flex-direction:column;
        }
        #pm-crop-overlay.open{display:flex;}
        #pm-crop-box {
            background:#111;border-radius:16px;padding:20px;
            display:flex;flex-direction:column;align-items:center;gap:14px;
            max-width:340px;width:90vw;
            font-family:'Roboto Mono',monospace;
            border:1px solid rgba(226,183,20,0.3);
        }
        #pm-crop-title{color:#e2b714;font-size:13px;letter-spacing:1px;font-weight:900;}
        #pm-crop-hint{color:#666;font-size:11px;text-align:center;}
        #pm-crop-viewport{
            width:240px;height:240px;border-radius:50%;
            overflow:hidden;position:relative;
            border:3px solid #e2b714;
            box-shadow:0 0 0 4px rgba(226,183,20,0.15);
            cursor:grab;user-select:none;
            background:#000;flex-shrink:0;
        }
        #pm-crop-viewport:active{cursor:grabbing;}
        #pm-crop-img{
            position:absolute;
            transform-origin:0 0;
            pointer-events:none;
            image-rendering:auto;
        }
        #pm-crop-scale-row{display:flex;align-items:center;gap:10px;width:240px;}
        #pm-crop-scale-row label{color:#888;font-size:10px;letter-spacing:.5px;white-space:nowrap;}
        #pm-crop-scale{flex:1;accent-color:#e2b714;}
        #pm-crop-actions{display:flex;gap:10px;}
        .pm-crop-btn{
            padding:8px 22px;border-radius:20px;font-family:'Roboto Mono',monospace;
            font-size:12px;font-weight:900;letter-spacing:1px;cursor:pointer;border:none;
        }
        .pm-crop-btn.save{background:linear-gradient(135deg,#e2b714,#ff9900);color:#0a0a23;}
        .pm-crop-btn.cancel{background:rgba(255,255,255,0.07);color:#888;border:1px solid rgba(255,255,255,0.12);}

        /* ── Lightbox ── */
        #pm-lightbox{
            position:fixed;inset:0;background:rgba(0,0,0,0.92);
            z-index:9998;display:none;align-items:center;justify-content:center;
            cursor:zoom-out;
        }
        #pm-lightbox.open{display:flex;}
        #pm-lightbox img{
            max-width:min(90vw,500px);max-height:min(90vh,500px);
            border-radius:50%;border:4px solid #e2b714;
            box-shadow:0 0 60px rgba(226,183,20,0.4);
            pointer-events:none;
        }
        `;
        document.head.appendChild(cropStyle);
    }

    // Inject crop overlay DOM once
    if (!document.getElementById('pm-crop-overlay')) {
        document.body.insertAdjacentHTML('beforeend', `
        <div id="pm-crop-overlay">
          <div id="pm-crop-box">
            <div id="pm-crop-title">✂ POSITION YOUR PHOTO</div>
            <div id="pm-crop-hint">Drag to reposition · Scroll or use slider to zoom</div>
            <div id="pm-crop-viewport"><img id="pm-crop-img" draggable="false"></div>
            <div id="pm-crop-scale-row">
              <label for="pm-crop-scale">ZOOM</label>
              <input type="range" id="pm-crop-scale" min="1" max="3" step="0.01" value="1">
            </div>
            <div id="pm-crop-actions">
              <button class="pm-crop-btn cancel" id="pm-crop-cancel">Cancel</button>
              <button class="pm-crop-btn save" id="pm-crop-save">Save Photo</button>
            </div>
          </div>
        </div>
        <div id="pm-lightbox"><img id="pm-lightbox-img" src="" alt="Profile photo"></div>
        `);
    }

    // ── Crop logic ────────────────────────────────────────────────
    const cropOverlay  = document.getElementById('pm-crop-overlay');
    const cropImg      = document.getElementById('pm-crop-img');
    const cropVP       = document.getElementById('pm-crop-viewport');
    const cropScale    = document.getElementById('pm-crop-scale');
    const cropSaveBtn  = document.getElementById('pm-crop-save');
    const cropCancelBtn= document.getElementById('pm-crop-cancel');

    let _cropState = { x:0, y:0, scale:1, natW:0, natH:0 };

    function _applyCropTransform() {
        const { x, y, scale } = _cropState;
        cropImg.style.transform = `translate(${x}px,${y}px) scale(${scale})`;
    }

    function _clampCrop() {
        const { scale, natW, natH } = _cropState;
        const vp = 240;
        const imgW = natW * scale, imgH = natH * scale;
        _cropState.x = Math.min(0, Math.max(_cropState.x, vp - imgW));
        _cropState.y = Math.min(0, Math.max(_cropState.y, vp - imgH));
    }

    // Drag
    let _dragging = false, _dx = 0, _dy = 0;
    cropVP.addEventListener('mousedown', function(e) {
        _dragging = true; _dx = e.clientX - _cropState.x; _dy = e.clientY - _cropState.y;
        e.preventDefault();
    });
    document.addEventListener('mousemove', function(e) {
        if (!_dragging) return;
        _cropState.x = e.clientX - _dx; _cropState.y = e.clientY - _dy;
        _clampCrop(); _applyCropTransform();
    });
    document.addEventListener('mouseup', function() { _dragging = false; });

    // Touch drag
    let _tx = 0, _ty = 0;
    cropVP.addEventListener('touchstart', function(e) {
        const t = e.touches[0];
        _dragging = true; _tx = t.clientX - _cropState.x; _ty = t.clientY - _cropState.y;
        e.preventDefault();
    }, {passive:false});
    cropVP.addEventListener('touchmove', function(e) {
        if (!_dragging) return;
        const t = e.touches[0];
        _cropState.x = t.clientX - _tx; _cropState.y = t.clientY - _ty;
        _clampCrop(); _applyCropTransform();
        e.preventDefault();
    }, {passive:false});
    cropVP.addEventListener('touchend', function() { _dragging = false; });

    // Scroll to zoom
    cropVP.addEventListener('wheel', function(e) {
        e.preventDefault();
        const oldScale = _cropState.scale;
        _cropState.scale = Math.max(1, Math.min(3, oldScale - e.deltaY * 0.005));
        cropScale.value = _cropState.scale;
        _clampCrop(); _applyCropTransform();
    }, {passive:false});

    // Slider zoom
    cropScale.addEventListener('input', function() {
        _cropState.scale = parseFloat(cropScale.value);
        _clampCrop(); _applyCropTransform();
    });

    // Cancel
    cropCancelBtn.addEventListener('click', function() {
        cropOverlay.classList.remove('open');
    });

    // Save: render cropped circle to canvas
    cropSaveBtn.addEventListener('click', function() {
        const vp = 240;
        const canvas = document.createElement('canvas');
        canvas.width = vp; canvas.height = vp;
        const ctx2 = canvas.getContext('2d');
        ctx2.drawImage(
            cropImg,
            -_cropState.x / _cropState.scale,
            -_cropState.y / _cropState.scale,
            vp / _cropState.scale,
            vp / _cropState.scale,
            0, 0, vp, vp
        );
        const resized = canvas.toDataURL('image/jpeg', 0.88);
        try {
            localStorage.setItem('rt_avatar_' + user.uid, resized);
        } catch(storageErr) {
            window._profileAvatarSession = resized;
        }
        _renderProfileAvatar(user.uid, user.name);
        updateAuthUI(true, user.name);
        document.getElementById('pm-add-photo-label').textContent = '✓ PHOTO SAVED';
        setTimeout(() => {
            document.getElementById('pm-add-photo-label').textContent = '✎ CHANGE PHOTO';
        }, 2000);
        cropOverlay.classList.remove('open');
    });

    // ── File input — open crop picker (no size limit) ─────────────
    const avatarInput = document.getElementById('pm-avatar-input');
    avatarInput.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        // No size limit — removed
        const reader = new FileReader();
        reader.onload = function(ev) {
            const base64 = ev.target.result;
            const img = new Image();
            img.onload = function() {
                _cropState.natW = img.naturalWidth;
                _cropState.natH = img.naturalHeight;
                _cropState.scale = 1;
                cropScale.value = 1;
                // Fit image inside 240px viewport initially
                const vp = 240;
                const fitScale = Math.max(vp / img.naturalWidth, vp / img.naturalHeight);
                _cropState.scale = fitScale;
                cropScale.min = fitScale.toFixed(3);
                cropScale.value = fitScale;
                cropImg.style.width = img.naturalWidth + 'px';
                cropImg.style.height = img.naturalHeight + 'px';
                cropImg.src = base64;
                // Center initially
                _cropState.x = (vp - img.naturalWidth * fitScale) / 2;
                _cropState.y = (vp - img.naturalHeight * fitScale) / 2;
                _applyCropTransform();
                cropOverlay.classList.add('open');
            };
            img.src = base64;
        };
        reader.readAsDataURL(file);
        // Reset input so same file can be re-selected
        avatarInput.value = '';
    };

    // ── Lightbox: click avatar to view full ──────────────────────
    const lightbox    = document.getElementById('pm-lightbox');
    const lightboxImg = document.getElementById('pm-lightbox-img');
    const avatarRing  = document.getElementById('pm-avatar-ring');

    // We intercept click on avatar ring for lightbox (only when photo exists)
    // Override the pm-avatar-wrap click to check photo first
    const avatarWrap = avatarRing ? avatarRing.parentElement : null;
    if (avatarWrap) {
        // Remove old inline onclick
        avatarWrap.removeAttribute('onclick');
        avatarWrap.addEventListener('click', function(e) {
            const saved = localStorage.getItem('rt_avatar_' + user.uid) || window._profileAvatarSession;
            if (saved) {
                // Show lightbox
                lightboxImg.src = saved;
                lightbox.classList.add('open');
            } else {
                // No photo yet — open file picker
                document.getElementById('pm-avatar-input').click();
            }
        });
    }

    // Close lightbox on click anywhere
    lightbox.addEventListener('click', function() {
        lightbox.classList.remove('open');
    });

    // Lightbox: also allow changing photo via long-press or by clicking ✎ CHANGE PHOTO label
    document.getElementById('pm-add-photo-label').addEventListener('click', function(e) {
        e.stopPropagation();
        document.getElementById('pm-avatar-input').click();
    });

    // Close on backdrop click
    modal.onclick = function(e) { if (e.target === modal) closeProfileModal(); };

    // Escape key
    document._pmEscHandler = function(e) {
        if (e.key === 'Escape') closeProfileModal();
    };
    document.addEventListener('keydown', document._pmEscHandler);

    // Load stats from localStorage — zero Firestore reads for profile stats
    try {
        // ── All-time stats from the lightweight aggregate key ──────────────
        const AGG_KEY = 'rt_agg_' + user.uid;
        let agg = {};
        try { agg = JSON.parse(localStorage.getItem(AGG_KEY) || '{}'); } catch(_e) { agg = {}; }

        // ── Recent list (capped at 200) for the dashboard table ───────────
        const LS_KEY = 'rt_scores_' + user.uid;
        let recentList = [];
        try { recentList = JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch(_e) { recentList = []; }

        // ── Back-fill aggregate from legacy recent list if aggregate is empty ──
        // (first open after update — migrate existing data once)
        if (!agg.count && recentList.length > 0) {
            // Only count tests that meet the qualification criteria:
            // time mode: duration >= 10s | words mode: wordCount >= 10 AND elapsedSecs >= 10 | quotes: elapsedSecs >= 10 AND words >= 10
            const qualifiedList = recentList.filter(r => {
                if (r.testDuration != null) {
                    // time mode
                    return r.testDuration >= 10;
                } else if (r.mode === 'words') {
                    return (r.wordCount || 0) >= 10; // no time gate for words
                } else if (r.mode === 'quotes') {
                    return (r.wordCount == null || r.wordCount >= 10); // no time gate for quotes
                }
                return true;
            });
            if (qualifiedList.length > 0) {
                agg.count     = qualifiedList.length;
                agg.wpmSum    = qualifiedList.reduce((s, r) => s + (r.wpm      || 0), 0);
                agg.accSum    = qualifiedList.reduce((s, r) => s + (r.accuracy || 0), 0);
                agg.bestWpm   = Math.max(...qualifiedList.map(r => r.wpm || 0));
                agg.lowestWpm = Math.min(...qualifiedList.map(r => r.wpm || Infinity));
                const consRaw = qualifiedList.filter(r => r.consistency != null && r.consistency > 0);
                if (consRaw.length > 0) {
                    agg.consSum   = consRaw.reduce((s, r) => s + r.consistency, 0);
                    agg.consCount = consRaw.length;
                }
            }
            try { localStorage.setItem(AGG_KEY, JSON.stringify(agg)); } catch(_e) {}
        }

        // ── Derive display values from aggregate ──────────────────────────
        const totalTests = agg.count  || 0;
        const bestWpm    = agg.bestWpm || 0;
        const lowWpm     = agg.lowestWpm || 0;
        const avgWpm     = totalTests > 0 ? Math.round(agg.wpmSum / totalTests) : 0;
        const avgAcc     = totalTests > 0 ? Math.round(agg.accSum / totalTests) : 0;
        const avgCons    = (agg.consCount > 0)
            ? Math.round(agg.consSum / agg.consCount) : null;

        // wpmValues kept minimal — only used for speed-bar "more than 1 test" gate
        const wpmValues = totalTests > 0 ? [lowWpm, avgWpm, bestWpm] : [];

        // Member since — stored locally on first test
        const JOIN_KEY = 'rt_joined_' + user.uid;
        if (!localStorage.getItem(JOIN_KEY) && recentList.length > 0) {
            // Backfill from earliest score if available
            const earliest = Math.min(...recentList.map(s => s.time || Date.now()));
            localStorage.setItem(JOIN_KEY, earliest.toString());
        } else if (!localStorage.getItem(JOIN_KEY)) {
            localStorage.setItem(JOIN_KEY, Date.now().toString());
        }
        const createdTs = parseInt(localStorage.getItem(JOIN_KEY)) || null;
        const memberSince = createdTs ? 'Member since ' + fmtDate(createdTs) : '';

        // Country — from session only, no Firestore needed
        const country = user.country || '';

        // Rank badge based on best WPM
        const rank = _getRankBadge(bestWpm);

        // Recent scores sorted by date — show up to 200 (from recent list)
        // Filter: words/quotes mode requires wordCount >= 10 only (no time gate)
        const recentScores = recentList
            .filter(r => {
                if (r.mode === 'words')  return (r.wordCount || 0) >= 10;
                if (r.mode === 'quotes') return (r.wordCount == null || r.wordCount >= 10);
                return true; // time mode: show all
            })
            .slice()
            .sort((a,b) => (b.time||0) - (a.time||0));

        // ── Render ──
        document.getElementById('pm-loading').style.display = 'none';
        document.getElementById('pm-content').style.display = 'block';

        document.getElementById('pm-username-display').textContent = user.name || '—';

        // Country row
        const _safeCountry = sanitizeStr(country);
        const flagHtml = country
            ? (COUNTRY_FLAGS[country]
                ? `<img src="${COUNTRY_FLAGS[country]}" alt="${_safeCountry}" width="22" height="16" style="width:22px;height:16px;object-fit:contain;"> ${_safeCountry}`
                : `🌍 ${_safeCountry}`)
            : '<span style="color:#444">No country set</span>';
        document.getElementById('pm-country-row').innerHTML = flagHtml;

        document.getElementById('pm-member-since').textContent = memberSince;

        // Rank badge
        document.getElementById('pm-rank-badge').innerHTML =
            `<span class="pm-rank-badge" style="background:${rank.bg};color:${rank.color};border:1px solid ${rank.color}40;">${rank.icon} ${rank.label}</span>`;

        // ── Musk Score ──
        _renderMuskScore(user.uid);

        // Stats
        document.getElementById('pm-avg-wpm').textContent  = avgWpm  || '—';
        document.getElementById('pm-best-wpm').textContent = bestWpm || '—';
        document.getElementById('pm-total-tests').textContent = totalTests || '0';
        document.getElementById('pm-accuracy').textContent    = avgAcc ? avgAcc + '%' : '—';
        document.getElementById('pm-consistency').textContent = avgCons != null ? avgCons + '%' : '—';

        // Speed breakdown (only if has scores)
        if (wpmValues.length > 1) {
            document.getElementById('pm-speed-breakdown').style.display = 'grid';
            document.getElementById('pm-low-wpm').textContent  = lowWpm;
            document.getElementById('pm-avg-wpm2').textContent = avgWpm;
            document.getElementById('pm-high-wpm').textContent = bestWpm;

            // Speed bar: position avg within [low, high] range
            const barWrap = document.getElementById('pm-speed-bar-wrap');
            barWrap.style.display = 'block';
            document.getElementById('pm-bar-low-label').textContent  = lowWpm + ' WPM';
            document.getElementById('pm-bar-high-label').textContent = bestWpm + ' WPM';
            document.getElementById('pm-bar-avg-label').textContent  = 'AVG ' + avgWpm + ' WPM';
            const range = bestWpm - lowWpm;
            const pct = range > 0 ? Math.round(((avgWpm - lowWpm) / range) * 100) : 50;
            setTimeout(() => {
                document.getElementById('pm-speed-bar').style.width = Math.max(5, Math.min(100, pct)) + '%';
            }, 200);
        }

        // Recent tests
        if (recentScores.length > 0) {
            document.getElementById('pm-recent-divider').style.display = 'block';
            document.getElementById('pm-recent-section').style.display = 'block';
            const list = document.getElementById('pm-recent-list');
            list.innerHTML = '';
            recentScores.forEach(s => {
                // -- Per-mode minimum thresholds (time >= 10s AND words >= 10) --
                if (s.testDuration != null) {
                    // time mode: skip tests shorter than 10 seconds
                    if (s.testDuration < 10) return;
                } else if (s.mode === 'words') {
                    // words mode: only gate is wordCount >= 10 (no time minimum)
                    if ((s.wordCount || 0) < 10) return;
                } else if (s.mode === 'quotes') {
                    // quotes mode: only gate is wordCount >= 10 (no time minimum)
                    if (s.wordCount != null && s.wordCount < 10) return;
                }

                // -- Mode label formatting --
                let modeLabel;
                if (s.testDuration) {
                    modeLabel = 'time ' + s.testDuration + 's';
                } else if (s.mode === 'words') {
                    modeLabel = 'words ' + (s.wordCount || '');
                } else if (s.mode === 'quotes') {
                    modeLabel = 'quote (' + (s.elapsedSecs || '?') + 's)';
                } else {
                    modeLabel = s.mode || '—';
                }

                const row = document.createElement('div');
                row.className = 'pm-recent-row';
                row.innerHTML = `
                    <span style="color:#646669;">${sanitizeStr(modeLabel)}</span>
                    <span>${sanitizeStr(s.wpm)} <span style="font-size:9px;color:#888">wpm</span></span>
                    <span>${sanitizeStr(s.accuracy)}%</span>
                    <span>${sanitizeStr(fmtDate(s.time))}</span>
                `;
                list.appendChild(row);
            });
        }

    } catch(err) {
        console.warn('Profile load error:', err);
        document.getElementById('pm-loading').innerHTML =
            '<span style="color:#ff6b6b;">Failed to load profile. Please try again.</span>';
    }
};

function _renderProfileAvatar(uid, name) {
    const ring = document.getElementById('pm-avatar-ring');
    if (!ring) return;
    const saved = (uid && localStorage.getItem('rt_avatar_' + uid))
               || window._profileAvatarSession;
    const label = document.getElementById('pm-add-photo-label');
    if (saved) {
        ring.innerHTML = `<img src="${saved}" alt="Profile photo">`;
        if (label) label.textContent = '✎ CHANGE PHOTO';
    } else {
        const initial = sanitizeStr((name || '?')[0].toUpperCase());
        ring.innerHTML = `<div class="pm-avatar-initial">${initial}</div>`;
        if (label) label.textContent = '+ ADD PHOTO';
    }
}

function _getRankBadge(bestWpm) {
    if (bestWpm >= 120) return { label:'SUPERSONIC', icon:'🌌', bg:'rgba(138,43,226,0.15)', color:'#c084fc' };
    if (bestWpm >= 90)  return { label:'ELITE PILOT', icon:'🚀', bg:'rgba(226,183,20,0.12)', color:'#ffd700' };
    if (bestWpm >= 70)  return { label:'FAST TYPER', icon:'⚡', bg:'rgba(0,230,204,0.1)',   color:'#00e6cc' };
    if (bestWpm >= 50)  return { label:'REGULAR',    icon:'🌠', bg:'rgba(59,130,246,0.12)', color:'#60a5fa' };
    if (bestWpm >= 30)  return { label:'ROOKIE',     icon:'🌟', bg:'rgba(255,153,0,0.1)',   color:'#ff9900' };
    return                       { label:'BEGINNER',  icon:'🐣', bg:'rgba(255,255,255,0.05)',color:'#888' };
}

// ══════════════════════════════════════════════════════════════
//  MUSK SCORE MODULE
// ══════════════════════════════════════════════════════════════

/* Show the milestone toast with confetti */
function _showMuskToast(score, totalSecs) {
    const toast = document.getElementById('musk-milestone-toast');
    if (!toast) return;
    document.getElementById('musk-toast-score').textContent = score;
    document.getElementById('musk-toast-secs').textContent  = totalSecs + 's';
    toast.classList.add('show');
    // confetti burst
    try {
        fireConfetti({ particleCount: 120, spread: 80, origin: { y: 0.8 },
            colors: ['#ffd700','#ff9900','#ff6600','#ffffff'] });
    } catch(e) {}
    clearTimeout(window._muskToastTimer);
    window._muskToastTimer = setTimeout(function() {
        toast.classList.remove('show');
    }, 4000);
}

/* ─────────────────────────────────────────────────────────────
   MUSK SCORE GAIN ANIMATION
   Called when the user returns to the test page after a session.
   Shows the old score → floating "+N" → new score with pop.
───────────────────────────────────────────────────────────── */
function _animateMuskGain(prevScore, delta, newScore) {
    var numEl  = document.getElementById('km-musk-num');
    var badge  = document.getElementById('km-musk-badge');
    if (!numEl || !badge) return;

    // Step 1: briefly show OLD score
    numEl.textContent = prevScore;

    // Step 2: after a short pause, create the floating "+N" chip
    setTimeout(function() {
        // Build the +N overlay
        var chip = document.createElement('div');
        chip.className = 'musk-gain-chip';
        chip.textContent = '+' + delta;
        badge.style.position = 'relative';
        badge.appendChild(chip);

        // Trigger the float-up animation on next frame
        requestAnimationFrame(function() {
            requestAnimationFrame(function() {
                chip.classList.add('musk-gain-chip--fly');
            });
        });

        // Step 3: after chip is midway, update the number with a pop
        setTimeout(function() {
            numEl.textContent = newScore;
            numEl.classList.remove('km-pop');
            void numEl.offsetWidth;
            numEl.classList.add('km-pop');
            setTimeout(function() { numEl.classList.remove('km-pop'); }, 600);

            // Step 4: remove chip after it finishes floating
            setTimeout(function() {
                if (chip.parentNode) chip.parentNode.removeChild(chip);
            }, 900);
        }, 420);

    }, 350);
}

/* ══════════════════════════════════════════════
   ELON SCORE v4 — Musk-based session formula
   ──────────────────────────────────────────────
   Session boundary = every 60 Musk (3600 seconds of typing time).
   Musk is stored in localStorage as total seconds typed (rt_musk_<uid>).

   Elon Score is ONLY recalculated when the user's total Musk crosses
   a new multiple of 3600s (i.e. Musk = 60, 120, 180, …).
   It stays frozen between those boundaries.

   Formula (per completed 60-Musk session):
     Current Session Score = (avgWPM + avgAcc) / 100
     Previous Session Score = (prevSession avgWPM + prevSession avgAcc) / 100
     Improvement           = max(0, CurrentSessionScore − PreviousSessionScore)
     Final Elon Score      = PreviousElonScore + CurrentSessionScore + Improvement

   NOTE: Improvement compares the two session scores, NOT the session score
   vs the cumulative Elon Score.

   State stored per user in localStorage (rt_elon_<uid>):
     {
       elonScore       : number,  // locked Elon Score after last completed session
       prevSessScore   : number,  // (avgWPM + avgAcc)/100 of the PREVIOUS session
       session : {
         muskAtStart : number,    // total Musk seconds when this session began
         wpmSum      : number,
         accSum      : number,
         count       : number
       }
     }
══════════════════════════════════════════════ */
var ELON_SESSION_SECS = 3600; // 60 Musk = 3600 seconds of typing time

function _getElonState(uid) {
    try { return JSON.parse(localStorage.getItem('rt_elon_' + uid) || '{}'); }
    catch(e) { return {}; }
}

function _saveElonState(uid, state) {
    try { localStorage.setItem('rt_elon_' + uid, JSON.stringify(state)); } catch(e) {}
    // Persist to Firestore elon_scores for leaderboard (only when score increased)
    var newScore = state.elonScore || 0;
    if (newScore > 0 && window.db && window.doc && window.setDoc) {
        try {
            var _uname   = (window._currentUser && window._currentUser.displayName) || localStorage.getItem('rt_registered_name') || '';
            var _country = (window._currentUser && window._currentUser.country) || localStorage.getItem('rt_user_country') || '';
            window.setDoc(
                window.doc(window.db, 'elon_scores', uid),
                {
                    uid:        uid,
                    name:       _uname,
                    country:    _country,
                    elonScore:  parseFloat(newScore.toFixed(4)),
                    updatedAt:  Date.now()
                },
                { merge: true }
            ).catch(function(_fe) { console.warn('Elon leaderboard save failed:', _fe); });
        } catch(_se) {}
    }
}

/**
 * Returns the current locked Elon Score.
 * Score is frozen mid-session; only updates at 60-Musk boundaries.
 */
function _computeElonScore(state) {
    return state.elonScore || 0;
}

/**
 * Called after every completed typing test.
 *
 * totalMuskSecs — the user's CURRENT total Musk seconds (from rt_musk_<uid>)
 *                 AFTER the just-completed test has already been added.
 *
 * Session boundary logic:
 *   - Each session spans exactly 3600 Musk-seconds.
 *   - session.muskAtStart marks where the current session began.
 *   - If (totalMuskSecs - muskAtStart) >= 3600, the session is complete:
 *       1. Finalise Elon Score using this session's data.
 *       2. Save prevSessScore for the next session's improvement calc.
 *       3. Open a new session starting at the exact 3600-second boundary.
 *          Any seconds beyond the boundary belong to the NEW session.
 *   - Otherwise just accumulate WPM/accuracy; score stays frozen.
 *
 * Returns the current locked Elon Score.
 */
function updateElonScoreAfterTest(uid, wpm, accuracy, totalMuskSecs) {
    var state   = _getElonState(uid);
    var session = state.session;

    // Initialise session on very first call
    if (!session) {
        state.session = {
            muskAtStart : 0,
            wpmSum      : wpm,
            accSum      : accuracy,
            count       : 1
        };
        _saveElonState(uid, state);
        return state.elonScore || 0;
    }

    var elapsed = totalMuskSecs - session.muskAtStart;

    if (elapsed >= ELON_SESSION_SECS) {
        // ── Session complete: finalise Elon Score ──────────────────────

        // Include this test's data in the completing session
        session.wpmSum += wpm;
        session.accSum += accuracy;
        session.count  += 1;

        var avgWpm             = session.wpmSum / session.count;
        var avgAcc             = session.accSum / session.count;
        var currentSessScore   = (avgWpm + avgAcc) / 100;
        var prevSessScore      = state.prevSessScore || 0;        // previous session's score
        var improvement        = (prevSessScore === 0) ? 0 : Math.max(0, currentSessScore - prevSessScore);
        var prevElonScore      = state.elonScore || 0;

        state.elonScore      = prevElonScore + currentSessScore + improvement;
        state.prevSessScore  = currentSessScore;  // becomes "previous" for next session

        // New session starts at the exact boundary, not at the current moment.
        // Seconds beyond the boundary carry over into the new session.
        var newSessionStart   = session.muskAtStart + ELON_SESSION_SECS;
        state.session = {
            muskAtStart : newSessionStart,
            wpmSum      : 0,
            accSum      : 0,
            count       : 0
        };

    } else {
        // ── Mid-session: accumulate only, score stays frozen ──────────
        session.wpmSum += wpm;
        session.accSum += accuracy;
        session.count  += 1;
        state.session   = session;
    }

    _saveElonState(uid, state);
    return state.elonScore || 0;
}

/* Render Musk Score card inside profile modal */
function _renderMuskScore(uid) {
    const card = document.getElementById('pm-musk-card');
    if (!card) return;

    const MUSK_KEY  = 'rt_musk_' + uid;
    const totalSecs = parseFloat(localStorage.getItem(MUSK_KEY) || '0');
    const muskScore = Math.floor(totalSecs / 60);
    const remainder = totalSecs % 60;
    const muskPct   = Math.round((remainder / 60) * 100);

    // ── Musk Score card ──────────────────────────────────────────
    card.style.display = 'block';

    const numEl   = document.getElementById('pm-musk-number');
    const subEl   = document.getElementById('pm-musk-sub');
    const barEl   = document.getElementById('pm-musk-bar');
    const leftEl  = document.getElementById('pm-musk-prog-left');
    const rightEl = document.getElementById('pm-musk-prog-right');

    if (numEl) {
        numEl.textContent = muskScore;
        setTimeout(function() { numEl.classList.add('pop'); }, 100);
        setTimeout(function() { numEl.classList.remove('pop'); }, 700);
    }
    if (subEl)   subEl.textContent   = Math.round(totalSecs) + ' total seconds typed';
    if (leftEl)  leftEl.textContent  = Math.round(remainder) + 's this round';
    if (rightEl) rightEl.textContent = 'next point at ' + (60 - Math.round(remainder)) + 's';
    if (barEl) {
        setTimeout(function() {
            barEl.style.width = Math.max(2, Math.min(100, muskPct)) + '%';
        }, 200);
    }

    const tt = document.getElementById('pm-musk-tooltip');
    if (tt) {
        tt.innerHTML = `
            <strong>🚀 How Musk Score works</strong><br>
            Every second you type adds up across all sessions.<br>
            <strong>60 seconds typed = 1 Musk Score point.</strong><br><br>
            <span class="tt-ex">Your total: ${Math.round(totalSecs)}s typed<br>
            ${muskScore} × 60s = ${muskScore} point${muskScore !== 1 ? 's' : ''}<br>
            ${Math.round(remainder)}s toward your next point</span>
        `;
    }

    // ── Elon Score card (v4 — Musk-based session formula) ────────
    const elonCard = document.getElementById('pm-elon-card');
    if (elonCard) {
        const elonState    = _getElonState(uid);
        const elonScore    = elonState.elonScore || 0;   // locked, frozen mid-session
        const prevSessScoreStored = elonState.prevSessScore || 0;
        const session      = elonState.session;
        const sessCount    = session ? session.count : 0;
        const sessAvgWpm   = sessCount > 0 ? session.wpmSum / sessCount : 0;
        const sessAvgAcc   = sessCount > 0 ? session.accSum / sessCount : 0;

        // Progress within the current session, measured in Musk-seconds
        const muskAtStart  = session ? (session.muskAtStart || 0) : 0;
        const sessElapsed  = Math.max(0, totalSecs - muskAtStart);  // seconds into this session
        const sessSecsLeft = Math.max(0, ELON_SESSION_SECS - sessElapsed);
        const minsLeft     = Math.ceil(sessSecsLeft / 60);
        const sessionPct   = Math.min(100, Math.round((sessElapsed / ELON_SESSION_SECS) * 100));

        elonCard.style.display = 'block';

        const elonNumEl   = document.getElementById('pm-elon-number');
        const elonSubEl   = document.getElementById('pm-elon-sub');
        const elonBarEl   = document.getElementById('pm-elon-bar');
        const elonLeftEl  = document.getElementById('pm-elon-prog-left');
        const elonRightEl = document.getElementById('pm-elon-prog-right');

        if (elonNumEl) {
            elonNumEl.textContent = elonScore.toFixed(2);
            setTimeout(function() { elonNumEl.classList.add('pop'); }, 200);
            setTimeout(function() { elonNumEl.classList.remove('pop'); }, 800);
        }
        if (elonSubEl) {
            elonSubEl.textContent = sessCount > 0
                ? 'session avg: ' + Math.round(sessAvgWpm) + ' WPM / ' + Math.round(sessAvgAcc) + '% acc'
                : 'no tests in current session yet';
        }
        if (elonLeftEl)  elonLeftEl.textContent  = sessCount + ' test' + (sessCount !== 1 ? 's' : '') + ' this session';
        if (elonRightEl) elonRightEl.textContent = 'score updates in ~' + minsLeft + ' Musk min';
        if (elonBarEl) {
            setTimeout(function() {
                elonBarEl.style.width = Math.max(2, Math.min(100, sessionPct)) + '%';
            }, 300);
        }

        const elonTT = document.getElementById('pm-elon-tooltip');
        if (elonTT) {
            // Preview: what the score WILL be if the session ended right now (tooltip only)
            const previewSessScore = sessCount > 0 ? (sessAvgWpm + sessAvgAcc) / 100 : 0;
            const previewImprov    = (sessCount > 0 && prevSessScoreStored > 0) ? Math.max(0, previewSessScore - prevSessScoreStored) : 0;
            const previewFinal     = sessCount > 0 ? elonScore + previewSessScore + previewImprov : elonScore;
            elonTT.innerHTML = `
                <strong>⚡ How Elon Score works</strong><br>
                Updates once per 60 Musk (60 min of typing time).<br>
                <strong>Score = Prev + (avg WPM + avg Acc) ÷ 100 + Improvement</strong><br>
                Improvement = max(0, This session score − Last session score)<br><br>
                <span class="tt-ex">
                  Locked score: <strong>${elonScore.toFixed(2)}</strong><br>
                  Session tests: ${sessCount} | avg ${Math.round(sessAvgWpm)} WPM / ${Math.round(sessAvgAcc)}% acc<br>
                  Last session score: ${prevSessScoreStored.toFixed(2)}<br>
                  Preview (if session ended now): ${previewFinal.toFixed(2)}<br>
                  Musk into session: ${Math.round(sessElapsed / 60)} / 60 min
                </span>
            `;
        }
    }
}

/* ══════════════════════════════════════════════
   UPDATE KEYMAP SCORE BADGES (Musk + Elon)
══════════════════════════════════════════════ */
function updateKmScoreBadges() {
    var uid = (window._currentUser && window._currentUser.uid) ? window._currentUser.uid : 'guest';
    var MUSK_KEY = 'rt_musk_' + uid;
    var totalSecs = parseFloat(localStorage.getItem(MUSK_KEY) || '0');
    var muskScore = Math.floor(totalSecs / 60);

    // Elon Score v3: locked score — only updates at 60-min session boundary
    var elonRaw   = _computeElonScore(_getElonState(uid)); // returns locked decimal score
    var elonScore = parseFloat(elonRaw.toFixed(2));

    var muskEl = document.getElementById('km-musk-num');
    var elonEl = document.getElementById('km-elon-num');

    function setAndPop(el, val) {
        if (!el) return;
        var prev = parseInt(el.textContent) || 0;
        el.textContent = val;
        if (val !== prev) {
            el.classList.remove('km-pop');
            void el.offsetWidth; // reflow to restart animation
            el.classList.add('km-pop');
            setTimeout(function() { el.classList.remove('km-pop'); }, 550);
        }
    }

    setAndPop(muskEl, muskScore);
    setAndPop(elonEl, elonScore);
}

// Update badges when Firebase auth is ready
window.addEventListener('firebase-ready', function() {
    updateKmScoreBadges();
}, { once: true });

// Also update immediately in case already loaded
setTimeout(updateKmScoreBadges, 800);

// Expose so it can be called after each test completes
window.updateKmScoreBadges = updateKmScoreBadges;

window.closeProfileModal = function() {
    const modal = document.getElementById('profileModal');
    modal.classList.remove('open');
    document.body.style.overflow = '';
    if (window.location.pathname === '/profile') {
        window.history.pushState({}, '', '/');
        document.title = window._originalPageTitle || document.title;
    }
    if (document._pmEscHandler) {
        document.removeEventListener('keydown', document._pmEscHandler);
        document._pmEscHandler = null;
    }
    // Reset avatar input so same file can be re-selected
    const inp = document.getElementById('pm-avatar-input');
    if (inp) inp.value = '';
};

function updateLeaderboardPrompt() {
    const prompt = document.getElementById('lb-register-prompt');
    if (window._currentUser) {
        if (prompt) prompt.style.display = 'none';
    }
}
// Update leaderboard register button to open auth modal
function openRegisterModal() { openAuthModal('signup'); }
        // Leaderboard mode toggle (TIME / WORDS / ELON)
        let currentLbMode = 'time';
        // Binds click handlers to the tab buttons. Called once, right after
        // leaderboard.html is injected into the page (see ensureLeaderboardModalLoaded),
        // since the tabs don't exist in the DOM until then.
        function initLeaderboardTabs() {
            document.querySelectorAll('.lb-mode-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    document.querySelectorAll('.lb-mode-tab').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    currentLbMode = tab.dataset.lbmode;

                    // Show/hide duration buttons (hidden for elon mode)
                    document.querySelectorAll('.time-tab[data-lbfor="time"]').forEach(t => t.style.display = currentLbMode === 'time' ? '' : 'none');
                    document.querySelectorAll('.time-tab[data-lbfor="words"]').forEach(t => t.style.display = currentLbMode === 'words' ? '' : 'none');

                    if (currentLbMode === 'elon') {
                        loadElonLeaderboard();
                        return;
                    }

                    // Activate first tab of new mode and load
                    const firstTab = document.querySelector(`.time-tab[data-lbfor="${currentLbMode}"]`);
                    document.querySelectorAll('.time-tab').forEach(t => t.classList.remove('active'));
                    if (firstTab) {
                        firstTab.classList.add('active');
                        if (currentLbMode === 'time') loadLeaderboard(parseInt(firstTab.dataset.duration));
                        else loadWordLeaderboard(parseInt(firstTab.dataset.duration));
                    }
                });
            });

            // Leaderboard duration tabs handler
            document.querySelectorAll('.time-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    document.querySelectorAll('.time-tab').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    const dur = parseInt(tab.dataset.duration);
                    if (currentLbMode === 'time') loadLeaderboard(dur);
                    else loadWordLeaderboard(dur);
                });
            });
        }
        function shareScore() {
            const text = `I just hit ${document.querySelector('#wpm .stat-value').textContent} WPM on Rocket Typing! Can you beat me? 🚀 https://www.rockettyping.com/`;
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
        }
