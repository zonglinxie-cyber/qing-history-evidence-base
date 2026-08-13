import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const __filename = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(__filename);
const phase0Dir = path.resolve(scriptDir, "..");
const dataDir = path.join(phase0Dir, "data");
const outputDir = path.join(phase0Dir, "outputs", "qing-history-phase0");
const previewDir = process.env.QH_PREVIEW_DIR || path.join("/tmp", "qing-history-phase0-previews");
const verificationPath = process.env.QH_VERIFICATION_PATH || path.join("/tmp", "qing-history-phase0-verification.ndjson");
const outputPath = path.join(outputDir, "清史证据库_Phase0_工作台.xlsx");

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });

const COLORS = {
  ink: "#1F2937",
  muted: "#667085",
  line: "#D6D3D1",
  paper: "#F7F4ED",
  panel: "#FFFDF8",
  vermilion: "#A63A2B",
  vermilionSoft: "#F6E7E3",
  indigo: "#294765",
  indigoSoft: "#E8EEF4",
  jade: "#2F6B57",
  jadeSoft: "#E5F1EC",
  amber: "#B7791F",
  amberSoft: "#FFF4D6",
  red: "#B42318",
  redSoft: "#FDE9E7",
  green: "#067647",
  greenSoft: "#E5F5ED",
  blueInput: "#EAF2FF",
};

const FONT_BODY = "Aptos";
const FONT_DISPLAY = "STSong";

const workbook = Workbook.create();
workbook.comments.setSelf({ displayName: "User" });

const dashboard = workbook.worksheets.add("仪表盘");
const emperorsSheet = workbook.worksheets.add("十二帝总档");
const emperorSourcesSheet = workbook.worksheets.add("帝王史料索引");
const portraitsSheet = workbook.worksheets.add("十二帝画像");
const tasksSheet = workbook.worksheets.add("持续任务队列");
const idSheet = workbook.worksheets.add("人物ID对照");
const cardsSheet = workbook.worksheets.add("十二帝研究卡");
const sourceUnitsSheet = workbook.worksheets.add("康熙来源单元");
const planSheet = workbook.worksheets.add("六批次计划");
const peopleSheet = workbook.worksheets.add("康雍50人");
const sourcesSheet = workbook.worksheets.add("来源版权台账");
const claimsSheet = workbook.worksheets.add("主张工作台");
const relationshipsSheet = workbook.worksheets.add("关系工作台");
const imagesSheet = workbook.worksheets.add("图像工作台");
const decisionsSheet = workbook.worksheets.add("决策日志");
const risksSheet = workbook.worksheets.add("风险登记");
const vocabSheet = workbook.worksheets.add("受控词表");

for (const sheet of [
  dashboard,
  emperorsSheet,
  emperorSourcesSheet,
  portraitsSheet,
  tasksSheet,
  idSheet,
  cardsSheet,
  sourceUnitsSheet,
  planSheet,
  peopleSheet,
  sourcesSheet,
  claimsSheet,
  relationshipsSheet,
  imagesSheet,
  decisionsSheet,
  risksSheet,
  vocabSheet,
]) {
  sheet.showGridLines = false;
}

function setTitle(sheet, lastCol, title, subtitle) {
  sheet.getRange(`A1:${lastCol}1`).merge();
  sheet.getRange("A1").values = [[title]];
  sheet.getRange("A1").format = {
    fill: COLORS.indigo,
    font: { name: FONT_DISPLAY, bold: true, color: "#FFFFFF", size: 19 },
    verticalAlignment: "center",
  };
  sheet.getRange("A1").format.rowHeight = 34;
  sheet.getRange(`A2:${lastCol}2`).merge();
  sheet.getRange("A2").values = [[subtitle]];
  sheet.getRange("A2").format = {
    fill: COLORS.indigoSoft,
    font: { name: FONT_BODY, color: COLORS.muted, italic: true, size: 10 },
    verticalAlignment: "center",
  };
  sheet.getRange("A2").format.rowHeight = 24;
}

function styleHeader(range) {
  range.format = {
    fill: COLORS.vermilion,
    font: { name: FONT_BODY, bold: true, color: "#FFFFFF", size: 10 },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
    borders: { preset: "outside", style: "thin", color: COLORS.vermilion },
  };
  range.format.rowHeight = 32;
}

function styleBody(range, { wrap = true, input = false } = {}) {
  range.format = {
    fill: input ? COLORS.blueInput : COLORS.panel,
    font: { name: FONT_BODY, color: COLORS.ink, size: 9 },
    verticalAlignment: "top",
    wrapText: wrap,
    borders: {
      insideHorizontal: { style: "thin", color: "#ECE9E2" },
      bottom: { style: "thin", color: "#ECE9E2" },
    },
  };
}

function styleBlankTemplate(range) {
  range.format = {
    fill: COLORS.blueInput,
    font: { name: FONT_BODY, color: COLORS.ink, size: 9 },
    verticalAlignment: "center",
    wrapText: true,
    borders: {
      insideHorizontal: { style: "thin", color: "#DDE6F2" },
      bottom: { style: "thin", color: "#DDE6F2" },
    },
  };
}

function addStatusFormatting(range) {
  range.conditionalFormats.deleteAll();
  range.conditionalFormats.add("containsText", {
    text: "已完成",
    format: { fill: COLORS.greenSoft, font: { color: COLORS.green, bold: true } },
  });
  range.conditionalFormats.add("containsText", {
    text: "已通过",
    format: { fill: COLORS.greenSoft, font: { color: COLORS.green, bold: true } },
  });
  range.conditionalFormats.add("containsText", {
    text: "进行中",
    format: { fill: COLORS.indigoSoft, font: { color: COLORS.indigo, bold: true } },
  });
  range.conditionalFormats.add("containsText", {
    text: "待审核",
    format: { fill: COLORS.amberSoft, font: { color: COLORS.amber, bold: true } },
  });
  range.conditionalFormats.add("containsText", {
    text: "阻塞",
    format: { fill: COLORS.redSoft, font: { color: COLORS.red, bold: true } },
  });
}

function addPriorityFormatting(range) {
  range.conditionalFormats.deleteAll();
  range.conditionalFormats.add("containsText", {
    text: "P0",
    format: { fill: COLORS.redSoft, font: { color: COLORS.red, bold: true } },
  });
  range.conditionalFormats.add("containsText", {
    text: "P1",
    format: { fill: COLORS.amberSoft, font: { color: COLORS.amber, bold: true } },
  });
  range.conditionalFormats.add("containsText", {
    text: "P2",
    format: { fill: COLORS.indigoSoft, font: { color: COLORS.indigo } },
  });
}

function addRightsFormatting(range) {
  range.conditionalFormats.deleteAll();
  range.conditionalFormats.add("containsText", {
    text: "绿",
    format: { fill: COLORS.greenSoft, font: { color: COLORS.green, bold: true } },
  });
  range.conditionalFormats.add("containsText", {
    text: "黄",
    format: { fill: COLORS.amberSoft, font: { color: COLORS.amber, bold: true } },
  });
  range.conditionalFormats.add("containsText", {
    text: "红",
    format: { fill: COLORS.redSoft, font: { color: COLORS.red, bold: true } },
  });
}

