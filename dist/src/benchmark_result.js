"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BenchmarkResults = exports.BenchmarkResult = void 0;
const zod_1 = require("zod");
// eslint-disable-next-line @typescript-eslint/naming-convention
exports.BenchmarkResult = zod_1.z.object({
    name: zod_1.z.coerce.string(),
    value: zod_1.z.coerce.number(),
    range: zod_1.z.coerce.string().optional(),
    unit: zod_1.z.coerce.string(),
    extra: zod_1.z.coerce.string().optional(),
});
// eslint-disable-next-line @typescript-eslint/naming-convention
exports.BenchmarkResults = zod_1.z.array(exports.BenchmarkResult);
//# sourceMappingURL=benchmark_result.js.map