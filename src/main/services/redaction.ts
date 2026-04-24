const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{12,}\b/g,
  /\bBearer\s+[A-Za-z0-9._-]{12,}\b/gi,
  /\b(api[_-]?key|token|password|secret)\s*[:=]\s*["']?[^"'\s,;]+/gi,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g
];

export function redactSensitiveText(input: string): string {
  let output = input;
  for (const pattern of SECRET_PATTERNS) {
    output = output.replace(pattern, (match) => {
      if (match.includes("@")) {
        return "[redacted-email]";
      }
      const [prefix] = match.split(/[:=]/);
      return prefix && prefix !== match ? `${prefix.trim()}=[redacted]` : "[redacted]";
    });
  }
  return output;
}
