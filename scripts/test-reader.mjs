import { readerCopy, readerProse, stripInternalComments, countReaderCopyRules } from './lib/reader.mjs';

let failed = 0;
function check(name, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ': ' + name);
  if (!cond) failed += 1;
}

check('冲突组改写成同组异说', readerCopy('冲突组 QH-CF-1') === '同组异说 QH-CF-1');
check('原子主张改成逐条结论', readerCopy('原子主张') === '逐条结论');
check('内部注释被剥离', stripInternalComments('可见<!--internal 秘密 -->正文') === '可见正文');
check('编辑备注标题块被剥离', !stripInternalComments('前文\n## 编辑备注\n内部句\n## 先说结论\n后文').includes('内部句'));
const dropped = [];
const origWarn = console.warn;
console.warn = (msg) => dropped.push(String(msg));
const prose = readerProse('这是读者句。责任人张三。另一句。', { file: 'fixture.csv', field: 'lede' });
console.warn = origWarn;
check('readerProse 丢掉编辑句', prose.includes('这是读者句') && !prose.includes('责任人'));
check('readerProse 删句有日志', dropped.some((line) => line.includes('fixture.csv') && line.includes('删句')));
check('readerCopy 规则可计数', countReaderCopyRules() > 10);

if (failed) {
  console.error(`reader 单测 ${failed} 项失败`);
  process.exit(1);
}
console.log('reader 单测全部通过');
