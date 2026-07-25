/**
 * **CSV 纯文本工具**（无 I/O、无 DOM）：单元格转义与 UTF-8 BOM 前缀，供导出、报表等复用。
 *
 * 上游：任意需生成 CSV 字符串的模块（如 `generateAccountsTabHelpers`）。
 */

export function escapeCsvCell(v: string): string {
  if (/[",\r\n]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

/** 为整段 CSV 正文加 UTF-8 BOM，便于 Excel 等正确识别中文。 */
export function prefixUtf8Bom(body: string): string {
  return `\uFEFF${body}`;
}
