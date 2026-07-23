import { BadRequestException } from "@nestjs/common";
import { z, ZodSchema } from "zod";

// Inferring via `S extends ZodSchema<any>` + `z.infer<S>` (looked up from the
// resolved schema type) instead of a live generic `T` bound to `ZodSchema<T>`
// avoids a TS inference quirk where nested `.default()` fields come back
// optional instead of the schema's real (non-optional) parsed output type.
export function parseOrThrow<S extends ZodSchema<any>>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new BadRequestException(result.error.flatten());
  }
  return result.data;
}
