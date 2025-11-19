import { BenchmarkResult } from './benchmark_result';
import { XMLParser } from 'fast-xml-parser';

function extractCatch2ResultText(output: string): BenchmarkResult[] {
    // Example:

    // benchmark name samples       iterations    estimated <-- Start benchmark section
    //                mean          low mean      high mean <-- Ignored
    //                std dev       low std dev   high std dev <-- Ignored
    // ----------------------------------------------------- <-- Ignored
    // Fibonacci 20   100           2             8.4318 ms <-- Start actual benchmark
    //                43.186 us     41.402 us     46.246 us <-- Actual benchmark data
    //                11.719 us      7.847 us     17.747 us <-- Ignored

    const reTestCaseStart = /^benchmark name +samples +iterations +(estimated|est run time)/;
    const reBenchmarkStart = /(\d+) +(\d+) +(?:\d+(\.\d+)?) (?:ns|ms|us|s)\s*$/;
    const reBenchmarkValues =
        /^ +(\d+(?:\.\d+)?) (ns|us|ms|s) +(?:\d+(?:\.\d+)?) (?:ns|us|ms|s) +(?:\d+(?:\.\d+)?) (?:ns|us|ms|s)/;
    const reEmptyLine = /^\s*$/;
    const reSeparator = /^-+$/;

    const lines = output.split(/\r?\n/g);
    lines.reverse();
    let lnum = 0;
    function nextLine(): [string | null, number] {
        return [lines.pop() ?? null, ++lnum];
    }

    function extractBench(): BenchmarkResult | null {
        const startLine = nextLine()[0];
        if (startLine === null) {
            return null;
        }

        const start = startLine.match(reBenchmarkStart);
        if (start === null) {
            return null; // No more benchmark found. Go to next benchmark suite
        }

        const extra = `${start[1]} samples\n${start[2]} iterations`;
        const name = startLine.slice(0, start.index).trim();

        const [meanLine, meanLineNum] = nextLine();
        const mean = meanLine?.match(reBenchmarkValues);
        if (!mean) {
            throw new Error(
                `Mean values cannot be retrieved for benchmark '${name}' on parsing input '${
                    meanLine ?? 'EOF'
                }' at line ${meanLineNum}`,
            );
        }

        const value = parseFloat(mean[1]);
        const unit = mean[2];

        const [stdDevLine, stdDevLineNum] = nextLine();
        const stdDev = stdDevLine?.match(reBenchmarkValues);
        if (!stdDev) {
            throw new Error(
                `Std-dev values cannot be retrieved for benchmark '${name}' on parsing '${
                    stdDevLine ?? 'EOF'
                }' at line ${stdDevLineNum}`,
            );
        }

        const range = '± ' + stdDev[1].trim();

        // Skip empty line
        const [emptyLine, emptyLineNum] = nextLine();
        if (emptyLine === null || !reEmptyLine.test(emptyLine)) {
            throw new Error(
                `Empty line is not following after 'std dev' line of benchmark '${name}' at line ${emptyLineNum}`,
            );
        }

        return { name, value, range, unit, extra };
    }

    const ret = [];
    while (lines.length > 0) {
        // Search header of benchmark section
        const line = nextLine()[0];
        if (line === null) {
            break; // All lines were eaten
        }
        if (!reTestCaseStart.test(line)) {
            continue;
        }

        // Eat until a separator line appears
        for (;;) {
            const [line, num] = nextLine();
            if (line === null) {
                throw new Error(`Separator '------' does not appear after benchmark suite at line ${num}`);
            }
            if (reSeparator.test(line)) {
                break;
            }
        }

        let benchFound = false;
        for (;;) {
            const res = extractBench();
            if (res === null) {
                break;
            }
            ret.push(res);
            benchFound = true;
        }
        if (!benchFound) {
            throw new Error(`No benchmark found for bench suite. Possibly mangled output from Catch2:\n\n${output}`);
        }
    }

    return ret;
}

