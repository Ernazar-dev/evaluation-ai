// Extract plain text from an uploaded submission file for AI analysis.
// Supports .pdf (pdf-parse), .docx (mammoth), .pptx (zip + slide XML) and plain
// text formats. Callers need to know whether extraction actually succeeded —
// a file we could not read must NOT be treated as "the student wrote nothing",
// so the result carries an `extracted` flag alongside the text.

import fs from 'fs/promises';
import path from 'path';
import mammoth from 'mammoth';
import AdmZip from 'adm-zip';
// pdf-parse's package entry runs a debug harness when imported directly;
// the lib file is the documented way to import it from ESM.
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

const TEXT_EXTS = new Set(['.py', '.java', '.cpp', '.js', '.txt', '.md', '.c', '.h', '.ts']);

/** Collapses runs of whitespace so length checks reflect real content. */
function normalize(text) {
  return String(text || '').replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

/** Pulls the visible text out of every slide of a .pptx (Office Open XML). */
function extractPptx(filePath) {
  const zip = new AdmZip(filePath);
  const slides = zip
    .getEntries()
    .filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
    // slide2 must not sort before slide10
    .sort((a, b) => {
      const n = (e) => Number(e.entryName.match(/slide(\d+)\.xml$/)[1]);
      return n(a) - n(b);
    });

  return slides
    .map((entry, i) => {
      const xml = entry.getData().toString('utf-8');
      const runs = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => m[1]);
      const text = runs
        .join(' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
      return `--- Slide ${i + 1} ---\n${text}`;
    })
    .join('\n\n');
}

/**
 * Reads a submission file and returns `{ text, extracted, note }`.
 *  - `text`      the extracted content (may be empty)
 *  - `extracted` true only when we genuinely read the document's text
 *  - `note`      short human-readable reason when `extracted` is false
 */
export async function extractFileContent(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  try {
    if (ext === '.pdf') {
      const buf = await fs.readFile(filePath);
      const { text } = await pdfParse(buf);
      const clean = normalize(text);
      if (clean.length)
        return { text: clean, extracted: true, note: null };
      // Scanned/image-only PDF — there is no text layer to read.
      return { text: '', extracted: false, note: 'PDF has no text layer (likely a scan)' };
    }

    if (ext === '.docx') {
      const { value } = await mammoth.extractRawText({ path: filePath });
      const clean = normalize(value);
      return clean.length
        ? { text: clean, extracted: true, note: null }
        : { text: '', extracted: false, note: 'DOCX contained no readable text' };
    }

    if (ext === '.pptx') {
      const clean = normalize(extractPptx(filePath));
      return clean.length
        ? { text: clean, extracted: true, note: null }
        : { text: '', extracted: false, note: 'PPTX contained no readable text' };
    }

    if (ext === '.doc' || ext === '.ppt') {
      // Legacy binary Office formats — no pure-JS parser available.
      return { text: '', extracted: false, note: `Legacy ${ext} format cannot be parsed` };
    }

    if (TEXT_EXTS.has(ext)) {
      return { text: normalize(await fs.readFile(filePath, 'utf-8')), extracted: true, note: null };
    }

    // Unknown extension — try utf-8, then latin1.
    try {
      return { text: normalize(await fs.readFile(filePath, 'utf-8')), extracted: true, note: null };
    } catch {
      return { text: normalize(await fs.readFile(filePath, 'latin1')), extracted: true, note: null };
    }
  } catch (e) {
    return { text: '', extracted: false, note: `Could not read file: ${e.message}` };
  }
}
