export function normalizeWbsCode(code: string) {
  return code.trim();
}

export function uniqueWbsCodes(codes: string[]) {
  const seen = new Set<string>();
  return codes
    .map(normalizeWbsCode)
    .filter((code) => {
      if (!code || seen.has(code)) return false;
      seen.add(code);
      return true;
    });
}
