import fs from 'fs';
import path from 'path';

interface TermOccurrence {
    docId: number;
    position: number;
}

interface TermInfo {
    termId: number;
    occurrences: TermOccurrence[];
}

// Read doc_index.txt from tokenizer output
function readDocIndex(): Map<number, TermOccurrence[]> {
    const inputDir = path.join(__dirname, '../output_tokenizer');
    const docIndexPath = path.join(inputDir, 'doc_index.txt');
    
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
function deltaEncode(occurrences: TermOccurrence[]): string {
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
function setupOutputDirectory(): string {
    const outputDir = path.join(__dirname, '../output_index_construct');
    
    if (fs.existsSync(outputDir)) {
        // Clear existing directory contents
        fs.readdirSync(outputDir).forEach(file => {
            fs.unlinkSync(path.join(outputDir, file));
        });
    } else {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    return outputDir;
}

// Create term_index.txt and term_info.txt
function constructIndex(termMap: Map<number, TermOccurrence[]>): void {
    const outputDir = setupOutputDirectory();
    const termIndexPath = path.join(outputDir, 'term_index.txt');
    const termInfoPath = path.join(outputDir, 'term_info.txt');
    
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
        const termLine = `${termId}\t${deltaEncode(occurrences)}\n`;
        termIndexContent += termLine;
        
        // Create term info line
        termInfoContent += `${termId}\t${byteOffset}\t${totalOccurrences}\t${uniqueDocuments}\n`;
        
        // Update byte offset for next term
        byteOffset += Buffer.from(termLine).length;
    }

    // Write output files
    fs.writeFileSync(termIndexPath, termIndexContent);
    fs.writeFileSync(termInfoPath, termInfoContent);
    
    console.log('Index construction completed. Output files written to:', outputDir);
    console.log('Files created:');
    console.log('- term_index.txt');
    console.log('- term_info.txt');
}

try {
    console.log('Reading doc_index.txt from tokenizer_output...');
    const termMap = readDocIndex();
    console.log('Constructing inverted index...');
    constructIndex(termMap);
} catch (error) {
    console.error('Error during index construction:', error);
    process.exit(1);
}
