import { BadRequestException } from "@nestjs/common";
import { ZodSchema } from "zod";

export function parseOrThrow<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new BadRequestException(result.error.flatten());
  }
  return result.data;
}
