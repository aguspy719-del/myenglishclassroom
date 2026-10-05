/**
 * parse-questions.ts — rule-based import of exam questions from pasted text.
 *
 * Teachers write questions in Word with a predictable structure:
 *
 *   1. She ... a book last night.
 *   A. read
 *   B. reads
 *   Jawaban: B
 *
 *   2. Write a paragraph about your holiday!      <- no options = essay
 *
 *   KUNCI JAWABAN:
 *   1. B   2. A   3. C ...
 *
 * This module turns that text into structured questions. It is deterministic
 * (no AI): anything it cannot recognize is reported back, never silently
 * dropped, so the teacher can fix it in the editable drafts.
 */

export interface ParsedQuestion {
  /** Question number as written in the document (null if none was found). */
  number: number | null;
  question: string;
  question_type: "multiple_choice" | "essay";
  options: { a: string; b: string; c: string; d: string };
  /** Lowercase letter "a"–"d", or "" when the key was not found. */
  correct_answer: string;
  max_score: number;
  warnings: string[];
}

export interface ParseResult {
  questions: ParsedQuestion[];
  /** Title/instruction lines that were intentionally ignored. */
  skipped: string[];
  /** Question-like blocks that could not be parsed, with the reason. */
  unparsed: { text: string; reason: string }[];
  /** Key entries whose number matched no parsed question (numbering mismatch). */
  keyMisses: number[];
}

const DEFAULT_MC_SCORE = 10;
const DEFAULT_ESSAY_SCORE = 20;

const OPT_KEYS = ["a", "b", "c", "d"] as const;

// "1. text", "1) text", "(1) text" — 1–3 digits so years like "1975." don't split questions
const Q_NUM_RE = /^\(?\s*(\d{1,3})\s*[.):]\s*(.*)$/;
// "A. text", "A) text", "a) text", "(A) text"
const OPT_RE = /^\(?\s*([A-Ea-e])\s*[.):]\s*(.*)$/;
// Standalone answer line: "Jawaban: B", "Kunci Jawaban: B", "Answer: b", "Key B"
const ANS_INLINE_RE =
  /^(?:jawaban|kunci(?:\s+jawaban)?|answer(?:\s+key)?|key)\s*[:.)-]?\s*\(?([A-Da-d])\)?\s*[.:)]?\s*(.*)$/i;
// "(Jawaban: B)" at the end of a question/option line
const ANS_TRAILING_RE =
  /\(\s*(?:jawaban|kunci(?:\s+jawaban)?|answer(?:\s+key)?|key)\s*[:.]?\s*([A-Da-d])\s*\)\s*$/i;
// Bare key-block header: "KUNCI JAWABAN", "Kunci:", "Answer Key"
const KEY_HEADER_RE = /^(?:kunci(?:\s+jawaban)?|jawaban|answer\s*key|key)\s*[:.]?\s*$/i;
// One number→letter pair inside a key block: "1. B", "1) B", "1 B", "12.C"
const PAIR_RE = /(\d{1,3})\s*[.):]?\s*[-–]?\s*\(?([A-Da-d])\)?(?=[\s,;]|$)/g;
// Explicit essay marker at the start of a question: "(Essay) ...", "Essay: ..."
const ESSAY_MARK_RE = /^\(?\s*essay\s*\)?\s*[:.]?\s*/i;
// Inline options written on the same line: "A. go B. goes C. going D. gone"
const INLINE_OPT_MARK_RE = /(?:^|[\s(])([A-Ea-e])\s*[.):]\s*/g;
// Non-global variant used just to count option markers on a line
const OPT_MARK_COUNT_RE = /(?:^|[\s(])[A-Ea-e]\s*[.):]/g;

/** Clean paste artifacts: nbsp, bullets, tabs, collapsed whitespace. */
function cleanLine(raw: string): string {
  return raw
    .replace(/\u00A0/g, " ")
    .replace(/[\u2022\u25CF\u25AA\u25E6\u2023\u00B7\u2043\u2219\u2218]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parse a line that consists only of number→letter pairs ("1. B 2. A 3. C"). */
function parsePairLine(line: string): { num: number; letter: string }[] | null {
  const pairs: { num: number; letter: string }[] = [];
  const pairParts: string[] = [];
  PAIR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PAIR_RE.exec(line)) !== null) {
    pairs.push({ num: parseInt(m[1], 10), letter: m[2].toLowerCase() });
    pairParts.push(m[0]);
  }
  if (pairs.length === 0) return null;
  // Everything not matched must be only separators/spaces
  let leftover = line;
  for (const part of pairParts) leftover = leftover.replace(part, "");
  if (/[^\s,;.\-–]/.test(leftover)) return null;
  return pairs;
}

/**
 * Split a question line that carries its options inline:
 * "She ... a book. A. read B. reads C. reading D. was read"
 * Only used when the line contains >= 3 option markers, so phrases like
 * "Section B. then answer" are never misread.
 */