function writeRows(sheet, headerRow, headers, rows, tableName, endRowOverride = null) {
  const endCol = columnName(headers.length);
  sheet.getRange(`A${headerRow}:${endCol}${headerRow}`).values = [headers];
  styleHeader(sheet.getRange(`A${headerRow}:${endCol}${headerRow}`));
  if (rows.length) {
    sheet.getRange(`A${headerRow + 1}:${endCol}${headerRow + rows.length}`).values = rows;
    styleBody(sheet.getRange(`A${headerRow + 1}:${endCol}${headerRow + rows.length}`));
  }
  const tableEndRow = endRowOverride ?? headerRow + rows.length;
  const table = sheet.tables.add(`A${headerRow}:${endCol}${tableEndRow}`, true, tableName);
  table.style = "TableStyleMedium2";
  table.showBandedRows = true;
  table.showFilterButton = true;
  return { table, endCol, tableEndRow };
}

function columnName(count) {
  let n = count;
  let name = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

const peopleCsv = parseCSV(await fs.readFile(path.join(dataDir, "phase0-people.csv"), "utf8"));
const sourceCsv = parseCSV(await fs.readFile(path.join(dataDir, "source-rights-ledger.csv"), "utf8"));
const vocabCsv = parseCSV(await fs.readFile(path.join(dataDir, "controlled-vocabularies.csv"), "utf8"));
const emperorsCsv = parseCSV(await fs.readFile(path.join(dataDir, "qing-emperors.csv"), "utf8"));
const emperorSourcesCsv = parseCSV(await fs.readFile(path.join(dataDir, "qing-emperor-source-index.csv"), "utf8"));
const portraitsCsv = parseCSV(await fs.readFile(path.join(dataDir, "emperor-portraits.csv"), "utf8"));
const taskCsv = parseCSV(await fs.readFile(path.join(dataDir, "task-queue.csv"), "utf8"));
const idCsv = parseCSV(await fs.readFile(path.join(dataDir, "entity-id-crosswalk.csv"), "utf8"));
const cardsCsv = parseCSV(await fs.readFile(path.join(dataDir, "qing-emperor-research-cards.csv"), "utf8"));
const sourceUnitsCsv = parseCSV(await fs.readFile(path.join(dataDir, "kangxi-source-units.csv"), "utf8"));
const verifiedClaimsCsv = parseCSV(await fs.readFile(path.join(dataDir, "kangxi-source-claims.csv"), "utf8"));

const planRows = [
  ["B1-01", 1, "十二帝", "建立十二帝统一骨架", "12 条、继承链连续、均有官方人物页", "P0", "已完成", "AI", "", "", "基础年份仍需逐帝细化到日期"],
  ["B1-02", 1, "史料", "校正《清史稿》本纪卷次", "卷1—25与实际目录一致", "P0", "已完成", "AI", "", "", "已修正康熙、嘉庆至同治错位"],
  ["B1-03", 1, "图像", "登记十二帝公版画像候选", "每帝一件且有逐文件许可页", "P0", "已完成", "AI", "", "", "原作馆藏号继续补核"],
  ["B2-01", 2, "后妃", "建立十二帝皇后候选表", "区分在世册立、追尊、废黜和撤谥", "P0", "未开始", "AI", "", "", "先从《清史稿》卷214建候选"],
  ["B2-02", 2, "皇子女", "建立皇子、公主候选表", "齿序口径、母系和封号时态分开", "P0", "未开始", "AI", "", "", "从卷161—166开始但不可终审"],
  ["B2-03", 2, "玉牒", "建立公开玉牒版本与目录", "看不到原件的关系一律标玉牒待核", "P0", "未开始", "AI", "", "", "只做版本级目录不编造全谱"],
  ["B3-01", 3, "康熙", "完成康熙来源包", "史料入口、版本、访问和权利字段齐全", "P0", "未开始", "AI", "", "", "先查实录卷1及卷300"],
  ["B3-02", 3, "人物", "回查康雍50人候选档", "异名、身份、首要证据和待核项齐全", "P0", "未开始", "AI", "", "", "一轮处理20—30条主张"],
  ["B3-03", 3, "关系", "完成60条关系候选", "每条有关系类型、时间和证据状态", "P0", "未开始", "AI", "", "", "生母、嫡母、抚育者不可混写"],
  ["B3-04", 3, "储位", "建立两废太子与继承事件链", "具体事件替代“九子夺嫡”笼统标签", "P0", "未开始", "AI", "", "", "冲突说法并列保存"],
  ["B4-01", 4, "图像", "补核十二帝画像馆藏与版本", "对象、数字文件、认定、许可四层分开", "P0", "未开始", "AI", "", "", "Commons许可不等于认定无误"],
  ["B4-02", 4, "页面", "生成十二帝本地导航页", "画像、史料入口和状态可浏览", "P1", "未开始", "AI", "", "", "骨架页明确标个人研究稿"],
  ["B5-01", 5, "事件", "扩展政治、战争、制度和地点", "人物—事件—地点均有来源绑定", "P1", "未开始", "AI", "", "", "从康熙统治专题分册开始"],
  ["B5-02", 5, "反证", "反查30条高风险主张", "支持与反驳材料及来源家族明确", "P0", "未开始", "反证Agent", "", "", "第二Agent不等于专家审核"],
  ["B5-03", 5, "一致性", "运行ID、外键、日期和许可检查", "严重结构错误为0", "P0", "未开始", "AI", "", "", "发现一条严重错误则重开整批"],
  ["B6-01", 6, "索引", "拆分《清史稿》帝后皇子公主条目", "人物级章节索引可检索", "P0", "进行中", "AI", "", "", "已定位卷164—166及214"],
  ["B6-02", 6, "抽查", "执行用户H1随机抽查", "抽查30主张、15关系、全部嵌入图像", "P0", "未开始", "用户", "", "", "不抽查则一直标AI研究草稿"],
  ["B6-03", 6, "续作", "生成雍正卷下一任务队列", "AI可从磁盘状态无损继续", "P1", "未开始", "AI", "", "", "不依赖聊天上下文记忆"],
];

const riskRows = [
  ["R01", "范围从逐批推进膨胀为一次做完", 5, 5, "=C5*D5", "不断加人加专题而首批未回查", "所有新增进入任务队列；每轮只做一个来源或20—30条主张", "用户、AI", "开放", ""],
  ["R02", "把《清史稿》当最终事实库", 4, 5, "=C6*D6", "大量主张只有《清史稿》单一出处", "高风险事实回到实录、档案或独立来源；固定未定稿提示", "AI", "开放", ""],
  ["R03", "玉牒被简化为静态家谱", 4, 5, "=C7*D7", "无版本无有效时间且母系关系混写", "关系绑定版本与时间；原件未见标玉牒待核", "AI、用户", "开放", ""],
  ["R04", "版权或档案公布权误判", 4, 5, "=C8*D8", "把网页能看等同于能抓取", "三色台账先行；黄色外链；逐文件核许可", "AI", "开放", ""],
  ["R05", "AI 幻觉进入发布层", 4, 5, "=C9*D9", "流畅文本无 Assertion ID 或卷页", "隔离机器候选和回查层；M0不得进叙事", "AI、用户", "开放", ""],
  ["R06", "人物异名误合并", 4, 5, "=C10*D10", "同名人物共享亲属或任官记录", "合并需证据、第二Agent复查且可回滚", "AI", "开放", ""],
  ["R07", "历史日期换算错误", 3, 5, "=C11*D11", "闰月缺失或来源只存公历", "原值、算法版本、精度并存；用户抽查", "AI、用户", "开放", ""],
  ["R08", "画像人物或年代错认", 3, 5, "=C12*D12", "把文件题名直接写成确定事实", "人物认定单列；保留旧定名、馆藏与争议", "AI", "开放", ""],
  ["R09", "录文标点译释相互覆盖", 3, 5, "=C13*D13", "数据库只有一列正文", "原文、录文、标点、规范化和译释分层", "AI", "开放", ""],
  ["R10", "满文材料被系统性忽略", 4, 4, "=C14*D14", "宫廷或边疆结论只用汉文材料", "明确标语言缺口；未经专项能力不自动定译", "AI", "开放", ""],
  ["R11", "巨大关系图不可读", 4, 3, "=C15*D15", "默认一次展开数百节点", "以人为中心、按需展开并可按时间和关系过滤", "AI", "开放", ""],
  ["R12", "过度工程拖慢内容", 3, 4, "=C16*D16", "先搭复杂数据库而真实条目未增加", "CSV/Markdown优先；SQLite不足时再升级", "AI", "开放", ""],
  ["R13", "外部链接失效或内容变化", 3, 3, "=C17*D17", "关键主张只有URL无卷次版本", "保存稳定标识、访问日期、卷页和允许范围内哈希", "AI", "开放", ""],
  ["R14", "二手故事污染事实层", 3, 4, "=C18*D18", "百科自媒体说法无来源直接入库", "只作线索；重要结论必须回查", "AI", "开放", ""],
  ["R15", "在世后裔隐私泄露", 2, 5, "=C19*D19", "采集现代住址证件或敏感亲属", "当前排除在世者敏感资料；必要时隐私审查", "用户、AI", "开放", ""],
  ["R16", "以字数和条目数替代质量", 5, 4, "=C20*D20", "只汇报新增字数或人物数", "北极星改为可定位且完成回查的主张", "用户、AI", "开放", ""],
  ["R17", "零人工抽查导致错误累积", 4, 5, "=C21*D21", "候选队列增长但用户从不打开来源", "始终标AI研究草稿；每批建议抽查5条主张和2条关系", "用户", "开放", ""],
  ["R18", "许可改变后无法撤下派生物", 2, 5, "=C22*D22", "数字资产与页面无依赖关系", "资产、许可、主张和叙事建立可追踪引用", "AI", "开放", ""],
];

const exampleClaimRow = [
  "QH-A-EXAMPLE-001",
  "人物关系",
  "QH-P-000002",
  "has_biological_mother",
  "QH-P-000025",
  "雍正帝为德妃乌雅氏所生（示例候选）",
  "",
  "",
  "不确定",
  "草稿",
  "",
  "待精确到具体《玉牒》版本、卷页或档号",
  "",
  "仅提及",
  "语境性",
  "未评级",
  "",
  "",
  "人工录入",
  "",
  "",
  "仅演示字段结构；不得视为已核验主张，正式取证后另建稳定 Assertion ID",
];

const exampleRelationshipRow = [
  "QH-A-EXAMPLE-001",
  "QH-P-000002",
  "爱新觉罗·胤禛",
  "has_biological_mother",
  "生母为",
  "QH-P-000025",
  "乌雅氏（孝恭仁皇后）",
  "",
  "",
  "",
  "来源原记",
  "",
  "待精确到具体《玉牒》版本、卷页或档号",
  "未核验",
  "草稿",
  "",
  "结构示例，不构成史实核验完成",
];

// 仪表盘
setTitle(dashboard, "L", "清史证据库 · 零预算工作台", "范围：十二帝骨架＋康熙样卷持续深挖｜现金预算0元｜所有关键事实必须回到具体版本、卷页、档号或逐文件许可页");
dashboard.getRange("A4:L4").merge();
dashboard.getRange("A4").values = [["执行状态：零预算持续生产已启动。十二帝骨架、史料入口和首批画像台账已落盘；未经来源回查的内容始终标为候选或待核。"]];
dashboard.getRange("A4").format = {
  fill: COLORS.greenSoft,
  font: { name: FONT_BODY, bold: true, color: COLORS.green, size: 11 },
  wrapText: true,
  verticalAlignment: "center",
};
dashboard.getRange("A4").format.rowHeight = 34;

const cardLabels = [
  ["十二帝骨架", "来源台账", "画像候选", "任务总数"],
  ["康雍候选人物", "绿色来源", "可展示画像", "来源回查主张"],
  ["任务已完成", "阻塞任务", "高风险项", "有争议主张"],
];
const taskLastRow = taskCsv.length + 3;
const cardFormulas = [
  ["=COUNTA('十二帝总档'!$A$5:$A$16)", "=COUNTA('来源版权台账'!$A$5:$A$31)", "=COUNTA('十二帝画像'!$A$5:$A$16)", `=COUNTA('持续任务队列'!$A$5:$A$${taskLastRow})`],
  ["=COUNTA('康雍50人'!$A$5:$A$54)", "=COUNTIF('来源版权台账'!$G$5:$G$31,\"绿\")", "=COUNTIF('十二帝画像'!$L$5:$L$16,\"是\")", "=COUNTIF('主张工作台'!$J$5:$J$204,\"审核中\")"],
  [`=COUNTIF('持续任务队列'!$H$5:$H$${taskLastRow},\"已完成\")`, `=COUNTIF('持续任务队列'!$H$5:$H$${taskLastRow},\"阻塞\")`, "=COUNTIF('风险登记'!$E$5:$E$22,\">=15\")", "=COUNTIF('主张工作台'!$J$5:$J$204,\"有争议\")"],
];

for (let r = 0; r < 3; r += 1) {
  for (let c = 0; c < 4; c += 1) {
    const startCol = 1 + c * 3;
    const topRow = 6 + r * 3;
    const endCol = startCol + 1;
    const labelRange = dashboard.getRangeByIndexes(topRow - 1, startCol - 1, 1, 2);
    labelRange.merge();
    labelRange.values = [[cardLabels[r][c]]];
    labelRange.format = {
      fill: r === 2 ? COLORS.vermilionSoft : COLORS.indigoSoft,
      font: { name: FONT_BODY, bold: true, color: COLORS.muted, size: 10 },
      horizontalAlignment: "center",
      verticalAlignment: "center",
      borders: { preset: "outside", style: "thin", color: COLORS.line },
    };
    const valueRange = dashboard.getRangeByIndexes(topRow, startCol - 1, 2, 2);
    valueRange.merge();
    valueRange.formulas = [[cardFormulas[r][c]]];
    valueRange.format = {
      fill: COLORS.panel,
      font: { name: FONT_DISPLAY, bold: true, color: r === 2 ? COLORS.vermilion : COLORS.indigo, size: 22 },
      horizontalAlignment: "center",
      verticalAlignment: "center",
      borders: { preset: "outside", style: "thin", color: COLORS.line },
      numberFormat: "#,##0",
    };
  }
}

dashboard.getRange("A16:L16").merge();
dashboard.getRange("A16").values = [["质量门与操作入口"]];
dashboard.getRange("A16").format = {
  fill: COLORS.jade,
  font: { name: FONT_BODY, bold: true, color: "#FFFFFF", size: 11 },
};
dashboard.getRange("A17:L22").values = [
  ["门槛", "当前判定", "操作入口", "检查重点", null, null, "门槛", "当前判定", "操作入口", "检查重点", null, null],
  ["十二帝骨架", "12/12已建", "十二帝总档", "本纪卷次已校正；日期和称号继续细化", null, null, "首批画像", "12/12已登记", "十二帝画像", "逐文件公版；人物认定和馆藏号仍需回查", null, null],
  ["120 条核验主张", "28/120 审核中", "主张工作台", "已定位卷1即位条与卷300遗诏条；待用户抽查", null, null, "60 条关系", "尚未开始", "关系工作台", "每条边一条证据；关系类型不可混写", null, null],
  ["50 人候选", "已建待回查", "康雍50人", "人物仍须逐条取证，不能视为已证实", null, null, "18 个风险", "均已登记", "风险登记", "高风险由AI复查并进入用户抽查", null, null],
  ["持续任务", "磁盘队列已建", "持续任务队列", "每轮记录完成位置、未决问题和下一动作", null, null, "资料边界", "外链优先", "来源版权台账", "免费可看不等于允许镜像", null, null],
  ["现金预算", "0 元", "项目章程", "不买数据库、图片、服务器或商业API", null, null, "产品形态", "个人研究库", "信息架构", "不是权威专家审定库；错误可修订", null, null],
];
dashboard.getRange("A17:L17").format = { fill: COLORS.vermilionSoft, font: { bold: true, color: COLORS.vermilion }, wrapText: true };
dashboard.getRange("A18:L22").format = { fill: COLORS.panel, font: { name: FONT_BODY, size: 9, color: COLORS.ink }, wrapText: true, verticalAlignment: "top" };
dashboard.getRange("A17:L22").format.borders = { preset: "outside", style: "thin", color: COLORS.line };
dashboard.getRange("B18:B22").format.font = { bold: true, color: COLORS.indigo };
dashboard.getRange("H18:H22").format.font = { bold: true, color: COLORS.indigo };
dashboard.getRange("A17:L22").format.rowHeight = 28;
dashboard.getRange("A23:L23").merge();
dashboard.getRange("A23").values = [["本工作簿是执行台账，不是史料本身；来源回查、权利许可和不确定性状态见各数据表与 docs。"]];
dashboard.getRange("A23").format = { fill: COLORS.paper, font: { italic: true, color: COLORS.muted, size: 9 }, horizontalAlignment: "center" };
dashboard.getRange("A:L").format.columnWidth = 13;
dashboard.getRange("A:A").format.columnWidth = 17;
dashboard.getRange("D:D").format.columnWidth = 18;
dashboard.getRange("G:G").format.columnWidth = 17;
dashboard.getRange("J:J").format.columnWidth = 18;

// 十二帝总档
setTitle(emperorsSheet, "S", "十二帝总档", "努尔哈赤至溥仪统一骨架；在位年份与年号纪年不是同一口径，后续将细化到日期级事件");
writeRows(emperorsSheet, 4, emperorsCsv[0], emperorsCsv.slice(1), "QingEmperorsTable");
addStatusFormatting(emperorsSheet.getRange(`R5:R${emperorsCsv.length + 3}`));
emperorsSheet.freezePanes.freezeRows(4);
emperorsSheet.freezePanes.freezeColumns(4);
const emperorWidths = [14, 7, 24, 18, 10, 9, 9, 10, 10, 24, 28, 24, 24, 20, 32, 30, 48, 16, 48];
emperorWidths.forEach((w, i) => { emperorsSheet.getRangeByIndexes(0, i, emperorsCsv.length + 3, 1).format.columnWidth = w; });
emperorsSheet.getRange(`A5:S${emperorsCsv.length + 3}`).format.rowHeight = 46;

// 帝王史料索引
setTitle(emperorSourcesSheet, "J", "帝王史料索引", "官方人物页、实录、《清史稿》和图像库入口；在线可检索不等于允许整库复制");
writeRows(emperorSourcesSheet, 4, emperorSourcesCsv[0], emperorSourcesCsv.slice(1), "EmperorSourceIndexTable");
addStatusFormatting(emperorSourcesSheet.getRange(`J5:J${emperorSourcesCsv.length + 3}`));
emperorSourcesSheet.freezePanes.freezeRows(4);
emperorSourcesSheet.freezePanes.freezeColumns(3);
const emperorSourceWidths = [14, 14, 34, 24, 34, 58, 42, 56, 14, 14];
emperorSourceWidths.forEach((w, i) => { emperorSourcesSheet.getRangeByIndexes(0, i, emperorSourcesCsv.length + 3, 1).format.columnWidth = w; });
emperorSourcesSheet.getRange(`A5:J${emperorSourcesCsv.length + 3}`).format.rowHeight = 44;

// 十二帝画像
setTitle(portraitsSheet, "Q", "十二帝画像与历史照片", "每帝先登记一件免费可用候选；公版许可、人物认定、原作馆藏和数字文件来源分别管理");
writeRows(portraitsSheet, 4, portraitsCsv[0], portraitsCsv.slice(1), "EmperorPortraitsTable");
addRightsFormatting(portraitsSheet.getRange(`K5:K${portraitsCsv.length + 3}`));
portraitsSheet.freezePanes.freezeRows(4);
portraitsSheet.freezePanes.freezeColumns(4);
const portraitWidths = [14, 14, 24, 48, 22, 22, 26, 62, 62, 18, 10, 14, 14, 22, 14, 50, 46];
portraitWidths.forEach((w, i) => { portraitsSheet.getRangeByIndexes(0, i, portraitsCsv.length + 3, 1).format.columnWidth = w; });
portraitsSheet.getRange(`A5:Q${portraitsCsv.length + 3}`).format.rowHeight = 52;

// 持续任务队列
setTitle(tasksSheet, "M", "持续任务队列", "聊天上下文不是项目记忆；每轮从磁盘队列恢复，并记录完成位置、未决问题、下一动作和质量检查");
writeRows(tasksSheet, 4, taskCsv[0], taskCsv.slice(1), "PersistentTaskQueueTable");
tasksSheet.getRange(`H5:H${taskCsv.length + 3}`).dataValidation = { rule: { type: "list", values: ["未开始", "进行中", "待审核", "已完成", "阻塞", "取消"] } };
tasksSheet.getRange(`L5:L${taskCsv.length + 3}`).dataValidation = { rule: { type: "list", values: ["P0", "P1", "P2", "P3"] } };
addStatusFormatting(tasksSheet.getRange(`H5:H${taskCsv.length + 3}`));
addPriorityFormatting(tasksSheet.getRange(`L5:L${taskCsv.length + 3}`));
tasksSheet.freezePanes.freezeRows(4);
tasksSheet.freezePanes.freezeColumns(4);
const taskWidths = [14, 14, 18, 42, 46, 36, 18, 14, 34, 44, 38, 10, 36];
taskWidths.forEach((w, i) => { tasksSheet.getRangeByIndexes(0, i, taskCsv.length + 3, 1).format.columnWidth = w; });
tasksSheet.getRange(`A5:M${taskCsv.length + 3}`).format.rowHeight = 48;

// 人物 ID 对照
setTitle(idSheet, "F", "十二帝人物 ID 迁移对照", "皇帝是人物的时态称号，不是第二套人物实体；QH-E仅为展示兼容ID，权威实体统一到QH-P");
writeRows(idSheet, 4, idCsv[0], idCsv.slice(1), "EntityIdCrosswalkTable");
addStatusFormatting(idSheet.getRange(`E5:E${idCsv.length + 3}`));
idSheet.freezePanes.freezeRows(4);
idSheet.freezePanes.freezeColumns(3);
const idWidths = [16, 18, 18, 28, 14, 62];
idWidths.forEach((w, i) => { idSheet.getRangeByIndexes(0, i, idCsv.length + 3, 1).format.columnWidth = w; });
idSheet.getRange(`A5:F${idCsv.length + 3}`).format.rowHeight = 38;

// 十二帝研究卡
setTitle(cardsSheet, "R", "十二帝第一版研究卡", "家庭、事件与争议均为索引级候选；当前统一标S二手索引/M1 AI回查，后续拆成原子主张逐条回到实录档案或玉牒");
writeRows(cardsSheet, 4, cardsCsv[0], cardsCsv.slice(1), "QingEmperorResearchCardsTable");
cardsSheet.freezePanes.freezeRows(4);
cardsSheet.freezePanes.freezeColumns(4);
const cardWidths = [18, 16, 24, 10, 18, 34, 26, 40, 54, 60, 76, 76, 30, 44, 56, 16, 16, 48];
cardWidths.forEach((w, i) => { cardsSheet.getRangeByIndexes(0, i, cardsCsv.length + 3, 1).format.columnWidth = w; });
cardsSheet.getRange(`A5:R${cardsCsv.length + 3}`).format.rowHeight = 76;

// 康熙首批来源单元
setTitle(sourceUnitsSheet, "M", "康熙首批来源单元", "两个可直接打开并精确到卷、年月日和当日条次的《圣祖实录》记录；数字平台、底本和使用边界分开登记");
writeRows(sourceUnitsSheet, 4, sourceUnitsCsv[0], sourceUnitsCsv.slice(1), "KangxiSourceUnitsTable");
sourceUnitsSheet.freezePanes.freezeRows(4);
sourceUnitsSheet.freezePanes.freezeColumns(4);
const sourceUnitWidths = [20, 14, 28, 12, 28, 14, 12, 72, 64, 12, 52, 14, 56];
sourceUnitWidths.forEach((w, i) => { sourceUnitsSheet.getRangeByIndexes(0, i, sourceUnitsCsv.length + 3, 1).format.columnWidth = w; });
sourceUnitsSheet.getRange(`A5:M${sourceUnitsCsv.length + 3}`).format.rowHeight = 68;

// 六批次计划
setTitle(planSheet, "K", "零预算六批次计划", "批次不与自然周绑定；质量门不过就先修复，状态、责任人与日期均可继续更新");
writeRows(planSheet, 4, ["任务 ID", "批次", "工作流", "任务", "完成定义", "优先级", "状态", "责任人", "开始日期", "截止日期", "备注"], planRows, "SixBatchPlanTable");
const planLastRow = 4 + planRows.length;
planSheet.getRange(`B5:B${planLastRow}`).format.numberFormat = "0";
planSheet.getRange(`F5:F${planLastRow}`).dataValidation = { rule: { type: "list", values: ["P0", "P1", "P2", "P3"] } };
planSheet.getRange(`G5:G${planLastRow}`).dataValidation = { rule: { type: "list", values: ["未开始", "进行中", "阻塞", "待审核", "已完成"] } };
planSheet.getRange(`H5:J${planLastRow}`).format.fill = COLORS.blueInput;
planSheet.getRange(`I5:J${planLastRow}`).format.numberFormat = "yyyy-mm-dd";
addPriorityFormatting(planSheet.getRange(`F5:F${planLastRow}`));
addStatusFormatting(planSheet.getRange(`G5:G${planLastRow}`));
planSheet.freezePanes.freezeRows(4);
planSheet.freezePanes.freezeColumns(3);
const planWidths = [14, 8, 12, 34, 36, 10, 12, 14, 13, 13, 32];
planWidths.forEach((w, i) => { planSheet.getRangeByIndexes(0, i, planLastRow, 1).format.columnWidth = w; });
planSheet.getRange(`A5:K${planLastRow}`).format.rowHeight = 34;

// 康雍首批 50 人
setTitle(peopleSheet, "M", "康熙—雍正首批 50 人候选档", "这是深挖样本而非全清名人榜；每人仍需逐条来源回查，当前记录不得视为已证实");
writeRows(peopleSheet, 4, peopleCsv[0], peopleCsv.slice(1), "Phase0PeopleTable");
peopleSheet.getRange("G5:G54").dataValidation = { rule: { type: "list", values: ["P0", "P1", "P2"] } };
peopleSheet.getRange("K5:K54").dataValidation = { rule: { type: "list", values: ["待取证", "取证中", "待审核", "已核验", "阻塞"] } };
peopleSheet.getRange("L5:M54").format.fill = COLORS.blueInput;
addPriorityFormatting(peopleSheet.getRange("G5:G54"));
addStatusFormatting(peopleSheet.getRange("K5:K54"));
peopleSheet.freezePanes.freezeRows(4);
peopleSheet.freezePanes.freezeColumns(4);
const peopleWidths = [16, 7, 18, 26, 30, 20, 10, 38, 55, 52, 12, 14, 30];
peopleWidths.forEach((w, i) => { peopleSheet.getRangeByIndexes(0, i, 54, 1).format.columnWidth = w; });
peopleSheet.getRange("A5:M54").format.rowHeight = 48;

// 来源版权台账
setTitle(sourcesSheet, "S", "来源与版权台账", "绿色仅表示明确纳入开放许可或已授权的对象；黄色默认只存自建元数据并外链；红色不得按计划获取或展示");
writeRows(sourcesSheet, 4, sourceCsv[0], sourceCsv.slice(1), "SourceRightsTable");
sourcesSheet.getRange("G5:G31").dataValidation = { rule: { type: "list", values: ["绿", "黄", "红"] } };
sourcesSheet.getRange("Q5:S31").format.fill = COLORS.blueInput;
addRightsFormatting(sourcesSheet.getRange("G5:G31"));
addStatusFormatting(sourcesSheet.getRange("S5:S31"));
sourcesSheet.freezePanes.freezeRows(4);
sourcesSheet.freezePanes.freezeColumns(4);
const sourceWidths = [13, 30, 22, 10, 38, 24, 10, 22, 24, 22, 18, 44, 46, 48, 48, 13, 38, 14, 16];
sourceWidths.forEach((w, i) => { sourcesSheet.getRangeByIndexes(0, i, 31, 1).format.columnWidth = w; });
sourcesSheet.getRange("A5:S31").format.rowHeight = 52;

// 主张工作台
setTitle(claimsSheet, "V", "主张工作台", "一行一条可争议、可审核、可替换的原子主张。蓝底为输入；状态达到“已采纳”前不得进入正式叙事。");
const claimHeaders = ["Assertion ID", "主张类型", "主体 ID", "谓词/关系", "客体 ID 或值", "原始时间表达", "公历下界", "公历上界", "确定性", "状态", "来源实体 ID", "卷页/档号/图像定位", "支持引文", "证据立场", "证据直接性", "证据强度", "来源家族 ID", "冲突组 ID", "获取方式", "录入人", "复核人", "编辑备注"];
const blankClaims = Array.from({ length: 200 }, () => Array(claimHeaders.length).fill(""));
for (let i = 1; i < verifiedClaimsCsv.length; i += 1) blankClaims[i - 1] = verifiedClaimsCsv[i];
blankClaims[verifiedClaimsCsv.length - 1] = exampleClaimRow;
writeRows(claimsSheet, 4, claimHeaders, blankClaims, "ClaimsWorkbenchTable");
styleBlankTemplate(claimsSheet.getRange("A5:V204"));
claimsSheet.getRange("B5:B204").dataValidation = { rule: { type: "list", values: ["实体关系", "文字或数值陈述", "人物关系", "称号授予", "事件发生", "事件参与", "图像表现认定"] } };
claimsSheet.getRange("I5:I204").dataValidation = { rule: { type: "list", values: ["确定", "约略", "不确定", "约略且不确定", "推定", "未知"] } };
claimsSheet.getRange("J5:J204").dataValidation = { rule: { type: "list", values: ["草稿", "审核中", "已采纳", "有争议", "已驳回", "已废弃"] } };
claimsSheet.getRange("N5:N204").dataValidation = { rule: { type: "list", values: ["支持", "反驳", "提供语境", "仅提及"] } };
claimsSheet.getRange("O5:O204").dataValidation = { rule: { type: "list", values: ["明确记载", "推定", "语境性", "以沉默为据"] } };
claimsSheet.getRange("P5:P204").dataValidation = { rule: { type: "list", values: ["一手直接", "强", "中", "弱", "未评级"] } };
claimsSheet.getRange("S5:S204").dataValidation = { rule: { type: "list", values: ["人工录入", "结构化导入", "规则抽取", "OCR 抽取", "实体识别抽取", "大模型抽取"] } };
claimsSheet.getRange("G5:H204").format.numberFormat = "yyyy-mm-dd";
addStatusFormatting(claimsSheet.getRange("J5:J204"));
claimsSheet.freezePanes.freezeRows(4);
claimsSheet.freezePanes.freezeColumns(5);
const claimWidths = [18, 18, 18, 25, 30, 24, 13, 13, 13, 13, 18, 40, 55, 13, 14, 13, 18, 16, 18, 14, 14, 38];
claimWidths.forEach((w, i) => { claimsSheet.getRangeByIndexes(0, i, 204, 1).format.columnWidth = w; });
claimsSheet.getRange("A5:V204").format.rowHeight = 32;

// 关系工作台
setTitle(relationshipsSheet, "Q", "人物关系工作台", "关系是有时间、有类型、有证据的主张，不是静态家谱连线。生母、嫡母、抚育者、乳母与承嗣必须分开。");
const relationshipHeaders = ["Assertion ID", "主体人物 ID", "主体名", "关系类型代码", "关系中文标签", "客体人物 ID", "客体名", "有效起始", "有效结束", "排行数值", "排行口径", "来源实体 ID", "精确定位", "证据状态", "主张状态", "复核人", "备注"];
const blankRelationships = Array.from({ length: 120 }, () => Array(relationshipHeaders.length).fill(""));
blankRelationships[0] = exampleRelationshipRow;
writeRows(relationshipsSheet, 4, relationshipHeaders, blankRelationships, "RelationshipsWorkbenchTable");
styleBlankTemplate(relationshipsSheet.getRange("A5:Q124"));
relationshipsSheet.getRange("D5:D124").dataValidation = { rule: { type: "list", values: ["has_biological_father", "has_biological_mother", "has_legal_father", "has_legal_mother", "has_ritual_mother", "has_adoptive_parent", "has_foster_parent", "spouse_of", "betrothed_to", "member_of_lineage", "teacher_of", "student_of", "political_ally_of", "political_opponent_of"] } };
relationshipsSheet.getRange("K5:K124").dataValidation = { rule: { type: "list", values: ["出生总序", "存活子女序", "皇子序", "来源原记", "编辑推定"] } };
relationshipsSheet.getRange("N5:N124").dataValidation = { rule: { type: "list", values: ["未核验", "定位已核", "引文已核", "完全核验"] } };
relationshipsSheet.getRange("O5:O124").dataValidation = { rule: { type: "list", values: ["草稿", "审核中", "已采纳", "有争议", "已驳回", "已废弃"] } };
relationshipsSheet.getRange("H5:I124").format.numberFormat = "yyyy-mm-dd";
addStatusFormatting(relationshipsSheet.getRange("N5:O124"));
relationshipsSheet.freezePanes.freezeRows(4);
relationshipsSheet.freezePanes.freezeColumns(7);
const relationWidths = [18, 18, 20, 26, 22, 18, 20, 13, 13, 10, 16, 18, 40, 14, 13, 14, 36];
relationWidths.forEach((w, i) => { relationshipsSheet.getRangeByIndexes(0, i, 124, 1).format.columnWidth = w; });
relationshipsSheet.getRange("A5:Q124").format.rowHeight = 32;

// 图像工作台
setTitle(imagesSheet, "S", "画像与图像工作台", "图像对象、数字文件、人物认定和使用许可是四件事。AI 再现必须永久标记，不得伪装成历史原件。");
const imageHeaders = ["Visual ID", "对象标题", "图像性质", "馆藏机构", "馆藏号", "人物 ID", "人物认定类型", "制作时间", "来源网址", "权利颜色", "权利 URI/许可", "署名要求", "可本地保存", "可公开展示", "可商业使用", "撤下日期", "责任人", "审核状态", "备注"];
const blankImages = Array.from({ length: 100 }, () => Array(imageHeaders.length).fill(""));
writeRows(imagesSheet, 4, imageHeaders, blankImages, "ImagesWorkbenchTable");
styleBlankTemplate(imagesSheet.getRange("A5:S104"));
imagesSheet.getRange("C5:C104").dataValidation = { rule: { type: "list", values: ["历史原件", "后世历史艺术", "现代插画", "AI 再现", "文献影像"] } };
imagesSheet.getRange("G5:G104").dataValidation = { rule: { type: "list", values: ["题名明确", "馆藏著录认定", "学术研究认定", "传统传称", "很可能", "可能", "已否定认定"] } };
imagesSheet.getRange("J5:J104").dataValidation = { rule: { type: "list", values: ["绿", "黄", "红"] } };
imagesSheet.getRange("M5:O104").dataValidation = { rule: { type: "list", values: ["是", "否", "待确认"] } };
imagesSheet.getRange("R5:R104").dataValidation = { rule: { type: "list", values: ["未开始", "待补来源", "一校完成", "二校完成", "学术审核中", "权利审核中", "已通过", "阻塞"] } };
imagesSheet.getRange("P5:P104").format.numberFormat = "yyyy-mm-dd";
addRightsFormatting(imagesSheet.getRange("J5:J104"));
addStatusFormatting(imagesSheet.getRange("R5:R104"));
imagesSheet.freezePanes.freezeRows(4);
imagesSheet.freezePanes.freezeColumns(5);
const imageWidths = [16, 32, 20, 26, 18, 18, 22, 20, 48, 11, 36, 34, 16, 16, 16, 13, 14, 18, 40];
imageWidths.forEach((w, i) => { imagesSheet.getRangeByIndexes(0, i, 104, 1).format.columnWidth = w; });
imagesSheet.getRange("A5:S104").format.rowHeight = 34;

// 决策日志
setTitle(decisionsSheet, "K", "决策日志", "任何会改变范围、数据模型、权利边界或批次顺序的决定都应登记，保证后续轮次知道为何这样做");
const decisionHeaders = ["决策 ID", "日期", "问题", "考虑的选项", "最终决定", "理由与证据", "决策人", "影响", "复核触发器", "状态", "备注"];
const decisionRows = [
  ["DEC-001", new Date("2026-08-12"), "底层最小单位是什么", "文章；事实表；可溯源主张", "可溯源主张", "文章无法表达冲突、版本与逐条证据", "用户＋AI", "全局数据与产品", "若真实难例无法表达则重开", "已决定", ""],
  ["DEC-002", new Date("2026-08-12"), "第一阶段范围", "只做康雍；先建十二帝骨架再深挖康熙", "十二帝骨架＋康熙样卷", "既提供全朝导航又避免十二帝同时浅写", "用户＋AI", "范围与样本", "若康熙模板不能复用则重开", "已决定", ""],
  ["DEC-003", new Date("2026-08-12"), "史料是否设全局可信度分数", "单一分数；按材料性质和具体命题判断", "不设全局分数", "同一史料对不同问题的证据价值不同", "AI", "审核方法", "若用户无法理解证据状态则改展示", "已决定", ""],
  ["DEC-004", new Date("2026-08-12"), "未确认权利图像如何处理", "先展示；仅元数据外链；禁用记录", "黄色仅元数据＋外链；红色禁发", "公开可见不等于可再利用", "AI", "图像与法律风险", "获得许可或明确开放标记", "已决定", ""],
  ["DEC-005", new Date("2026-08-12"), "AI 的状态边界", "自动认定；来源回查；用户抽查", "机器提取与来源回查分层", "流畅输出可能放大历史错误", "用户＋AI", "编辑与技术", "不得把M0伪装成已核验", "已决定", ""],
  ["DEC-006", new Date("2026-08-12"), "未知冲突与缺失如何保存", "备注；覆盖；正式状态", "作为正式数据状态", "不确定性本身是研究结果", "AI", "数据模型", "无", "已决定", ""],
  ["DEC-007", new Date("2026-08-12"), "现金预算", "机构预算；个人零预算", "固定0元", "使用现有工具和公开资料；付费材料登记缺口", "用户", "全项目", "用户主动改变约束时重开", "已决定", ""],
  ["DEC-008", new Date("2026-08-12"), "本地数据技术", "复杂数据库；CSV/Markdown/SQLite", "先用CSV和Markdown；需要时SQLite", "当前规模不值得先上云服务或图数据库", "AI", "技术架构", "查询或一致性需求证明不足", "已决定", ""],
  ["DEC-009", new Date("2026-08-12"), "《清史稿》的角色", "最终事实层；线索与后出史料", "线索与一类后出证据", "它是未定稿且存在错讹，核心主张不得仅靠它", "AI", "来源政策", "无", "已决定", ""],
];
writeRows(decisionsSheet, 4, decisionHeaders, decisionRows, "DecisionLogTable");
decisionsSheet.getRange("B5:B13").format.numberFormat = "yyyy-mm-dd";
decisionsSheet.getRange("G5:K13").format.fill = COLORS.blueInput;
decisionsSheet.getRange("J5:J13").dataValidation = { rule: { type: "list", values: ["待决定", "已决定", "已取代", "已重开"] } };
addStatusFormatting(decisionsSheet.getRange("J5:J13"));
decisionsSheet.freezePanes.freezeRows(4);
decisionsSheet.freezePanes.freezeColumns(2);
const decisionWidths = [14, 13, 36, 38, 32, 50, 14, 32, 38, 13, 28];
decisionWidths.forEach((w, i) => { decisionsSheet.getRangeByIndexes(0, i, 13, 1).format.columnWidth = w; });
decisionsSheet.getRange("A5:K13").format.rowHeight = 46;

// 风险登记
setTitle(risksSheet, "J", "Phase 0 风险登记", "风险分数 = 概率 × 影响；15–25 为红色、8–14 为黄色、1–7 为绿色。公式列不可手填。");
const riskHeaders = ["风险 ID", "风险", "概率 P", "影响 I", "分数", "早期触发信号", "应对措施", "责任角色", "状态", "截止/复核日期"];
writeRows(risksSheet, 4, riskHeaders, riskRows.map((row) => row.map((v, i) => i === 4 ? "" : v)), "RiskRegisterTable");
risksSheet.getRange("E5:E22").formulas = riskRows.map((row) => [row[4]]);
risksSheet.getRange("C5:D22").dataValidation = { rule: { type: "whole", operator: "between", formula1: 1, formula2: 5 } };
risksSheet.getRange("I5:I22").dataValidation = { rule: { type: "list", values: ["开放", "缓解中", "已接受", "已升级", "已关闭"] } };
risksSheet.getRange("H5:J22").format.fill = COLORS.blueInput;
risksSheet.getRange("J5:J22").format.numberFormat = "yyyy-mm-dd";
risksSheet.getRange("E5:E22").conditionalFormats.add("cellIs", { operator: "greaterThanOrEqual", formula: 15, format: { fill: COLORS.redSoft, font: { color: COLORS.red, bold: true } } });
risksSheet.getRange("E5:E22").conditionalFormats.add("cellIs", { operator: "between", formula: [8, 14], format: { fill: COLORS.amberSoft, font: { color: COLORS.amber, bold: true } } });
risksSheet.getRange("E5:E22").conditionalFormats.add("cellIs", { operator: "lessThanOrEqual", formula: 7, format: { fill: COLORS.greenSoft, font: { color: COLORS.green, bold: true } } });
addStatusFormatting(risksSheet.getRange("I5:I22"));
risksSheet.freezePanes.freezeRows(4);
risksSheet.freezePanes.freezeColumns(2);
const riskWidths = [13, 34, 10, 10, 10, 42, 45, 16, 14, 16];
riskWidths.forEach((w, i) => { risksSheet.getRangeByIndexes(0, i, 22, 1).format.columnWidth = w; });
risksSheet.getRange("A5:J22").format.rowHeight = 40;

// 受控词表
setTitle(vocabSheet, "J", "Phase 0 受控词表", "稳定系统状态用固定枚举；历史概念、关系、称号与证据性质用可版本化词表。新增同义词前先检查是否已有概念。");
writeRows(vocabSheet, 4, vocabCsv[0], vocabCsv.slice(1), "ControlledVocabulariesTable");
vocabSheet.freezePanes.freezeRows(4);
vocabSheet.freezePanes.freezeColumns(4);
const vocabWidths = [22, 22, 30, 28, 30, 58, 24, 30, 12, 10];
vocabWidths.forEach((w, i) => { vocabSheet.getRangeByIndexes(0, i, vocabCsv.length + 3, 1).format.columnWidth = w; });
vocabSheet.getRange(`A5:J${vocabCsv.length + 3}`).format.rowHeight = 32;

// 统一基础格式与注释
workbook.comments.addThread({ cell: claimsSheet.getRange("J4") }, "只有已采纳或有争议且完成规定复核的主张才可进入正式产品视图；AI 不得自行改变此列。 ");
workbook.comments.addThread({ cell: sourcesSheet.getRange("G4") }, "绿色也必须逐对象核对许可；机构有 Open Data 不代表该机构所有图像和档案均开放。 ");
workbook.comments.addThread({ cell: relationshipsSheet.getRange("D4") }, "不要使用笼统的“母亲”关系。至少区分生母、嫡母/法定母、礼仪母、正式收养与抚育者。 ");
workbook.comments.addThread({ cell: portraitsSheet.getRange("J4") }, "Commons 分类页不能替代逐文件许可页；许可状态变化时应重新核查并能撤下本地文件。 ");
workbook.comments.addThread({ cell: tasksSheet.getRange("H4") }, "任务状态以磁盘台账为准；每轮工作结束必须更新完成位置、未决问题和下一动作。 ");

// 紧凑校验输出
const checks = [];
checks.push((await workbook.inspect({ kind: "table", range: "仪表盘!A1:L23", include: "values,formulas", tableMaxRows: 23, tableMaxCols: 12, maxChars: 10000 })).ndjson);
checks.push((await workbook.inspect({ kind: "table", range: "十二帝总档!A1:S16", include: "values,formulas", tableMaxRows: 16, tableMaxCols: 19, maxChars: 12000 })).ndjson);
checks.push((await workbook.inspect({ kind: "table", range: "十二帝画像!A1:Q16", include: "values,formulas", tableMaxRows: 16, tableMaxCols: 17, maxChars: 12000 })).ndjson);
checks.push((await workbook.inspect({ kind: "table", range: "持续任务队列!A1:M12", include: "values,formulas", tableMaxRows: 12, tableMaxCols: 13, maxChars: 10000 })).ndjson);
checks.push((await workbook.inspect({ kind: "table", range: "人物ID对照!A1:F16", include: "values,formulas", tableMaxRows: 16, tableMaxCols: 6, maxChars: 8000 })).ndjson);
checks.push((await workbook.inspect({ kind: "table", range: "十二帝研究卡!A1:R8", include: "values,formulas", tableMaxRows: 8, tableMaxCols: 18, maxChars: 12000 })).ndjson);
checks.push((await workbook.inspect({ kind: "table", range: "康熙来源单元!A1:M6", include: "values,formulas", tableMaxRows: 6, tableMaxCols: 13, maxChars: 10000 })).ndjson);
checks.push((await workbook.inspect({ kind: "table", range: "康雍50人!A1:M10", include: "values,formulas", tableMaxRows: 10, tableMaxCols: 13, maxChars: 8000 })).ndjson);
checks.push((await workbook.inspect({ kind: "table", range: "来源版权台账!A1:S9", include: "values,formulas", tableMaxRows: 9, tableMaxCols: 19, maxChars: 9000 })).ndjson);
checks.push((await workbook.inspect({ kind: "table", range: "风险登记!A1:J12", include: "values,formulas", tableMaxRows: 12, tableMaxCols: 10, maxChars: 9000 })).ndjson);
const formulaErrors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 300 }, summary: "final formula error scan", maxChars: 8000 });
checks.push(formulaErrors.ndjson);
await fs.writeFile(verificationPath, checks.join("\n"), "utf8");

