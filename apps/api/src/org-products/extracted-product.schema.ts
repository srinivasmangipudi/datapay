import { z } from "zod";

// What the LLM extracts from a raw sheet — validated or the import run fails
// loudly (same "malformed model output fails the run loudly" posture as
// QuestionVariantSchema, ../question-feeder/question-variant.schema.ts).
export const ExtractedProductSchema = z.object({
  nameEn: z.string().min(1),
  unitSpec: z.string().optional(),
  marketPricePaise: z.number().int().positive(),
  salePricePaise: z.number().int().positive(),
  quantityAvailable: z.number().int().min(0),
  photoUrl: z.string().url().optional(),
});
export type ExtractedProduct = z.infer<typeof ExtractedProductSchema>;
