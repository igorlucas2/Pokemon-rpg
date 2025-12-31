const fs = require("fs");

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node tools/check-brackets.js <file>");
  process.exit(2);
}

const s = fs.readFileSync(filePath, "utf8");

const stack = [];
let i = 0;
let line = 1;
let col = 0;

function push(ch) {
  stack.push({ ch, line, col });
}

function pop(expect) {
  const top = stack.pop();
  if (!top || top.ch !== expect) {
    console.log("MISMATCH", {
      expect,
      got: top && top.ch,
      at: { line, col },
      open: top || null
    });
    process.exit(0);
  }
}

// Very small lexer that ignores strings/comments/templates reasonably well,
// and tries to distinguish regex literals from comments.
let mode = "code"; // code|sq|dq|tpl|linecom|blockcom|regex
let lastSig = ""; // last significant char in code (best-effort)

function isRegexStart(prev) {
  // Heuristic: after these tokens, a '/' likely starts a regex literal.
  // This isn't a full JS lexer, but it prevents false comment detection in common cases.
  if (!prev) return true;
  return "([=:{,;!&|?+-*%^~<>\n".includes(prev);
}
while (i < s.length) {
  const ch = s[i];
  const next = s[i + 1];

  if (ch === "\n") {
    line += 1;
    col = 0;
    if (mode === "linecom") mode = "code";
    i += 1;
    continue;
  }

  col += 1;

  if (mode === "linecom") {
    i += 1;
    continue;
  }

  if (mode === "blockcom") {
    if (ch === "*" && next === "/") {
      mode = "code";
      i += 2;
      col += 1;
      continue;
    }
    i += 1;
    continue;
  }

  if (mode === "regex") {
    if (ch === "\\") {
      i += 2;
      col += 1;
      continue;
    }
    if (ch === "[") {
      // char class inside regex
      push("[");
      i += 1;
      continue;
    }
    if (ch === "]") {
      pop("[");
      i += 1;
      continue;
    }
    if (ch === "/") {
      // end of regex literal; ignore flags
      mode = "code";
      i += 1;
      continue;
    }
    i += 1;
    continue;
  }

  if (mode === "sq") {
    if (ch === "\\") {
      i += 2;
      col += 1;
      continue;
    }
    if (ch === "'") mode = "code";
    i += 1;
    continue;
  }

  if (mode === "dq") {
    if (ch === "\\") {
      i += 2;
      col += 1;
      continue;
    }
    if (ch === '"') mode = "code";
    i += 1;
    continue;
  }

  if (mode === "tpl") {
    if (ch === "\\") {
      i += 2;
      col += 1;
      continue;
    }
    if (ch === "`") {
      mode = "code";
      i += 1;
      continue;
    }
    if (ch === "$" && next === "{") {
      push("{");
      i += 2;
      col += 1;
      continue;
    }
    i += 1;
    continue;
  }

  // code
  if (ch === "/") {
    if (next === "/") {
      mode = "linecom";
      i += 2;
      col += 1;
      continue;
    }
    if (next === "*") {
      mode = "blockcom";
      i += 2;
      col += 1;
      continue;
    }
    if (isRegexStart(lastSig)) {
      mode = "regex";
      i += 1;
      continue;
    }
  }

  if (ch === "'") {
    mode = "sq";
    i += 1;
    continue;
  }
  if (ch === '"') {
    mode = "dq";
    i += 1;
    continue;
  }
  if (ch === "`") {
    mode = "tpl";
    i += 1;
    continue;
  }

  if (ch === "(") push("(");
  else if (ch === ")") pop("(");
  else if (ch === "[") push("[");
  else if (ch === "]") pop("[");
  else if (ch === "{") push("{");
  else if (ch === "}") pop("{");

  if (ch.trim()) {
    lastSig = ch;
  }

  i += 1;
}

console.log("END. Unclosed stack size:", stack.length);
console.log("Top opens:", stack.slice(-20));