const previewSpecs = [
  ["仪表盘", "A1:L23"],
  ["十二帝总档", "A1:S16"],
  ["帝王史料索引", "A1:J12"],
  ["十二帝画像", "A1:Q16"],
  ["持续任务队列", "A1:M14"],
  ["人物ID对照", "A1:F16"],
  ["十二帝研究卡", "A1:R10"],
  ["康熙来源单元", "A1:M6"],
  ["六批次计划", "A1:K14"],
  ["康雍50人", "A1:M10"],
  ["来源版权台账", "A1:S9"],
  ["主张工作台", "A1:V10"],
  ["关系工作台", "A1:Q10"],
  ["图像工作台", "A1:S10"],
  ["决策日志", "A1:K10"],
  ["风险登记", "A1:J12"],
  ["受控词表", "A1:J12"],
];

for (let i = 0; i < previewSpecs.length; i += 1) {
  const [sheetName, range] = previewSpecs[i];
  const preview = await workbook.render({ sheetName, range, scale: 1, format: "png" });
  await fs.writeFile(path.join(previewDir, `${String(i + 1).padStart(2, "0")}-${sheetName}.png`), new Uint8Array(await preview.arrayBuffer()));
}

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

console.log(JSON.stringify({ outputPath, previewDir, verificationPath, sheets: previewSpecs.map(([name]) => name), emperors: emperorsCsv.length - 1, researchCards: cardsCsv.length - 1, portraits: portraitsCsv.length - 1, tasks: taskCsv.length - 1, idMappings: idCsv.length - 1, people: peopleCsv.length - 1, sources: sourceCsv.length - 1, kangxiSourceUnits: sourceUnitsCsv.length - 1, kangxiClaims: verifiedClaimsCsv.length - 1, vocabularyTerms: vocabCsv.length - 1 }, null, 2));
