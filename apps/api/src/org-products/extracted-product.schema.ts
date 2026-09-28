import { z } from "zod";

// What the LLM extracts from a raw sheet — validated or the import run fails
// loudly (same "malformed model output fails the run loudly" posture as
// QuestionVariantSchema, ../question-feeder/question-variant.schema.ts).
export const ExtractedProductSchema = z.object({
  nameEn: z.string().min(1),
  // The seller's own product code, when their sheet has one. Optional because
  // plenty of small sellers keep no codes at all — where it exists it becomes
  // the product's identity across re-imports, so a rename stays a rename.
  sku: z.string().min(1).max(120).optional(),
  unitSpec: z.string().optional(),
  marketPricePaise: z.number().int().positive(),
  salePricePaise: z.number().int().positive(),
  quantityAvailable: z.number().int().min(0),
  photoUrl: z.string().url().optional(),
});
export type ExtractedProduct = z.infer<typeof ExtractedProductSchema>;
