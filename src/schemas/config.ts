import { z } from "zod";

export const ConfigSchema = z.object({
  content: z.string().min(1).default("content"),
  output: z.string().min(1).default("blog.generated.ts"),
  format: z.enum(["ts", "json"]).default("ts"),
  categories: z.array(z.string().min(1)).optional().default([]),
  featured: z.string().optional(),
  strict: z.boolean().optional().default(false),
});

export type RawConfig = z.infer<typeof ConfigSchema>;
