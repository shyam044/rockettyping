/**
 * Rocket Typing – Coding Practice
 * Question Bank: code1.js  (Questions #1 – #10)
 *
 * HOW TO ADD MORE QUESTIONS:
 *   Create code2.js, code3.js, … in the same folder.
 *   Each file must follow the same export format below.
 *   The platform auto-detects and loads all codeN.js files automatically.
 */

const questions = [

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 1,
    title: "Print Hello World",
    difficulty: "Easy",
    topic: "Basics",
    timeLimit: "1 sec",
    memoryLimit: "256 MB",

    description: `Every programmer's first milestone is printing a simple message to the screen.
Your task is to display the text \`Hello World\` exactly as shown — with correct capitalisation and a single space between the two words.`,

    inputFormat: `This problem takes no input. Simply print the required message.`,

    outputFormat: `Print exactly one line:
\`\`\`
Hello World
\`\`\``,

    constraints: `• No input is required.
• The output must match exactly (capitalisation and spacing matter).`,

    sampleInput: "",
    sampleOutput: "Hello World",

    explanation: `Use your language's print statement to output the string \`Hello World\`. No variables, no loops — just a single print.`,

    hint: `Python: print("Hello World")`,

    allowedSyntax: ["print", "string"],

    testCases: [
      { input: "", expectedOutput: "Hello World" }
    ],

    hiddenTestCases: [
      { input: "", expectedOutput: "Hello World" },
      { input: "", expectedOutput: "Hello World" }
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 2,
    title: "Basic Arithmetic Operations",
    difficulty: "Easy",
    topic: "Math",
    timeLimit: "1 sec",
    memoryLimit: "256 MB",

    description: `You are given two integers. Perform the following six arithmetic operations on them and print each result on a separate line, in the exact order listed:

1. **Addition** — the sum of the two numbers
2. **Subtraction** — the first number minus the second
3. **Multiplication** — the product of the two numbers
4. **Division** — the first number divided by the second (integer division — discard any remainder)
5. **Modulo** — the remainder when the first number is divided by the second
6. **Power** — the result of raising the first number to the power of the second`,

    inputFormat: `Two integers \`a\` and \`b\` are given on two separate lines.`,

    outputFormat: `Print exactly six lines, one result per operation, in the order:
\`\`\`
a + b
a - b
a * b
a / b   (integer division)
a % b
a ^ b
\`\`\``,

    constraints: `• 1 ≤ a, b ≤ 100
• b ≠ 0 (division by zero will not be tested)
• For the Power operation, the result fits within a standard integer.`,

    sampleInput: `10
3`,

    sampleOutput: `13
7
30
3
1
1000`,

    explanation: `With a = 10 and b = 3:
• 10 + 3 = 13
• 10 − 3 = 7
• 10 × 3 = 30
• 10 ÷ 3 = 3  (integer division; remainder is dropped)
• 10 mod 3 = 1  (10 = 3×3 + 1)
• 10³ = 1000`,

    hint: `In Python, integer division uses \`//\` and power uses \`**\`.`,

    allowedSyntax: ["input", "int", "print", "arithmetic"],

    testCases: [
      { input: "10\n3", expectedOutput: "13\n7\n30\n3\n1\n1000" }
    ],

    hiddenTestCases: [
      { input: "5\n2",  expectedOutput: "7\n3\n10\n2\n1\n25" },
      { input: "8\n4",  expectedOutput: "12\n4\n32\n2\n0\n4096" },
      { input: "7\n3",  expectedOutput: "10\n4\n21\n2\n1\n343" },
      { input: "100\n10", expectedOutput: "110\n90\n1000\n10\n0\n100000000000000000000" }
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 3,
    title: "Concatenate Two Strings",
    difficulty: "Easy",
    topic: "Strings",
    timeLimit: "1 sec",
    memoryLimit: "256 MB",

    description: `You are given two words. Join them together into a single sentence with exactly one space between them, and print the result.

This operation is called **string concatenation** — combining two or more strings into one.`,

    inputFormat: `Two strings are given on two separate lines.
• First line: the first word
• Second line: the second word`,

    outputFormat: `Print the two words joined by a single space on one line.`,

    constraints: `• Each string contains only printable characters.
• Each string has a length between 1 and 50 characters.`,

    sampleInput: `Hello
World`,

    sampleOutput: `Hello World`,

    explanation: `The two inputs \`Hello\` and \`World\` are combined with a space in between: \`Hello World\`.`,

    hint: `In Python, you can join strings with the \`+\` operator or use an f-string: \`f"{a} {b}"\`.`,

    allowedSyntax: ["input", "print", "string", "concatenation"],

    testCases: [
      { input: "Hello\nWorld", expectedOutput: "Hello World" }
    ],

    hiddenTestCases: [
      { input: "Good\nMorning",   expectedOutput: "Good Morning" },
      { input: "Rocket\nTyping",  expectedOutput: "Rocket Typing" },
      { input: "Python\nCode",    expectedOutput: "Python Code" },
      { input: "Learn\nFast",     expectedOutput: "Learn Fast" }
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 4,
    title: "Repeat a Word N Times",
    difficulty: "Easy",
    topic: "Strings",
    timeLimit: "1 sec",
    memoryLimit: "256 MB",

    description: `You are given a word and a number \`n\`. Print the word exactly \`n\` times, each occurrence separated by a single space, all on one line.`,

    inputFormat: `• First line: a string (the word to repeat)
• Second line: an integer \`n\` (the number of times to repeat it)`,

    outputFormat: `Print the word \`n\` times on a single line, separated by spaces.`,

    constraints: `• 1 ≤ n ≤ 20
• The word contains only printable characters.
• The word length is between 1 and 30 characters.`,

    sampleInput: `Hello
4`,

    sampleOutput: `Hello Hello Hello Hello`,

    explanation: `The word \`Hello\` repeated 4 times, each separated by a space.`,

    hint: `In Python, you can use string repetition: \`(word + " ") * n\`, then strip the trailing space. Or use \`" ".join([word] * n)\`.`,

    allowedSyntax: ["input", "int", "print", "string", "repetition", "loop"],

    testCases: [
      { input: "Hello\n4", expectedOutput: "Hello Hello Hello Hello" }
    ],

    hiddenTestCases: [
      { input: "Go\n3",     expectedOutput: "Go Go Go" },
      { input: "Code\n5",   expectedOutput: "Code Code Code Code Code" },
      { input: "Yes\n1",    expectedOutput: "Yes" },
      { input: "Fast\n2",   expectedOutput: "Fast Fast" }
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 5,
    title: "Find the Length of a String",
    difficulty: "Easy",
    topic: "Strings",
    timeLimit: "1 sec",
    memoryLimit: "256 MB",

    description: `You are given a string. Find and print the total number of characters it contains, including letters, digits, spaces, and any other printable characters.

This value is called the **length** of the string.`,

    inputFormat: `A single string on one line.`,

    outputFormat: `Print a single integer — the number of characters in the string.`,

    constraints: `• The string length is between 1 and 200 characters.
• The string may include letters, digits, and spaces.`,

    sampleInput: `Hello`,

    sampleOutput: `5`,

    explanation: `The string \`Hello\` contains 5 characters: H, e, l, l, o.`,

    hint: `In Python, use the built-in \`len()\` function: \`print(len(s))\`.`,

    allowedSyntax: ["input", "print", "len", "string"],

    testCases: [
      { input: "Hello", expectedOutput: "5" }
    ],

    hiddenTestCases: [
      { input: "Rocket Typing", expectedOutput: "13" },
      { input: "Python",        expectedOutput: "6" },
      { input: "a",             expectedOutput: "1" },
      { input: "Hello World",   expectedOutput: "11" }
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 6,
    title: "Print the First Character of a String",
    difficulty: "Easy",
    topic: "Strings",
    timeLimit: "1 sec",
    memoryLimit: "256 MB",

    description: `You are given a string. Extract and print only its **first character**.

In programming, individual characters inside a string are accessed using their **index** — a position number that starts at 0. The first character is always at index 0.`,

    inputFormat: `A single non-empty string on one line.`,

    outputFormat: `Print exactly one character — the first character of the input string.`,

    constraints: `• The string length is between 1 and 200 characters.
• The string contains at least one character.`,

    sampleInput: `Hello`,

    sampleOutput: `H`,

    explanation: `The string \`Hello\` has the character \`H\` at index 0. Printing index 0 gives \`H\`.`,

    hint: `In Python, use square bracket indexing: \`print(s[0])\`.`,

    allowedSyntax: ["input", "print", "string", "indexing"],

    testCases: [
      { input: "Hello", expectedOutput: "H" }
    ],

    hiddenTestCases: [
      { input: "Rocket", expectedOutput: "R" },
      { input: "Python", expectedOutput: "P" },
      { input: "apple",  expectedOutput: "a" },
      { input: "Z",      expectedOutput: "Z" }
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 7,
    title: "Remove the Last Character of a String",
    difficulty: "Easy",
    topic: "Strings",
    timeLimit: "1 sec",
    memoryLimit: "256 MB",

    description: `You are given a string. Print the string with its **last character removed**.

In Python, the last character of a string is at index \`-1\`, or equivalently at index \`len(s) - 1\`. String slicing lets you extract a portion of a string using the syntax \`s[start:end]\`.`,

    inputFormat: `A single string on one line.`,

    outputFormat: `Print the input string without its last character.`,

    constraints: `• The string length is between 2 and 200 characters (always at least 2 characters, so the result is never empty).`,

    sampleInput: `Hello`,

    sampleOutput: `Hell`,

    explanation: `The string \`Hello\` has 5 characters. Removing the last character \`o\` leaves \`Hell\`.`,

    hint: `In Python, use slicing: \`print(s[:len(s)-1])\` or the shorthand \`print(s[:-1])\`.`,

    allowedSyntax: ["input", "print", "string", "slicing", "len"],

    testCases: [
      { input: "Hello", expectedOutput: "Hell" }
    ],

    hiddenTestCases: [
      { input: "Python",  expectedOutput: "Pytho" },
      { input: "Rocket",  expectedOutput: "Rocke" },
      { input: "ab",      expectedOutput: "a" },
      { input: "Typing!", expectedOutput: "Typing" }
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 8,
    title: "Add Two Numbers Given as Strings",
    difficulty: "Easy",
    topic: "Math",
    timeLimit: "1 sec",
    memoryLimit: "256 MB",

    description: `When reading input from a user, numbers often arrive as **text (strings)** rather than as numeric types. Before performing arithmetic, you must convert them into integers.

You are given two numbers, each on a separate line, as strings. Convert each string to an integer, add them together, and print the result.`,

    inputFormat: `• First line: the first number as a string (e.g., \`"10"\`)
• Second line: the second number as a string (e.g., \`"20"\`)`,

    outputFormat: `Print a single integer — the sum of the two converted numbers.`,

    constraints: `• Both inputs represent valid non-negative integers.
• 0 ≤ each number ≤ 10,000`,

    sampleInput: `10
20`,

    sampleOutput: `30`,

    explanation: `The strings \`"10"\` and \`"20"\` are converted to integers 10 and 20. Their sum is 30.`,

    hint: `In Python, use \`int()\` to convert: \`a = int(input())\`. Then add normally.`,

    allowedSyntax: ["input", "int", "print", "arithmetic"],

    testCases: [
      { input: "10\n20", expectedOutput: "30" }
    ],

    hiddenTestCases: [
      { input: "0\n0",       expectedOutput: "0" },
      { input: "100\n200",   expectedOutput: "300" },
      { input: "999\n1",     expectedOutput: "1000" },
      { input: "50\n75",     expectedOutput: "125" }
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 9,
    title: "Compare Two Numbers",
    difficulty: "Easy",
    topic: "Conditions",
    timeLimit: "1 sec",
    memoryLimit: "256 MB",

    description: `You are given two integers. Compare them and print the result according to the following rules:

- If the **first number is smaller**, print the first number on one line and then the second number on the next line.
- If the **second number is smaller**, print the second number on one line and then the first number on the next line.
- If **both numbers are equal**, print \`Equal\`.

In other words: always print the **smaller number first**, followed by the **larger number**. If they are the same, print \`Equal\`.`,

    inputFormat: `Two integers on two separate lines.
• First line: integer \`a\`
• Second line: integer \`b\``,

    outputFormat: `Either:
- Two lines: the smaller value, then the larger value.
- Or one line: \`Equal\``,

    constraints: `• -10,000 ≤ a, b ≤ 10,000`,

    sampleInput: `5
10`,

    sampleOutput: `5
10`,

    explanation: `5 < 10, so 5 is printed first (the smaller), then 10 (the larger).`,

    hint: `Use an \`if / elif / else\` block to compare \`a\` and \`b\`.`,

    allowedSyntax: ["input", "int", "print", "if", "elif", "else", "comparison"],

    testCases: [
      { input: "5\n10",  expectedOutput: "5\n10" }
    ],

    hiddenTestCases: [
      { input: "10\n5",   expectedOutput: "5\n10" },
      { input: "7\n7",    expectedOutput: "Equal" },
      { input: "-3\n0",   expectedOutput: "-3\n0" },
      { input: "100\n99", expectedOutput: "99\n100" }
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 10,
    title: "Job Application Eligibility Check",
    difficulty: "Easy",
    topic: "Conditions",
    timeLimit: "1 sec",
    memoryLimit: "256 MB",

    description: `A company is hiring and has set two specific eligibility conditions for applicants:

1. The applicant's **salary must be greater than 10 lakhs** (i.e., salary > 10).
2. The company must provide a **cab facility** (i.e., the facility is \`"cab"\`).

Only if **both** conditions are satisfied should the applicant apply. Otherwise, they should not.

You are given the salary and the facility type. Determine whether the applicant should apply for the job.`,

    inputFormat: `• First line: an integer representing the salary in lakhs (e.g., \`15\`)
• Second line: a string representing the facility type (e.g., \`cab\` or \`no cab\`)`,

    outputFormat: `Print exactly one of:
- \`Job\` — if salary > 10 AND facility is \`cab\`
- \`No Job\` — otherwise`,

    constraints: `• 1 ≤ salary ≤ 100
• The facility string is either \`cab\` or \`no cab\` (lowercase).`,

    sampleInput: `15
cab`,

    sampleOutput: `Job`,

    explanation: `Salary is 15 (which is > 10) and the facility is \`cab\`. Both conditions are met, so the output is \`Job\`.`,

    hint: `Use a single \`if\` statement with the \`and\` operator to check both conditions at once.`,

    allowedSyntax: ["input", "int", "print", "if", "else", "and", "comparison", "string"],

    testCases: [
      { input: "15\ncab",    expectedOutput: "Job" }
    ],

    hiddenTestCases: [
      { input: "5\nno cab",  expectedOutput: "No Job" },
      { input: "11\ncab",    expectedOutput: "Job" },
      { input: "10\ncab",    expectedOutput: "No Job" },
      { input: "20\nno cab", expectedOutput: "No Job" },
      { input: "1\ncab",     expectedOutput: "No Job" }
    ]
  }

];

// ─── AUTO-REGISTRATION ────────────────────────────────────────────────────────
// The platform imports all codeN.js files and calls registerQuestions().
// You never need to edit coding.html when adding new question files.
if (typeof registerQuestions === "function") {
  registerQuestions(questions);
} else {
  // Fallback: expose as global for direct <script> inclusion
  window.__rocketQuestions = window.__rocketQuestions || [];
  window.__rocketQuestions.push(...questions);
}

// ════════════════════════════════════════════════════════════════════════════
//  "WITH CODE" / "WITHOUT CODE" PRACTICE MODE  (MonkeyType-style typing)
//  ---------------------------------------------------------------------------
//  Self-contained inside code1.js so that core-engine.js and
//  python-compiler.js never need to be touched. Only code1.js changes.
//
//  It hooks the platform's existing global functions — openProblem(),
//  showResult(), resetCode() — which already exist by the time this file
//  runs (code1.js loads dynamically, after the whole inline app script).
//
//  "With Code" mode replaces the Monaco editor's visible area with a
//  MonkeyType-style typing widget: the reference solution is rendered
//  character-by-character (dim/untyped, green/correct, red/incorrect,
//  highlighted cursor on the current character). The user types with a
//  real cursor into a focused, invisible input — exactly like MonkeyType.
//  Every keystroke is mirrored live into the real Monaco editor underneath,
//  so Run / Submit / judging keep working completely unchanged.
//
//  "Without Code" mode hides the widget and restores the normal blank
//  Monaco editor — the platform's original behaviour.
// ════════════════════════════════════════════════════════════════════════════
(function () {

  // Reference ("With Code") solutions — Python, one per question id in this file.
  const SOLUTIONS = {
    1:  `print("Hello World")`,

    2:  `a = int(input())
b = int(input())
print(a + b)
print(a - b)
print(a * b)
print(a // b)
print(a % b)
print(a ** b)`,

    3:  `a = input()
b = input()
print(a + " " + b)`,

    4:  `word = input()
n = int(input())
print(" ".join([word] * n))`,

    5:  `s = input()
print(len(s))`,

    6:  `s = input()
print(s[0])`,

    7:  `s = input()
print(s[:-1])`,

    8:  `a = int(input())
b = int(input())
print(a + b)`,

    9:  `a = int(input())
b = int(input())
if a < b:
    print(a)
    print(b)
elif b < a:
    print(b)
    print(a)
else:
    print("Equal")`,

    10: `salary = int(input())
facility = input()
if salary > 10 and facility == "cab":
    print("Job")
else:
    print("No Job")`,
  };

  let currentMode   = "idle"; // "idle" | "with" | "without" — idle = start screen showing
  let targetText    = "";     // reference text to type, for the open question
  let typedText     = "";     // what the user has actually typed so far
  let typedIndex    = 0;      // cursor position into targetText
  let autoSubmitted = false;  // guards against submitting more than once per attempt

  // `currentQuestion`, `monacoEditor` and `TypingTracker` are declared with
  // `let`/`const` inside the app's own inline <script>. Top-level `let`/
  // `const` never become `window.*` properties, but they ARE shared across
  // every classic <script> tag on the page (code1.js included), so we read
  // them as plain identifiers via this helper instead of `window.x`.
  function safe(name) {
    try { return eval(name); } catch (e) { return undefined; }
  }

  // ── Styles (injected once) ──────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById("mode-toggle-style")) return;
    const style = document.createElement("style");
    style.id = "mode-toggle-style";
    style.textContent = `
      .mode-toggle-bar {
        display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
        padding: 10px 14px;
        background: var(--glass, rgba(10,10,35,0.75));
        border-bottom: 1px solid var(--border, rgba(255,215,0,0.18));
      }
      .mode-toggle-label {
        font-size: 12px; color: var(--text2, #8b949e);
        text-transform: uppercase; letter-spacing: .6px; margin-right: 4px;
      }
      .mode-btn {
        background: none; border: 1px solid var(--border, rgba(255,215,0,0.18));
        color: var(--text2, #8b949e); padding: 6px 14px; border-radius: 8px;
        font-family: var(--font-ui, sans-serif); font-size: 12px; cursor: pointer;
        transition: all .2s;
      }
      .mode-btn:hover { color: var(--gold, #ffd700); border-color: rgba(255,215,0,.35); }
      .mode-btn.active {
        color: #0a0a23;
        background: linear-gradient(135deg, var(--gold2, #e2b714), var(--orange, #ff9900));
        border-color: transparent; font-weight: 600;
      }
      .mode-progress {
        margin-left: auto; font-family: var(--font-mono, monospace);
        font-size: 12px; color: var(--text2, #8b949e);
      }

      /* ── Big start-screen shown before a mode is picked ── */
      #mode-select-screen {
        position: absolute; inset: 0; z-index: 6;
        display: none; flex-direction: column; gap: 18px;
        align-items: stretch; justify-content: center;
        padding: 32px; background: #0a0a23;
      }
      #mode-select-screen.show { display: flex; }
      .mode-box {
        flex: 1; min-height: 120px;
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
        background: var(--glass, rgba(10,10,35,0.75));
        border: 1px solid var(--border, rgba(255,215,0,0.18));
        border-radius: 16px; cursor: pointer;
        font-family: var(--font-ui, sans-serif); color: var(--text, #c9d1d9);
        transition: all .18s;
      }
      .mode-box:hover {
        border-color: var(--gold, #ffd700);
        background: rgba(255,215,0,0.06);
        transform: translateY(-2px);
      }
      .mode-box-icon { font-size: 34px; }
      .mode-box-title { font-size: 18px; font-weight: 700; color: var(--gold, #ffd700); }
      .mode-box-sub { font-size: 12px; color: var(--text2, #8b949e); text-align: center; max-width: 320px; }

      /* ── MonkeyType-style typing widget ── */
      #type-practice-wrap {
        position: absolute; inset: 0; display: none; flex-direction: column;
        background: #0a0a23; z-index: 5;
      }
      #type-practice-wrap.show { display: flex; }
      #type-practice-text {
        flex: 1; overflow: auto; padding: 20px 24px; cursor: text;
        font-family: var(--font-mono, monospace); font-size: 36px; line-height: 1.9;
        white-space: pre-wrap; word-break: break-word;
        position: relative; /* anchor for the absolutely-positioned #caret */
      }
      #type-practice-text.tp-done { box-shadow: inset 0 0 0 2px var(--green, #00c896); }
      .tp-pending   { color: var(--text2, #5a6270); opacity: .55; }
      .tp-correct   { color: var(--text, #c9d1d9); }
      .tp-incorrect {
        color: var(--red, #ff4c4c);
        text-decoration: underline wavy var(--red, #ff4c4c);
        background: rgba(255,76,76,0.14); border-radius: 2px;
      }
      .tp-current { color: var(--text, #c9d1d9); }

      /* Real MonkeyType-style caret — a moving bar, not a background highlight */
      #caret {
        position: absolute;
        background: var(--cyan, #00e6cc);
        /* Smooth idle transition for caret blinking state and between tests */
        transition: transform 0.08s ease-out, height 0.06s ease-out;
        width: 4px;
        border-radius: 4px;
        will-change: transform, height;
        left: 0;
        top: 0;
        pointer-events: none; /* never intercept mouse events */
        opacity: 0;
      }
      #caret.tp-caret-show { opacity: 1; }
      #caret.tp-caret-blink { animation: tp-caret-blink 1s steps(1) infinite; }
      @keyframes tp-caret-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }

      /* Wrong-key feedback: the current character shakes/flashes red, and the
         caret itself does NOT move until the correct key is pressed. */
      .tp-wrong-flash {
        color: var(--red, #ff4c4c) !important;
        background: rgba(255,76,76,0.30);
        border-radius: 2px;
        animation: tp-shake .18s linear;
      }
      @keyframes tp-shake {
        0%   { transform: translateX(0); }
        25%  { transform: translateX(-3px); }
        75%  { transform: translateX(3px); }
        100% { transform: translateX(0); }
      }

      #type-hidden-input {
        position: absolute; opacity: 0; height: 1px; width: 1px;
        padding: 0; border: none; overflow: hidden; pointer-events: none;
      }
      .tp-footer {
        padding: 8px 24px; font-family: var(--font-mono, monospace); font-size: 12px;
        color: var(--text2, #8b949e); border-top: 1px solid var(--border, rgba(255,215,0,0.18));
      }
      .tp-footer b { color: var(--cyan, #00e6cc); }

      .res-mode-badge {
        display: inline-block; margin-left: 8px; padding: 2px 8px;
        font-size: 11px; border-radius: 6px; vertical-align: middle;
        background: rgba(255,215,0,0.12); color: var(--gold, #ffd700);
        border: 1px solid var(--border, rgba(255,215,0,0.18));
      }
      #res-mode-card #res-mode-val { color: var(--gold, #ffd700); }
    `;
    document.head.appendChild(style);
  }

  // ── Toggle bar + typing widget (injected once, into the RIGHT panel) ────
  function buildUI() {
    if (document.getElementById("mode-toggle-bar")) return;
    const main = document.querySelector(".workspace-main");
    const editorWrap = document.querySelector(".editor-wrap");
    if (!main || !editorWrap) return;

    const bar = document.createElement("div");
    bar.className = "mode-toggle-bar";
    bar.id = "mode-toggle-bar";
    bar.innerHTML = `
      <span class="mode-toggle-label">Practice Mode</span>
      <button type="button" class="mode-btn" id="mode-btn-with">📄 With Code</button>
      <button type="button" class="mode-btn" id="mode-btn-without">⌨️ Without Code</button>
      <span class="mode-progress" id="mode-progress"></span>
    `;
    main.insertBefore(bar, main.firstChild);

    // Big start-screen shown before the user has picked a mode for this problem
    const select = document.createElement("div");
    select.id = "mode-select-screen";
    select.className = "show";
    select.innerHTML = `
      <button type="button" class="mode-box" id="mode-box-with">
        <span class="mode-box-icon">📄</span>
        <span class="mode-box-title">With Code</span>
        <span class="mode-box-sub">See the reference solution and type it out, MonkeyType-style</span>
      </button>
      <button type="button" class="mode-box" id="mode-box-without">
        <span class="mode-box-icon">⌨️</span>
        <span class="mode-box-title">Without Code</span>
        <span class="mode-box-sub">Write the solution yourself, no reference shown</span>
      </button>
    `;
    editorWrap.appendChild(select);

    const wrap = document.createElement("div");
    wrap.id = "type-practice-wrap";
    wrap.innerHTML = `
      <div id="type-practice-text" tabindex="0"><span id="tp-chars"></span><div id="caret"></div></div>
      <div class="tp-footer">Click the text and just start typing — like MonkeyType. Backspace fixes mistakes. Your keystrokes are mirrored live into the editor below for Run / Submit.</div>
      <textarea id="type-hidden-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></textarea>
    `;
    editorWrap.appendChild(wrap);

    const hidden = document.getElementById("type-hidden-input");
    const textEl = document.getElementById("type-practice-text");
    textEl.addEventListener("click", () => hidden.focus());
    wrap.addEventListener("click", () => hidden.focus());
    hidden.addEventListener("keydown", handleTypingKeydown);
    hidden.addEventListener("blur", () => {
      // keep focus in the typing widget while it's active
      if (currentMode === "with") setTimeout(() => hidden.focus(), 0);
    });

    document.getElementById("mode-btn-with")
      .addEventListener("click", () => setMode("with", { notify: true }));
    document.getElementById("mode-btn-without")
      .addEventListener("click", () => setMode("without", { notify: true }));
    document.getElementById("mode-box-with")
      .addEventListener("click", () => setMode("with", { notify: true }));
    document.getElementById("mode-box-without")
      .addEventListener("click", () => setMode("without", { notify: true }));
  }

  // ── Typing logic ─────────────────────────────────────────────────────────
  // Because typed text is only ever accepted when it matches the reference
  // exactly, `typedText` always equals targetText.slice(0, typedIndex) — so
  // once typedIndex reaches the end, the code in the editor is guaranteed
  // correct and ready to Run / Submit.
  let blinkTimer = null;

  function handleTypingKeydown(e) {
    if (currentMode !== "with" || !targetText) return;

    if (e.key === "Backspace") {
      e.preventDefault();
      if (typedIndex > 0) {
        typedIndex--;
        typedText = typedText.slice(0, -1);
        const tracker = safe("TypingTracker");
        if (tracker && typeof tracker.recordKey === "function") tracker.recordKey("Backspace");
        afterTypeChange();
      }
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      let acceptedAny = false;
      for (let i = 0; i < 4; i++) {
        if (typedIndex >= targetText.length || targetText[typedIndex] !== " ") {
          if (!acceptedAny) tryType(" "); // wrong key -> flash, stop advancing
          break;
        }
        tryType(" ");
        acceptedAny = true;
      }
      if (acceptedAny) afterTypeChange();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (tryType("\n")) afterTypeChange();
      return;
    }
    if (e.key === " " && targetText[typedIndex] === "\n") {
      // At the end of a row, Space works exactly like Enter.
      e.preventDefault();
      if (tryType("\n")) afterTypeChange();
      return;
    }
    if (e.key.length === 1) {
      e.preventDefault();
      if (tryType(e.key)) afterTypeChange();
    }
  }

  // Only accepts (and advances the cursor on) a character that exactly
  // matches the next expected character. A wrong key press never moves the
  // cursor — it just flashes the current character red until the user
  // types it correctly, MonkeyType "stop on mistake" style.
  function tryType(ch) {
    if (typedIndex >= targetText.length) return false;
    const expected = targetText[typedIndex];
    if (ch !== expected) {
      flashWrong();
      // Record the mistake so Accuracy/Consistency reflect it — the
      // platform's tracker scores accuracy from the ratio of "Backspace"
      // -coded keystrokes to total keystrokes, so a rejected wrong key is
      // recorded the same way a correction would be.
      const tracker = safe("TypingTracker");
      if (tracker && typeof tracker.recordKey === "function") tracker.recordKey("Backspace");
      return false;
    }
    acceptChar(ch);
    // Once a row's content is finished, jump straight past the newline(s)
    // that follow it — no need to press Enter or Space to move to the next row.
    while (typedIndex < targetText.length && targetText[typedIndex] === "\n") {
      acceptChar("\n");
    }
    return true;
  }

  function acceptChar(ch) {
    typedText += ch;
    typedIndex++;
    const tracker = safe("TypingTracker");
    if (tracker && typeof tracker.recordKey === "function") tracker.recordKey(ch);
  }

  function flashWrong() {
    const chars = document.getElementById("tp-chars");
    if (!chars) return;
    const span = chars.children[typedIndex];
    if (!span) return;
    span.classList.remove("tp-wrong-flash");
    void span.offsetWidth; // restart the shake animation if triggered repeatedly
    span.classList.add("tp-wrong-flash");
    clearTimeout(flashWrong._t);
    flashWrong._t = setTimeout(() => span.classList.remove("tp-wrong-flash"), 200);

    // Caret still "reacts" (a quick pulse) even though it doesn't move.
    const caret = document.getElementById("caret");
    if (caret) {
      caret.classList.remove("tp-caret-blink");
      resetBlinkTimer();
    }
  }

  function afterTypeChange() {
    renderTypingProgress();
    syncToEditor();
    resetBlinkTimer();

    if (currentMode === "with" && targetText && typedIndex >= targetText.length && !autoSubmitted) {
      autoSubmitted = true;
      const toast = safe("toast");
      if (typeof toast === "function") {
        toast("Finished! Submitting your code…", "success");
      }
      // Small delay so the last character's render/caret animation is
      // visible before the result overlay appears.
      setTimeout(() => {
        const submit = safe("submitCode");
        if (typeof submit === "function") submit();
      }, 350);
    }
  }

  function resetBlinkTimer() {
    const caret = document.getElementById("caret");
    if (!caret) return;
    caret.classList.remove("tp-caret-blink");
    clearTimeout(blinkTimer);
    blinkTimer = setTimeout(() => caret.classList.add("tp-caret-blink"), 500);
  }

  function renderTypingProgress() {
    const textEl = document.getElementById("type-practice-text");
    const chars = document.getElementById("tp-chars");
    if (!textEl || !chars) return;

    if (!targetText) {
      chars.textContent = "No reference code available for this problem yet.";
      const caret = document.getElementById("caret");
      if (caret) caret.classList.remove("tp-caret-show");
      return;
    }

    let html = "";
    for (let i = 0; i < targetText.length; i++) {
      const ch = targetText[i];
      let cls = "tp-pending";
      if (i < typedIndex) cls = "tp-correct";
      else if (i === typedIndex) cls = "tp-current";
      html += `<span class="${cls}">${escapeCharHtml(ch)}</span>`;
    }
    chars.innerHTML = html;
    textEl.classList.toggle("tp-done", typedIndex >= targetText.length);

    const progress = document.getElementById("mode-progress");
    if (progress) {
      progress.textContent = currentMode === "with"
        ? `${typedIndex} / ${targetText.length} characters`
        : "";
    }

    updateRowScroll();
    moveCaret();
  }

  // Keeps only the current row plus the one row before it in view. Once the
  // user finishes a row and moves onto the next, the row that's now two
  // rows back scrolls up out of view.
  function updateRowScroll() {
    const textEl = document.getElementById("type-practice-text");
    if (!textEl || !targetText) return;

    const rowIndex = (typedText.match(/\n/g) || []).length; // 0-based current row
    const lineHeight = parseFloat(getComputedStyle(textEl).lineHeight) || 28;
    const targetScrollTop = rowIndex >= 2 ? (rowIndex - 1) * lineHeight : 0;

    if (Math.abs(textEl.scrollTop - targetScrollTop) > 1) {
      textEl.scrollTo({ top: targetScrollTop, behavior: "smooth" });
    }
  }

  // Positions the real #caret bar over the current character, MonkeyType-style.
  function moveCaret() {
    const textEl = document.getElementById("type-practice-text");
    const caret = document.getElementById("caret");
    const chars = document.getElementById("tp-chars");
    if (!textEl || !caret || !chars) return;

    const current = chars.children[typedIndex];
    if (!current) {
      // Finished (or nothing to type yet) — park the caret after the last
      // character and hide it.
      caret.classList.remove("tp-caret-show");
      return;
    }

    const containerRect = textEl.getBoundingClientRect();
    const rect = current.getBoundingClientRect();
    const x = rect.left - containerRect.left + textEl.scrollLeft;
    const y = rect.top - containerRect.top + textEl.scrollTop;

    caret.style.transform = `translate(${x}px, ${y}px)`;
    caret.style.height = rect.height + "px";
    caret.classList.add("tp-caret-show");
  }

  function escapeCharHtml(ch) {
    if (ch === "<") return "&lt;";
    if (ch === ">") return "&gt;";
    if (ch === "&") return "&amp;";
    return ch;
  }

  function syncToEditor() {
    const editor = safe("monacoEditor");
    if (editor) editor.setValue(typedText);
  }

  // ── Mode switching ───────────────────────────────────────────────────────
  function setMode(mode, opts) {
    opts = opts || {};
    currentMode = mode;

    document.getElementById("mode-btn-with").classList.toggle("active", mode === "with");
    document.getElementById("mode-btn-without").classList.toggle("active", mode === "without");

    const monacoContainer = document.getElementById("monaco-editor");
    const wrap = document.getElementById("type-practice-wrap");
    const select = document.getElementById("mode-select-screen");
    const langSelect = document.getElementById("lang-select");
    const q = safe("currentQuestion");

    if (select) select.classList.remove("show");

    if (mode === "with" && q) {
      targetText = SOLUTIONS[q.id] || "";
      typedText = "";
      typedIndex = 0;
      autoSubmitted = false;

      // Reference solutions are Python — lock the language so the typing
      // target matches exactly.
      if (langSelect) {
        langSelect.value = "python";
        langSelect.disabled = true;
        const changeLanguage = safe("changeLanguage");
        if (typeof changeLanguage === "function") changeLanguage();
      }

      if (monacoContainer) monacoContainer.style.display = "none";
      if (wrap) wrap.classList.add("show");
      renderTypingProgress();
      syncToEditor();
      resetBlinkTimer();

      const hidden = document.getElementById("type-hidden-input");
      if (hidden) hidden.focus();
    } else {
      if (langSelect) langSelect.disabled = false;
      if (monacoContainer) monacoContainer.style.display = "";
      if (wrap) wrap.classList.remove("show");
      document.getElementById("mode-progress").textContent = "";
      clearTimeout(blinkTimer);
      const caret = document.getElementById("caret");
      if (caret) { caret.classList.remove("tp-caret-show", "tp-caret-blink"); }

      const resetCode = safe("resetCode");
      if (opts.reset !== false && typeof resetCode === "function") resetCode();
    }

    if (opts.notify) {
      const toast = safe("toast");
      if (typeof toast === "function") {
        toast(
          mode === "with"
            ? "With Code: type the highlighted reference — just like MonkeyType."
            : "Without Code: solve this problem in your own way.",
          "info"
        );
      }
    }
  }

  // Shows the big "With Code" / "Without Code" start screen and hides both
  // the Monaco editor and the typing widget until the user picks one.
  function goIdle() {
    currentMode = "idle";
    autoSubmitted = false;

    document.getElementById("mode-btn-with").classList.remove("active");
    document.getElementById("mode-btn-without").classList.remove("active");

    const monacoContainer = document.getElementById("monaco-editor");
    const wrap = document.getElementById("type-practice-wrap");
    const select = document.getElementById("mode-select-screen");
    const langSelect = document.getElementById("lang-select");
    const progress = document.getElementById("mode-progress");

    if (monacoContainer) monacoContainer.style.display = "none";
    if (wrap) wrap.classList.remove("show");
    if (select) select.classList.add("show");
    if (langSelect) langSelect.disabled = false;
    if (progress) progress.textContent = "";

    clearTimeout(blinkTimer);
    const caret = document.getElementById("caret");
    if (caret) caret.classList.remove("tp-caret-show", "tp-caret-blink");
  }

  // ── Hook 1: openProblem — build/refresh the UI whenever a problem opens ──
  const _origOpenProblem = window.openProblem;
  if (typeof _origOpenProblem === "function") {
    window.openProblem = function (id) {
      _origOpenProblem(id);
      injectStyles();
      buildUI();
      // Every freshly-opened problem starts on the big start screen — the
      // user picks With Code or Without Code before anything is shown.
      goIdle();
    };
  }

  // ── Hook 2: resetCode — also clear the typing widget's progress ─────────
  const _origResetCode = window.resetCode;
  if (typeof _origResetCode === "function") {
    window.resetCode = function () {
      _origResetCode();
      if (currentMode === "with") {
        typedText = "";
        typedIndex = 0;
        autoSubmitted = false;
        renderTypingProgress();
      }
    };
  }

  // ── Hook 3: showResult — add the mode used to the result overlay ────────
  const _origShowResult = window.showResult;
  if (typeof _origShowResult === "function") {
    window.showResult = function (accepted, passed, total, runtime, lang, code, typing) {
      _origShowResult(accepted, passed, total, runtime, lang, code, typing);

      const modeLabel = currentMode === "with" ? "With Code" : "Without Code";

      // Placed directly below the Keystroke Timeline chart in the right
      // column, so it sits in the same visible frame as the graphs.
      const rightCol = document.querySelector(".result-col-right");
      if (rightCol) {
        let card = document.getElementById("res-mode-card");
        if (!card) {
          card = document.createElement("div");
          card.className = "chart-wrap";
          card.id = "res-mode-card";
          card.innerHTML = `<h5>Practice Mode</h5><div class="analytics-val" id="res-mode-val">—</div>`;
          rightCol.appendChild(card);
        }
        const val = document.getElementById("res-mode-val");
        if (val) val.textContent = modeLabel;
      }

      const title = document.getElementById("res-banner-title");
      if (title) {
        let badge = title.querySelector(".res-mode-badge");
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "res-mode-badge";
          title.appendChild(badge);
        }
        badge.textContent = modeLabel;
      }
    };
  }

})();