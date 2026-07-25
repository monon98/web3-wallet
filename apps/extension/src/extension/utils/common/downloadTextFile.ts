/**
 * **浏览器端文本文件下载**（Blob + 临时 `<a>` click），无业务语义。
 *
 * 上游：标签页导出、其它需触发本地下载的 UI。
 */

export function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.click();
  URL.revokeObjectURL(url);
}
