import { readerCopy, readerProse, stripInternalComments } from './lib/reader.mjs';

let failed = 0;
function check(name, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ': ' + name);
  if (!cond) failed += 1;
}

check('readerCopy 不再改写语域', readerCopy('原子主张 冲突组') === '原子主张 冲突组');
check('内部注释被剥离', stripInternalComments('可见<!--internal 秘密 -->正文') === '可见正文');
check('编辑备注标题块被剥离', !stripInternalComments('前文\n## 编辑备注\n内部句\n## 先说结论\n后文').includes('内部句'));
check('边界节不再被剥掉（0.8.0 起折叠展示）',
  stripInternalComments('前文\n## 边界\n限度句\n## 相关阅读\n后文').includes('限度句'));
check('史学克制语不再被删句', readerProse('这是读者句。此事待核，两说并存。', { file: 'fixture.csv', field: 'lede' })
  .includes('待核'));
const dropped = [];
const origWarn = console.warn;
console.warn = (msg) => dropped.push(String(msg));
const prose = readerProse('这是读者句。责任人张三。另一句。', { file: 'fixture.csv', field: 'lede' });
console.warn = origWarn;
check('readerProse 丢掉编辑句', prose.includes('这是读者句') && !prose.includes('责任人'));
check('readerProse 删句有日志', dropped.some((line) => line.includes('fixture.csv') && line.includes('删句')));

if (failed) {
  console.error(`reader 单测 ${failed} 项失败`);
  process.exit(1);
}
console.log('reader 单测全部通过');
