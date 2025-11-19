import { z } from 'zod';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const BenchmarkResult = z.object({
    name: z.coerce.string(),
    value: z.coerce.number(),
    range: z.coerce.string().optional(),
    unit: z.coerce.string(),
    extra: z.coerce.string().optional(),
});

export type BenchmarkResult = z.infer<typeof BenchmarkResult>;

// eslint-disable-next-line @typescript-eslint/naming-convention
export const BenchmarkResults = z.array(BenchmarkResult);
