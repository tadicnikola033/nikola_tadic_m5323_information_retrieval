import { spawn } from 'child_process';
import { join } from 'path';

interface TestCase {
    name: string;
    args: string[];
    expectedOutputContains: string[];
    expectedErrorContains?: string[];
}

const testCases: TestCase[] = [
    {
        name: 'Document info test',
        args: ['--doc', 'clueweb12-0000tw-13-04988'],
        expectedOutputContains: [
            'Listing for document: clueweb12-0000tw-13-04988',
            'DOCID: 2',
            'Distinct terms: 255',
            'Total terms: 414'
        ]
    },
    {
        name: 'Term info test',
        args: ['--term', 'computer'],
        expectedOutputContains: [
            'Listing for term: computer',
            'TERMID: 6101',
            'Number of documents containing term: 340',
            'Term frequency in corpus: 1166',
            'Inverted list offset: 28230787'
        ]
    },
    // TODO: Add a positive test case for term-document lookup once we identify
    // a term that exists in document clueweb12-0000tw-13-04988
    {
        name: 'Term and document info test (term not in document)',
        args: ['--term', 'computer', '--doc', 'clueweb12-0000tw-13-04988'],
        expectedOutputContains: [],
        expectedErrorContains: ['Term not found in document']
    },
    {
        name: 'Non-existent document test',
        args: ['--doc', 'non-existent-doc'],
        expectedOutputContains: [],
        expectedErrorContains: ['Document not found']
    },
    {
        name: 'Non-existent term test',
        args: ['--term', 'xyznonexistentterm'],
        expectedOutputContains: [],
        expectedErrorContains: ['Term not found']
    }
];

async function runTest(testCase: TestCase): Promise<boolean> {
    return new Promise((resolve) => {
        console.log(`\nRunning test: ${testCase.name}`);
        console.log('Command:', 'node', ['dist/read.js', ...testCase.args].join(' '));

        const child = spawn('node', ['dist/read.js', ...testCase.args], {
            cwd: process.cwd()
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            console.log('\nOutput:', stdout || '(no output)');
            if (stderr) console.log('Errors:', stderr);
            
            let passed = true;
            
            // Check expected output
            for (const expected of testCase.expectedOutputContains) {
                if (!stdout.includes(expected)) {
                    console.log(`❌ Expected output to contain: "${expected}"`);
                    passed = false;
                } else {
                    console.log(`✅ Found expected output: "${expected}"`);
                }
            }

            // Check expected errors
            if (testCase.expectedErrorContains) {
                for (const expected of testCase.expectedErrorContains) {
                    if (!stderr.includes(expected)) {
                        console.log(`❌ Expected error to contain: "${expected}"`);
                        passed = false;
                    } else {
                        console.log(`✅ Found expected error: "${expected}"`);
                    }
                }
            }

            console.log(`\nTest ${passed ? 'PASSED ✅' : 'FAILED ❌'}`);
            resolve(passed);
        });
    });
}

async function runAllTests() {
    console.log('Starting tests...\n');
    
    let passed = 0;
    let failed = 0;

    for (const testCase of testCases) {
        const success = await runTest(testCase);
        if (success) passed++;
        else failed++;
    }

    console.log('\n=== Test Summary ===');
    console.log(`Total tests: ${testCases.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    
    process.exit(failed > 0 ? 1 : 0);
}

// Run the tests
runAllTests().catch(error => {
    console.error('Test execution error:', error);
    process.exit(1);
}); 