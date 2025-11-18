import { z } from 'zod';

export const BenchmarkResult = z.object({
    name: z.coerce.string(),
    value: z.coerce.number(),
    range: z.coerce.string().optional(),
    unit: z.coerce.string(),
    extra: z.coerce.string().optional(),
});

export type BenchmarkResult = z.infer<typeof BenchmarkResult>;

export const BenchmarkResults = z.array(BenchmarkResult);
