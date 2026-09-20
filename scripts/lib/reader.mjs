// 构建期只剥内部段与编辑句，不再做语域词典改写。
// 读者口径写在 CSV / Markdown 源头；这里只防止生产便笺漏进制品。
// 只删真正的内部便笺。史学术语与作者克制语（待核、待查、待回、待补、未拆、未开、仅登记、本库、本表）
// 一律放行：docs/04 §13.3 明确把「待核 / 未回原文 / 只登记入口」列为应保留的证据克制腔，
// 原先的删除表与此规范相冲突，会把作者写好的句子从站点成品里静默删掉（2026-09-11 收窄）。
const EDITORIAL_COPY = /待用户|抽查|审核|复核人|录入人|责任人|工作流|任务队列|尚无专章|条次未|索引未|H1|E1|S\s*二手/;

function readerCopy(value) {
  return String(value || '').trim();
}

function readerProse(value, meta = {}) {
  const text = readerCopy(value);
  if (!text) return '';
  const kept = [];
  for (const raw of (text.match(/[^!！?？。；;]+[!！?？。；;]?/g) || [text])) {
    const sentence = raw.trim();
    if (!sentence) continue;
    if (EDITORIAL_COPY.test(sentence)) {
      const where = meta.file ? `${meta.file}${meta.field ? '#' + meta.field : ''}` : (meta.field || 'unknown');
      console.warn(`[readerProse] 删句 ${where}: ${sentence.slice(0, 120)}`);
      continue;
    }
    kept.push(sentence);
  }
  return kept.join('');
}

function readerMetadata(value) {
  return String(value || '').replace(/待核权/g, '商业使用条件尚未确认，请以来源机构最新权利说明为准');
}

function stripInternalComments(src) {
  return String(src || '')
    .replace(/<!--internal[\s\S]*?-->/gi, '')
    .replace(/^## 编辑备注[\s\S]*?(?=^## )/gm, '')
    .replace(/^## 编辑备注[\s\S]*$/gm, '')
    // 「## 边界」按内部编辑节处理：不进公开正文，源文件与 #/data 保留原文。
    // 想让边界说明在页面上折叠展示：注释掉下面两行，并把 build-site.mjs 里的边界删除改成 details 折叠。
    .replace(/^## 边界[\s\S]*?(?=^## )/gm, '')
    .replace(/^## 边界[\s\S]*$/gm, '');
}

export { EDITORIAL_COPY, readerCopy, readerProse, readerMetadata, stripInternalComments };
