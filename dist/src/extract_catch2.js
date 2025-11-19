"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = extractCatch2Result;
const fast_xml_parser_1 = require("fast-xml-parser");
function extractCatch2ResultText(output) {
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
    const reBenchmarkValues = /^ +(\d+(?:\.\d+)?) (ns|us|ms|s) +(?:\d+(?:\.\d+)?) (?:ns|us|ms|s) +(?:\d+(?:\.\d+)?) (?:ns|us|ms|s)/;
    const reEmptyLine = /^\s*$/;
    const reSeparator = /^-+$/;
    const lines = output.split(/\r?\n/g);
    lines.reverse();
    let lnum = 0;
    function nextLine() {
        var _a;
        return [(_a = lines.pop()) !== null && _a !== void 0 ? _a : null, ++lnum];
    }
    function extractBench() {
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
        const mean = meanLine === null || meanLine === void 0 ? void 0 : meanLine.match(reBenchmarkValues);
        if (!mean) {
            throw new Error(`Mean values cannot be retrieved for benchmark '${name}' on parsing input '${meanLine !== null && meanLine !== void 0 ? meanLine : 'EOF'}' at line ${meanLineNum}`);
        }
        const value = parseFloat(mean[1]);
        const unit = mean[2];
        const [stdDevLine, stdDevLineNum] = nextLine();
        const stdDev = stdDevLine === null || stdDevLine === void 0 ? void 0 : stdDevLine.match(reBenchmarkValues);
        if (!stdDev) {
            throw new Error(`Std-dev values cannot be retrieved for benchmark '${name}' on parsing '${stdDevLine !== null && stdDevLine !== void 0 ? stdDevLine : 'EOF'}' at line ${stdDevLineNum}`);
        }
        const range = '± ' + stdDev[1].trim();
        // Skip empty line
        const [emptyLine, emptyLineNum] = nextLine();
        if (emptyLine === null || !reEmptyLine.test(emptyLine)) {
            throw new Error(`Empty line is not following after 'std dev' line of benchmark '${name}' at line ${emptyLineNum}`);
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
function parseBenchmark(benchmark, namePrefix) {
    return {
        name: 'Test Case: ' + namePrefix + ' — Benchmark: ' + benchmark.name,
        value: parseFloat(benchmark.mean.value),
        range: '± ' + benchmark.standardDeviation.value,
        unit: 'ns',
        extra: `${benchmark.samples} samples\n${benchmark.iterations} iterations`,
    };
}
function extractCatch2ResultXML(output) {
    const parser = new fast_xml_parser_1.XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
    });
    const parsedObj = parser.parse(output);
    const testCases = parsedObj.Catch2TestRun.TestCase;
    if (Array.isArray(testCases)) {
        return testCases
            .map((testCase) => {
            return testCase.BenchmarkResults.map((benchmark) => parseBenchmark(benchmark, testCase.name));
        })
            .reduce((prev, cur) => {
            return [...prev, ...cur];
        }, []);
    }
    return testCases.BenchmarkResults.map((benchmark) => parseBenchmark(benchmark, testCases.name));
}
function extractCatch2Result(output, fileSuffix) {
    switch (fileSuffix) {
        case '.xml':
            return extractCatch2ResultXML(output);
        default:
            return extractCatch2ResultText(output);
    }
}
//# sourceMappingURL=extract_catch2.js.map