function extractInlineOptions(text: string): { question: string; options: { letter: string; text: string }[] } | null {
  INLINE_OPT_MARK_RE.lastIndex = 0;
  const marks: { letter: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = INLINE_OPT_MARK_RE.exec(text)) !== null) {
    marks.push({ letter: m[1].toLowerCase(), start: m.index, end: m.index + m[0].length });
  }
  if (marks.length < 3) return null;
  const question = text.slice(0, marks[0].start).trim();
  const options: { letter: string; text: string }[] = [];
  for (let i = 0; i < marks.length; i++) {
    const from = marks[i].end;
    const to = i + 1 < marks.length ? marks[i + 1].start : text.length;
    options.push({ letter: marks[i].letter, text: text.slice(from, to).trim() });
  }
  return { question, options };
}

/**
 * A section title inside the pasted text ("SOAL ESSAY", "II. ESSAY TEST",
 * "B. Essay"). Used to leave the answer-key block when questions resume.
 */
function isSectionHeader(line: string): boolean {
  if (/^\d/.test(line)) return false; // numbered lines are questions/answers, never headers
  if (/^[IVXivx]+\s*[.):]\s*\S/.test(line)) return true; // "II. ESSAY"
  const lettersOnly = line.replace(/[^A-Za-z]/g, "");
  return lettersOnly.length >= 3 && lettersOnly === lettersOnly.toUpperCase() && line.length <= 45;
}

interface Block {
  number: number | null;
  lines: string[]; // question text lines
  options: { letter: string; text: string }[];
  inlineAnswer: string;
  warnings: string[];
  explicitEssay: boolean;
}

function finalizeBlock(block: Block): ParsedQuestion | null {
  const warnings = [...block.warnings];
  let questionText = block.lines.join(" ").trim();

  // Merge options back into the text when the block is really an essay but
  // picked up stray "A." lines (e.g. a single instruction line starting with A.)
  const nonEmptyOptions = block.options.filter((o) => o.text);
  const isEssay = block.explicitEssay || nonEmptyOptions.length < 2;

  if (isEssay) {
    // Put stray option text back into the question so nothing is lost
    for (const o of nonEmptyOptions) {
      questionText = `${questionText} ${o.text}`.trim();
    }
    if (nonEmptyOptions.length > 0) {
      warnings.push("Only one option found — treated as essay. Check the text.");
    }
    if (!questionText) return null;

    // No options on purpose? Just the question text is enough.
    questionText = questionText.replace(ESSAY_MARK_RE, "");

    return {
      number: block.number,
      question: questionText,
      question_type: "essay",
      options: { a: "", b: "", c: "", d: "" },
      correct_answer: "",
      max_score: DEFAULT_ESSAY_SCORE,
      warnings,
    };
  }

  // Multiple choice
  if (!questionText && !isEssay) {
    return null; // options without a question stem
  }
  const options = { a: "", b: "", c: "", d: "" } as ParsedQuestion["options"];
  const letters = new Set(block.options.map((o) => o.letter));
  for (const o of block.options) {
    if (o.letter in options) options[o.letter as keyof typeof options] = o.text;
  }
  if (letters.has("e")) {
    warnings.push("Option E is not supported (the app has A–D). Its text was skipped.");
  }
  const missing = OPT_KEYS.filter((k) => !options[k].trim());
  if (missing.length > 0) {
    warnings.push(`Missing option${missing.length > 1 ? "s" : ""}: ${missing.map((k) => k.toUpperCase()).join(", ")}.`);
  }
  return {
    number: block.number,
    question: questionText,
    question_type: "multiple_choice",
    options,
    correct_answer: block.inlineAnswer ? block.inlineAnswer.toLowerCase() : "",
    max_score: DEFAULT_MC_SCORE,
    warnings,
  };
}

/**
 * Parse pasted exam text into structured questions.
 * Deterministic — no AI, no network. Unknown parts come back in
 * `skipped` / `unparsed` so the teacher always sees what happened.
 */
