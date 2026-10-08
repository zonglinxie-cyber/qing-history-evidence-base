import { readerCopy, readerProse, stripInternalComments } from './lib/reader.mjs';
import { inlineMd, mdToHtml, publicBodyHtml } from './lib/chapter-html.mjs';

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

// 回归：「<!--internal--> … -->」整节标记。开标记自身就带 -->，懒匹配会先吃掉开标记、
// 把整节内容留在正文里；现在必须整节剥掉。
check('internal 整节标记被剥离',
  !stripInternalComments('前文\n<!--internal-->\n## 待办\n1. 内部事项\n-->\n后文').includes('内部事项'));

// 回归：括号 URL 的 Markdown 链接必须渲染完整 href（曾断在第一个 )）。
check('Markdown 括号链接渲染完整 href',
  inlineMd('[示例](https://example.com/a_(b))').includes('href="https://example.com/a_(b)"'));

// 回归：仓库内相对链接（.md、../）在站点上无处可达，渲染为纯文字，不生死链。
{
  const out = inlineMd('见 [对照表](实录卷次对照.md) 与 [提案](../_data-proposals/x.md)。');
  check('仓库内相对链接不生 href="#" 死链', !out.includes('href="#"') && out.includes('对照表'));
}

// 回归：含内部工件标记的整段不进 bodyHtml；读者能懂的史料限度句保留。
{
  const body = publicBodyHtml(mdToHtml([
    '{{fig:QH-V-E01}}',
    '本段附图台账 SRC-147，合并前不要双主键。',
    '示意图路径 ../_cross-cutting-proposals/ai-schematics/x.png，不得写入 {{fig:QH-V-XX}}。',
    '五大臣列传未开，不写各人卒年。',
  ].join('\n\n')), {});
  check('内部工件段落不进入公开正文', !/SRC-\d+|台账|ai-schematics|_data-proposals|双主键|不得写入|\{\{fig/.test(body));
  check('可读的史料限度句保留', body.includes('五大臣列传未开'));
}

// 回归：裸写/反引号写的库内编号一律中性化成可读入口，不把档号印上页面。
{
  const body = publicBodyHtml(mdToHtml('| 人物 | 状态 |\n|---|---|\n| 刘统勋 | `CAND-XX-1` |\n\n冲突组 `QH-CF-XX-1`。见 `QH-ST-9999`。'));
  check('库内编号不露在公开正文', !/QH-CF|CAND-|SRC-\d|QH-ST-/.test(body.replace(/<[^>]+>/g, '')));
}

if (failed) {
  console.error(`reader 单测 ${failed} 项失败`);
  process.exit(1);
}
console.log('reader 单测全部通过');
