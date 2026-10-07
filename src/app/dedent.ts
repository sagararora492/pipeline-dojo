/** Remove the indentation shared by every non-blank line, and outer blank lines. */
export function dedent(text: string): string {
  const lines = text.replace(/^\s*\n|\n\s*$/g, '').split('\n');
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => /^ */.exec(l)![0].length));
  return lines.map((l) => l.slice(indent)).join('\n');
}