export function parseQuestions(input: string): ParseResult {
  const questions: ParsedQuestion[] = [];
  const skipped: string[] = [];
  const unparsed: { text: string; reason: string }[] = [];
  const keyMap = new Map<number, string>();
  const keyMisses: number[] = [];

  const lines = input.split(/\r?\n/).map(cleanLine);
  let block: Block | null = null;
  let blockComplete = false; // options already collected → plain lines start new segments
  let afterBlank = true;
  let keyBlockMode = false;
  let preamble: string[] = [];

  let pendingAnswer = ""; // answer found on the same line that starts a new question

  const flushBlock = () => {
    if (!block) return;
    const raw = [
      block.lines.join(" "),
      ...block.options.map((o) => `${o.letter.toUpperCase()}. ${o.text}`),
    ].filter(Boolean).join(" ").trim();
    const q = finalizeBlock(block);
    if (q) {
      questions.push(q);
    } else if (raw) {
      unparsed.push({ text: raw, reason: "Could not be recognized as a question" });
    }
    block = null;
    blockComplete = false;
  };

  for (const line of lines) {
    // ── Key block mode (after a "KUNCI JAWABAN" header) ──
    if (keyBlockMode) {
      if (!line) continue; // blank lines inside the key block are fine
      const pairs = parsePairLine(line);
      if (pairs) {
        for (const p of pairs) if (!keyMap.has(p.num)) keyMap.set(p.num, p.letter);
        continue;
      }
      // Not a key line. A section title ("SOAL ESSAY", "II. ESSAY") means
      // more questions follow — leave key mode and reprocess this line below.
      // Everything else (essay model answers, footers) stays skipped so it is
      // never turned into phantom questions.
      if (isSectionHeader(line)) {
        keyBlockMode = false;
        skipped.push(line);
        continue;
      }
      skipped.push(line);
      continue;
    }

    // ── Body mode ──
    if (!line) {
      afterBlank = true;
      continue;
    }

    // Standalone answer line for the current question: "Jawaban: B"
    const inlineAns = line.match(ANS_INLINE_RE);
    if (inlineAns && !(inlineAns[2] || "").trim() && block) {
      block.inlineAnswer = inlineAns[1].toLowerCase();
      afterBlank = false;
      continue;
    }

    // A line made only of number→letter pairs = headerless key list
    const pairs = parsePairLine(line);
    if (pairs) {
      flushBlock();
      for (const p of pairs) if (!keyMap.has(p.num)) keyMap.set(p.num, p.letter);
      afterBlank = false;
      continue;
    }

    // Bare header → everything after is the key block
    if (KEY_HEADER_RE.test(line)) {
      flushBlock();
      keyBlockMode = true;
      afterBlank = false;
      continue;
    }

    // "(Jawaban: B)" trailing the line → strip it, remember the answer
    let working = line;
    const trailing = working.match(ANS_TRAILING_RE);
    if (trailing) {
      working = working.replace(ANS_TRAILING_RE, "").trim();
      if (block) block.inlineAnswer = trailing[1].toLowerCase();
      else pendingAnswer = trailing[1].toLowerCase();
    }

    // New numbered question?
    const qNum = working.match(Q_NUM_RE);
    if (qNum) {
      flushBlock();
      let stem = qNum[2].trim();
      const explicitEssay = ESSAY_MARK_RE.test(stem);
      if (explicitEssay) stem = stem.replace(ESSAY_MARK_RE, "").trim();
      // Options may ride on the same line: "1. She ... a book. A. read B. reads ..."
      const inline = extractInlineOptions(stem);
      block = {
        number: parseInt(qNum[1], 10),
        lines: [inline ? inline.question : stem].filter(Boolean),
        options: inline ? inline.options : [],
        inlineAnswer: pendingAnswer,
        warnings: [],
        explicitEssay,
      };
      pendingAnswer = "";
      blockComplete = !!inline; // options already collected when they rode on this line
      afterBlank = false;
      continue;
    }

    // Options written inline on their own line (question stem wrapped above):
    // "A. go B. goes C. going D. gone"
    if (block && (working.match(OPT_MARK_COUNT_RE) || []).length >= 3) {
      const inline = extractInlineOptions(working);
      if (inline) {
        if (inline.question) block.lines.push(inline.question);
        block.options.push(...inline.options);
        blockComplete = true;
        afterBlank = false;
        continue;
      }
    }

    // Option line?
    const opt = working.match(OPT_RE);
    if (opt && block) {
      block.options.push({ letter: opt[1].toLowerCase(), text: opt[2].trim() });
      blockComplete = true;
      afterBlank = false;
      continue;
    }

    // Continuation of the current question / option text
    if (block && !blockComplete && !afterBlank) {
      // A wrapped line may carry the inline options, e.g. "... A. go B. goes ..."
      const inline = extractInlineOptions(working);
      if (inline) {
        if (inline.question) block.lines.push(inline.question);
        block.options.push(...inline.options);
        blockComplete = true;
      } else {
        block.lines.push(working);
      }
      continue;
    }
    if (block && blockComplete && !afterBlank && block.options.length > 0) {
      // wraps to the last option's text
      const lastOpt = block.options[block.options.length - 1];
      lastOpt.text = `${lastOpt.text} ${working}`.trim();
      continue;
    }

    // Anything else: before the first question = preamble (title/instructions);
    // later = text we could not attach to anything.
    if (questions.length === 0 && !block) {
      preamble.push(working);
    } else {
      skipped.push(working);
    }
    afterBlank = false;
  }
  flushBlock();
  if (preamble.length > 0) skipped.unshift(...preamble);

  // ── Apply the answer key ──
  const applied = new Set<number>();
  for (const q of questions) {
    if (q.question_type !== "multiple_choice") continue;
    if (q.number != null && keyMap.has(q.number)) {
      q.correct_answer = keyMap.get(q.number)!;
      applied.add(q.number);
    }
  }
  for (const [num] of keyMap) {
    if (!applied.has(num)) keyMisses.push(num);
  }
  keyMisses.sort((a, b) => a - b);

  // Key found but no correct answer recorded on the question itself
  for (const q of questions) {
    if (q.question_type === "multiple_choice" && !q.correct_answer) {
      q.warnings.push("No answer key found — tap the correct answer before saving.");
    }
  }

  return { questions, skipped, unparsed, keyMisses };
}
