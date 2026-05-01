export function extractDays(text) {
  if (!text) return 999;

  if (text.includes("dia")) {
    const match = text.match(/(\d+)/);
    return match ? parseInt(match[1]) : 999;
  }

  if (text.includes("hora")) return 0;

  return 999;
}

export function isWordPress(skills) {
  return skills?.toLowerCase().includes("wordpress");
}