interface Result {
    value: string;
    lowerBound: string;
    upperBound: string;
    ci: string; // ci == "confidence interval"
}

interface Outliers {
    variance: string;
    lowMild: string;
    lowSevere: string;
    highMild: string;
    highSevere: string;
}

interface OverallResult {
    success: string;
    skips: string;
}

interface OverallResults {
    successes: string;
    failures: string;
    expectedFailures: string;
    skips: string;
}

interface Catch2Benchmark {
    name: string;
    samples: string;
    iterations: string;
    clockResolution: string;
    estimatedDuration: string;
    mean: Result;
    standardDeviation: Result;
    outliers: Outliers;
}

interface Section {
    BenchmarkResults: Catch2Benchmark | Catch2Benchmark[]; // eslint-disable-line @typescript-eslint/naming-convention
    OverallResults: OverallResults; // eslint-disable-line @typescript-eslint/naming-convention
}

interface TestCase {
    name: string;
    filename: string;
    line: string;
    BenchmarkResults: Catch2Benchmark | Catch2Benchmark[] | undefined; // eslint-disable-line @typescript-eslint/naming-convention
    Section: Section | Section[] | undefined; // eslint-disable-line @typescript-eslint/naming-convention
    OverallResult: OverallResult | undefined; // eslint-disable-line @typescript-eslint/naming-convention
}

interface Catch2TestRun {
    name: string;
    TestCase: TestCase | TestCase[]; // eslint-disable-line @typescript-eslint/naming-convention
    OverallResults: OverallResults; // eslint-disable-line @typescript-eslint/naming-convention
    OverallResultsCases: OverallResults; // eslint-disable-line @typescript-eslint/naming-convention
}

interface Catch2XML {
    xml: string;
    Catch2TestRun: Catch2TestRun; // eslint-disable-line @typescript-eslint/naming-convention
}

function parseBenchmark(benchmark: Catch2Benchmark, namePrefix: string): BenchmarkResult {
    return {
        name: 'Test Case: ' + namePrefix + ' — Benchmark: ' + benchmark.name,
        value: parseFloat(benchmark.mean.value),
        range: '± ' + benchmark.standardDeviation.value,
        unit: 'ns',
        extra: `${benchmark.samples} samples\n${benchmark.iterations} iterations`,
    };
}

function toArray<T>(obj: T | T[]): T[] {
    return Array.isArray(obj) ? obj : [obj];
}

function getBenchmarkArrayFromTestCase(obj: TestCase): Catch2Benchmark[] {
    let rv: Catch2Benchmark | Catch2Benchmark[] = [];
    if (typeof obj.BenchmarkResults !== 'undefined') {
        rv = obj.BenchmarkResults;
    }
    if (typeof obj.Section !== 'undefined') {
        rv = toArray(obj.Section)
            .map((obj) => obj.BenchmarkResults)
            .reduce((accum, curr) => [...toArray(accum), ...toArray(curr)], []);
    }

    return toArray(rv);
}

function extractCatch2ResultXML(output: string): BenchmarkResult[] {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
    });
    const parsedObj: Catch2XML = parser.parse(output);

    return toArray(parsedObj.Catch2TestRun.TestCase)
        .map((testCase) => {
            return getBenchmarkArrayFromTestCase(testCase).map((benchmark) => parseBenchmark(benchmark, testCase.name));
        })
        .reduce((prev, cur) => {
            return [...prev, ...cur];
        }, []);
}

export default function extractCatch2Result(output: string, fileSuffix: string): BenchmarkResult[] {
    console.log('Extracting Catch2 results');
    switch (fileSuffix) {
        case '.xml':
            console.log('Using XML Parser');
            return extractCatch2ResultXML(output);
        default:
            console.log('Using Text Parser');
            return extractCatch2ResultText(output);
    }
}
