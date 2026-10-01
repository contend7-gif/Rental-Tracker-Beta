export function recordPage<T>(records: T[], requestedPage: number, pageSize = 50) {
  const size = Math.max(1, Math.floor(pageSize) || 50);
  const total = records.length;
  const pageCount = Math.ceil(total / size);
  const page = Math.max(0, Math.min(Math.floor(requestedPage) || 0, Math.max(0, pageCount - 1)));
  const start = page * size;
  const end = Math.min(start + size, total);
  return { records: records.slice(start, end), page, pageCount, start, end, total };
}
