import fs from 'fs';
import path from 'path';

interface TermOccurrence {
    docId: number;
    position: number;
}

class IndexConstructor {
    private readonly inputDir: string;
    private readonly outputDir: string;

    constructor() {
        this.inputDir = path.join(__dirname, '../output_tokenizer');
        this.outputDir = path.join(__dirname, '../output_index_construct');
    }

    // Read doc_index.txt from tokenizer output
    private readDocIndex(): Map<number, TermOccurrence[]> {
        const docIndexPath = path.join(this.inputDir, 'doc_index.txt');
        
        if (!fs.existsSync(docIndexPath)) {
            throw new Error('doc_index.txt not found in output_tokenizer directory');
        }

        const termMap = new Map<number, TermOccurrence[]>();
        const content = fs.readFileSync(docIndexPath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());

        for (const line of lines) {
            const [docId, termId, ...positions] = line.split('\t').map(Number);
            
            if (!termMap.has(termId)) {
                termMap.set(termId, []);
            }
            
            positions.forEach(position => {
                termMap.get(termId)!.push({ docId, position });
            });
        }

        // Sort occurrences for each term by docId and position
        for (const occurrences of termMap.values()) {
            occurrences.sort((a, b) => 
                a.docId === b.docId ? a.position - b.position : a.docId - b.docId
            );
        }

        return termMap;
    }

    // Apply delta encoding to a term's occurrences
    private deltaEncode(occurrences: TermOccurrence[]): string {
        const result: string[] = [];
        let lastDocId = 0;
        let lastPosition = 0;

        for (let i = 0; i < occurrences.length; i++) {
            const curr = occurrences[i];
            
            if (i === 0 || curr.docId !== lastDocId) {
                // New document - reset position delta and use full docId
                result.push(`${curr.docId - lastDocId}:${curr.position}`);
                lastPosition = curr.position;
            } else {
                // Same document - use position delta
                result.push(`0:${curr.position - lastPosition}`);
                lastPosition = curr.position;
            }
            
            lastDocId = curr.docId;
        }

        return result.join('\t');
    }

    // Create or clear output directory
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

    // Create term_index.txt and term_info.txt
    private constructIndex(termMap: Map<number, TermOccurrence[]>): void {
        const termIndexPath = path.join(this.outputDir, 'term_index.txt');
        const termInfoPath = path.join(this.outputDir, 'term_info.txt');
        
        let termIndexContent = '';
        let termInfoContent = '';
        let byteOffset = 0;

        // Process terms in ascending order
        const sortedTerms = Array.from(termMap.keys()).sort((a, b) => a - b);
        
        for (const termId of sortedTerms) {
            const occurrences = termMap.get(termId)!;
            
            // Calculate term statistics
            const totalOccurrences = occurrences.length;
            const uniqueDocuments = new Set(occurrences.map(o => o.docId)).size;
            
            // Create term index line with delta encoding
            const termLine = `${termId}\t${this.deltaEncode(occurrences)}\n`;
            termIndexContent += termLine;
            
            // Create term info line
            termInfoContent += `${termId}\t${byteOffset}\t${totalOccurrences}\t${uniqueDocuments}\n`;
            
            // Update byte offset for next term
            byteOffset += Buffer.from(termLine).length;
        }

        // Write output files
        fs.writeFileSync(termIndexPath, termIndexContent);
        fs.writeFileSync(termInfoPath, termInfoContent);
        
        console.log('Index construction completed. Output files written to:', this.outputDir);
        console.log('Files created:');
        console.log('- term_index.txt');
        console.log('- term_info.txt');
    }

    public run(): void {
        console.log('Reading doc_index.txt from tokenizer_output...');
        const termMap = this.readDocIndex();
        console.log('Constructing inverted index...');
        this.setupOutputDirectory();
        this.constructIndex(termMap);
    }
}

// Main execution
if (require.main === module) {
    try {
        const indexConstructor = new IndexConstructor();
        indexConstructor.run();
    } catch (error) {
        console.error('Error during index construction:', error);
        process.exit(1);
    }
}
