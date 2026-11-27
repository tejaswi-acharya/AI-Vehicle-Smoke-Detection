export function formatDate(iso) {
  return new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Kathmandu" });
}