import fs from 'fs';
import path from 'path';
import * as natural from 'natural';
import { program } from 'commander';

const stemmer = natural.PorterStemmer;

interface TermInfo {
    termId: number;
    offset: number;
    totalOccurrences: number;
    documentCount: number;
}

interface DocInfo {
    docId: number;
    distinctTerms: Set<number>;
    totalTerms: number;
}

class IndexReader {
    private docIdMap: Map<string, number>;
    private reverseDocIdMap: Map<number, string>;
    private termIdMap: Map<string, number>;
    private reverseTermIdMap: Map<number, string>;
    private termInfoMap: Map<number, TermInfo>;
    private docInfoMap: Map<number, DocInfo>;

    constructor() {
        this.docIdMap = new Map();
        this.reverseDocIdMap = new Map();
        this.termIdMap = new Map();
        this.reverseTermIdMap = new Map();
        this.termInfoMap = new Map();
        this.docInfoMap = new Map();
        this.loadMappings();
    }

    private loadMappings(): void {
        // Load docids.txt
        const docIdsContent = fs.readFileSync(path.join(__dirname, '../output_tokenizer/docids.txt'), 'utf-8');
        docIdsContent.split('\n').filter(line => line.trim()).forEach(line => {
            const [id, name] = line.split('\t');
            this.docIdMap.set(name, parseInt(id));
            this.reverseDocIdMap.set(parseInt(id), name);
        });

        // Load termids.txt
        const termIdsContent = fs.readFileSync(path.join(__dirname, '../output_tokenizer/termids.txt'), 'utf-8');
        termIdsContent.split('\n').filter(line => line.trim()).forEach(line => {
            const [id, term] = line.split('\t');
            this.termIdMap.set(term, parseInt(id));
            this.reverseTermIdMap.set(parseInt(id), term);
        });

        // Load term_info.txt
        const termInfoContent = fs.readFileSync(path.join(__dirname, '../output_index_construct/term_info.txt'), 'utf-8');
        termInfoContent.split('\n').filter(line => line.trim()).forEach(line => {
            const [termId, offset, occurrences, docCount] = line.split('\t').map(Number);
            this.termInfoMap.set(termId, {
                termId,
                offset,
                totalOccurrences: occurrences,
                documentCount: docCount
            });
        });

        // Process doc_index.txt to build document statistics
        const docIndexContent = fs.readFileSync(path.join(__dirname, '../output_tokenizer/doc_index.txt'), 'utf-8');
        docIndexContent.split('\n').filter(line => line.trim()).forEach(line => {
            const [docId, termId, ...positions] = line.split('\t').map(Number);
            
            if (!this.docInfoMap.has(docId)) {
                this.docInfoMap.set(docId, {
                    docId,
                    distinctTerms: new Set(),
                    totalTerms: 0
                });
            }
            
            const docInfo = this.docInfoMap.get(docId)!;
            docInfo.distinctTerms.add(termId);
            docInfo.totalTerms += positions.length;
        });
    }

    public getDocumentInfo(docName: string): void {
        const docId = this.docIdMap.get(docName);
        if (!docId) {
            console.error('Document not found:', docName);
            return;
        }

        const docInfo = this.docInfoMap.get(docId);
        if (!docInfo) {
            console.error('Document information not found:', docName);
            return;
        }

        console.log(`\nListing for document: ${docName}`);
        console.log(`DOCID: ${docId}`);
        console.log(`Distinct terms: ${docInfo.distinctTerms.size}`);
        console.log(`Total terms: ${docInfo.totalTerms}`);
    }

    public getTermInfo(term: string): void {
        const stemmedTerm = stemmer.stem(term.toLowerCase());
        const termId = this.termIdMap.get(stemmedTerm);
        if (!termId) {
            console.error('Term not found:', term);
            return;
        }

        const termInfo = this.termInfoMap.get(termId);
        if (!termInfo) {
            console.error('Term information not found:', term);
            return;
        }

        console.log(`\nListing for term: ${term}`);
        console.log(`TERMID: ${termId}`);
        console.log(`Number of documents containing term: ${termInfo.documentCount}`);
        console.log(`Term frequency in corpus: ${termInfo.totalOccurrences}`);
        console.log(`Inverted list offset: ${termInfo.offset}`);
    }

    public getTermDocumentInfo(term: string, docName: string): void {
        const stemmedTerm = stemmer.stem(term.toLowerCase());
        const termId = this.termIdMap.get(stemmedTerm);
        const docId = this.docIdMap.get(docName);

        if (!termId || !docId) {
            console.error('Term or document not found');
            return;
        }

        const termInfo = this.termInfoMap.get(termId);
        if (!termInfo) {
            console.error('Term information not found');
            return;
        }

        // Read the inverted list from term_index.txt at the specific offset
        const fd = fs.openSync(path.join(__dirname, '../output_index_construct/term_index.txt'), 'r');
        const buffer = Buffer.alloc(4096); // Reasonable buffer size
        fs.readSync(fd, buffer, 0, buffer.length, termInfo.offset);
        fs.closeSync(fd);

        const line = buffer.toString('utf-8').split('\n')[0];
        const [listTermId, ...postings] = line.split('\t');

        // Decode delta-encoded positions for the specific document
        let currentDocId = 0;
        let positions: number[] = [];
        let found = false;

        for (const posting of postings) {
            const [docDelta, pos] = posting.split(':').map(Number);
            currentDocId += docDelta;

            if (currentDocId === docId) {
                found = true;
                let currentPos = pos;
                positions.push(currentPos);

                // Continue reading positions for this document
                while (postings.indexOf(posting) + positions.length < postings.length) {
                    const nextPosting = postings[postings.indexOf(posting) + positions.length];
                    const [nextDocDelta, nextPos] = nextPosting.split(':').map(Number);
                    if (nextDocDelta === 0) {
                        currentPos += nextPos;
                        positions.push(currentPos);
                    } else {
                        break;
                    }
                }
                break;
            }
        }

        if (!found) {
            console.error('Term not found in document');
            return;
        }

        console.log(`\nInverted list for term: ${term}`);
        console.log(`In document: ${docName}`);
        console.log(`TERMID: ${termId}`);
        console.log(`DOCID: ${docId}`);
        console.log(`Term frequency in document: ${positions.length}`);
        console.log(`Positions: ${positions.join(', ')}`);
    }
}

// Set up command line interface
program
    .option('--doc <docName>', 'Document name')
    .option('--term <term>', 'Term to search for')
    .parse(process.argv);

const options = program.opts();

if (!options.doc && !options.term) {
    console.error('Please provide either --doc or --term option');
    process.exit(1);
}

try {
    const reader = new IndexReader();

    if (options.doc && options.term) {
        reader.getTermDocumentInfo(options.term, options.doc);
    } else if (options.doc) {
        reader.getDocumentInfo(options.doc);
    } else if (options.term) {
        reader.getTermInfo(options.term);
    }
} catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
}
