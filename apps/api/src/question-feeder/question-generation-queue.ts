// Split from question-generation.processor.ts to avoid a circular import:
// question-feeder.service.ts needs this constant (to register a topic's
// repeat job) and question-generation.processor.ts needs QuestionFeederService
// — importing the processor file from the service (or vice versa) for just
// this constant created a cycle that broke Nest's DI resolution.
export const QUESTION_GENERATION_QUEUE = "question-generation";
