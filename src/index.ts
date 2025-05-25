// File: tokenizer.ts

import fs from 'fs';
import path from 'path';
import cheerio from 'cheerio';
import natural from 'natural';
import stopword from 'stopword';

const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;

const STOPWORDS: Set<string> = new Set(stopword.en);
const TOKEN_REGEX = /\w+(\.?\w+)*/g;

const corpusDir = process.argv[2];
if (!corpusDir) {
  console.error('Usage: node tokenizer.ts <directory-path>');
  process.exit(1);
}

const docIdsPath = path.join(__dirname, 'docids.txt');
const termIdsPath = path.join(__dirname, 'termids.txt');
const docIndexPath = path.join(__dirname, 'doc_index.txt');

const docIdMap: Map<string, number> = new Map();
const termIdMap: Map<string, number> = new Map();
let docIdCounter = 1;
let termIdCounter = 1;

const docIndexEntries: string[] = [];

function processFile(filePath: string, fileName: string): void {
  const content = fs.readFileSync(filePath, 'utf-8');
  const html = content.replace(/^[\s\S]*?<html/i, '<html');
  const $ = cheerio.load(html);
  const text = $('body').text();

  const tokens = text.match(TOKEN_REGEX) || [];
  const normalized = tokens.map(t => stemmer.stem(t.toLowerCase())).filter(t => !STOPWORDS.has(t));

  const docId = docIdCounter++;
  docIdMap.set(fileName, docId);

  const termPositions: Map<number, number[]> = new Map();
  normalized.forEach((term, i) => {
    if (!termIdMap.has(term)) termIdMap.set(term, termIdCounter++);
    const termId = termIdMap.get(term)!;
    if (!termPositions.has(termId)) termPositions.set(termId, []);
    termPositions.get(termId)!.push(i + 1);
  });

  for (const [termId, positions] of termPositions.entries()) {
    docIndexEntries.push(`${docId}\t${termId}\t${positions.join('\t')}`);
  }
}

const files = fs.readdirSync(corpusDir);
files.forEach(file => {
  const fullPath = path.join(corpusDir, file);
  if (fs.statSync(fullPath).isFile()) {
    processFile(fullPath, file);
  }
});

fs.writeFileSync(
  docIdsPath,
  Array.from(docIdMap.entries())
    .map(([name, id]) => `${id}\t${name}`)
    .join('\n'),
);
fs.writeFileSync(
  termIdsPath,
  Array.from(termIdMap.entries())
    .map(([term, id]) => `${id}\t${term}`)
    .join('\n'),
);
fs.writeFileSync(docIndexPath, docIndexEntries.join('\n'));

console.log('Tokenization completed. Output files written:');
console.log(docIdsPath);
console.log(termIdsPath);
console.log(docIndexPath);
