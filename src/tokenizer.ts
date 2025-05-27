import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import * as natural from 'natural';

const stemmer = natural.PorterStemmer;

const stoplistPath = path.join(__dirname, '../resources/stoplist.txt');
const stoplistContent = fs.readFileSync(stoplistPath, 'utf-8');
const STOPWORDS: Set<string> = new Set(
  stoplistContent
    .split('\n')
    .map(word => word.trim())
    .filter(word => word),
);

const TOKEN_REGEX = /\w+(\.?\w+)*/g;

const corpusDir = process.argv[2];
if (!corpusDir) {
  console.error('Usage: node tokenizer.ts <directory-path>');
  process.exit(1);
}

// Create output directory or clear existing one
const outputDir = path.join(__dirname, '../output_tokenizer');
if (fs.existsSync(outputDir)) {
  // Clear existing directory contents
  fs.readdirSync(outputDir).forEach(file => {
    fs.unlinkSync(path.join(outputDir, file));
  });
} else {
  fs.mkdirSync(outputDir, { recursive: true });
}

const docIdsPath = path.join(outputDir, 'docids.txt');
const termIdsPath = path.join(outputDir, 'termids.txt');
const docIndexPath = path.join(outputDir, 'doc_index.txt');

const docIdMap: Map<string, number> = new Map();
const termIdMap: Map<string, number> = new Map();
let docIdCounter = 1;
let termIdCounter = 1;

const docIndexEntries: string[] = [];

function processFile(filePath: string, fileName: string): void {
  try {
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
  } catch (error) {
    console.error(`Error processing file ${fileName}:`, error.message);
    return; // Skip this file and continue with others
  }
}

const files = fs.readdirSync(corpusDir);
const totalFiles = files.length;
let processedFiles = 0;
let skippedFiles = 0;

files.forEach((file, index) => {
  const fullPath = path.join(corpusDir, file);
  try {
    if (fs.statSync(fullPath).isFile()) {
      processFile(fullPath, file);
      processedFiles++;
      console.log(`${index + 1}/${totalFiles} files processed`);
    }
  } catch (error) {
    console.error(`Error accessing file ${file}:`, error.message);
    skippedFiles++;
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

console.log('\nProcessing Summary:');
console.log(`Total files: ${totalFiles}`);
console.log(`Successfully processed: ${processedFiles}`);
console.log(`Skipped files: ${skippedFiles}`);
console.log('\nOutput files written to:', outputDir);
console.log('Files created:');
console.log('- docids.txt');
console.log('- termids.txt');
console.log('- doc_index.txt');
