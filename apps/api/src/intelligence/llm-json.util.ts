// Models routinely wrap JSON answers in ```json fences despite being asked
// not to — stripping them here means every call site doesn't have to.
export function stripCodeFences(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return fenced ? fenced[1].trim() : text.trim();
}
