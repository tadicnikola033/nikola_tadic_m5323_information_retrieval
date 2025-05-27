import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import * as natural from 'natural';

class Tokenizer {
    private readonly stemmer = natural.PorterStemmer;
    private readonly outputDir: string;
    private readonly corpusDir: string;
    private readonly STOPWORDS: Set<string>;
    private readonly TOKEN_REGEX = /\w+(\.?\w+)*/g;

    private readonly docIdMap: Map<string, number> = new Map();
    private readonly termIdMap: Map<string, number> = new Map();
    private docIdCounter = 1;
    private termIdCounter = 1;
    private readonly docIndexEntries: string[] = [];

    constructor(corpusDir: string) {
        if (!corpusDir) {
            throw new Error('Corpus directory path is required');
        }

        this.corpusDir = corpusDir;
        this.outputDir = path.join(__dirname, '../output_tokenizer');

        // Load stopwords
        const stoplistPath = path.join(__dirname, '../resources/stoplist.txt');
        const stoplistContent = fs.readFileSync(stoplistPath, 'utf-8');
        this.STOPWORDS = new Set(
            stoplistContent
                .split('\n')
                .map(word => word.trim())
                .filter(word => word)
        );
    }

    private setupOutputDirectory(): void {
        if (fs.existsSync(this.outputDir)) {
            // Clear existing directory contents
            fs.readdirSync(this.outputDir).forEach(file => {
                fs.unlinkSync(path.join(this.outputDir, file));
            });
        } else {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    private processFile(filePath: string, fileName: string): void {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const html = content.replace(/^[\s\S]*?<html/i, '<html');
            const $ = cheerio.load(html);
            const text = $('body').text();

            const tokens = text.match(this.TOKEN_REGEX) || [];
            const normalized = tokens
                .map(t => this.stemmer.stem(t.toLowerCase()))
                .filter(t => !this.STOPWORDS.has(t));

            const docId = this.docIdCounter++;
            this.docIdMap.set(fileName, docId);

            const termPositions: Map<number, number[]> = new Map();
            normalized.forEach((term, i) => {
                if (!this.termIdMap.has(term)) {
                    this.termIdMap.set(term, this.termIdCounter++);
                }
                const termId = this.termIdMap.get(term)!;
                if (!termPositions.has(termId)) {
                    termPositions.set(termId, []);
                }
                termPositions.get(termId)!.push(i + 1);
            });

            for (const [termId, positions] of termPositions.entries()) {
                this.docIndexEntries.push(`${docId}\t${termId}\t${positions.join('\t')}`);
            }
        } catch (error) {
            console.error(`Error processing file ${fileName}:`, error.message);
        }
    }

    private writeOutputFiles(): void {
        const docIdsPath = path.join(this.outputDir, 'docids.txt');
        const termIdsPath = path.join(this.outputDir, 'termids.txt');
        const docIndexPath = path.join(this.outputDir, 'doc_index.txt');

        fs.writeFileSync(
            docIdsPath,
            Array.from(this.docIdMap.entries())
                .map(([name, id]) => `${id}\t${name}`)
                .join('\n')
        );

        fs.writeFileSync(
            termIdsPath,
            Array.from(this.termIdMap.entries())
                .map(([term, id]) => `${id}\t${term}`)
                .join('\n')
        );

        fs.writeFileSync(docIndexPath, this.docIndexEntries.join('\n'));
    }

    public run(): void {
        this.setupOutputDirectory();

        const files = fs.readdirSync(this.corpusDir);
        const totalFiles = files.length;
        let processedFiles = 0;
        let skippedFiles = 0;

        files.forEach((file, index) => {
            const fullPath = path.join(this.corpusDir, file);
            try {
                if (fs.statSync(fullPath).isFile()) {
                    this.processFile(fullPath, file);
                    processedFiles++;
                    console.log(`${index + 1}/${totalFiles} files processed`);
                }
            } catch (error) {
                console.error(`Error accessing file ${file}:`, error.message);
                skippedFiles++;
            }
        });

        this.writeOutputFiles();

        console.log('\nProcessing Summary:');
        console.log(`Total files: ${totalFiles}`);
        console.log(`Successfully processed: ${processedFiles}`);
        console.log(`Skipped files: ${skippedFiles}`);
        console.log('\nOutput files written to:', this.outputDir);
        console.log('Files created:');
        console.log('- docids.txt');
        console.log('- termids.txt');
        console.log('- doc_index.txt');
    }
}

// Main execution
if (require.main === module) {
    try {
        const corpusDir = process.argv[2];
        if (!corpusDir) {
            console.error('Usage: node tokenizer.ts <directory-path>');
            process.exit(1);
        }

        const tokenizer = new Tokenizer(corpusDir);
        tokenizer.run();
    } catch (error) {
        console.error('Error during tokenization:', error);
        process.exit(1);
    }
}
