// 阅读编排只引用已有章节；首页、帝王页与文末共用，不另建一套文章。
// 每张精选卡必须回答三件事：具体问题（title）、材料亮点（material）、读完获得（gain）。
const PICKS = [
  {
    slug: 'kangxi-01', label: '即位与身后', focus: '同日第2/2条：遗诏文本，不是口谕的复写',
    title: '康熙最后一天：两份官书为什么写不到一起？',
    description: '实录写崩于寝宫，本纪另记畅春园不豫。同一个正月，两条记录各有落点。',
    material: '实录与本纪两条原文并列，御榻口谕与遗诏分开标注。',
    gain: '分清「哪天去世」与「遗诏何时算数」是两个问题。',
  },
  {
    slug: 'huangtaiji-01', label: '汗与皇帝', focus: '卷3才写1636年定号大清',
    title: '皇太极哪一年算「第一位皇帝」？',
    description: '1626 继汗位、1627 改元、1636 称帝——三层时间不能并成一次即位。',
    material: '即汗位、改元、称帝三处记录各回各的原文。',
    gain: '拿到一条不含糊的太宗时间线。',
  },
  {
    slug: 'yongzheng-04', label: '案卷里的普通人', focus: '四川安家计划与一张长沙告示',
    title: '想去四川安家，为什么在长沙折返？',
    description: '一次搬家计划，一张路上的告示。看个人打算怎样被大时代改变。',
    material: '卷二同一条问答里，问语一种怀疑、供词一种自述；那张告示先被读成祥瑞，两年后又换了一种读法。',
    gain: '学会把「问」与「供」分开读，把计划与行程分开画。',
  },
  {
    slug: 'qianlong-01', label: '太上皇时期', focus: '诏层：传位诏给三代继位法排序',
    title: '1796 年禅位以后，乾隆还管不管事？',
    description: '名义上嘉庆即位，本纪仍记太上皇裁决军国重务。',
    material: '训政期的本纪记录有日期、可回查。',
    gain: '分得清名义在位与实际当权。',
  },
  {
    slug: 'jiaqing-04', label: '权力交接', focus: '十五日之间：先下狱，再赐死',
    title: '乾隆死后，和珅是怎样倒下的？',
    description: '从三年训政读到十五日间的清算：皇位交出去之后，权力何时真正换手？',
    material: '十五日里每一步都有上谕与日期，下狱、定罪、赐死分条可查。',
    gain: '看懂一场清算的制度节奏，而不是宫斗剧情。',
  },
  {
    slug: 'tongzhi-01', label: '官方与晚出', focus: '脉案层：二十六天的天花',
    title: '同治帝之死：官方记载与后来的说法差在哪？',
    description: '官书写天花，梅毒之说多是晚出；「同治中兴」也是后人的评价。',
    material: '同时代官书与晚出笔记分列，各标材料性质。',
    gain: '学会按材料的早晚与性质给各种说法排座次。',
  },
  {
    slug: 'guangxu-01', label: '外交细节', focus: '备约细工：把几天日记连起来读',
    title: '签约前，曾纪泽为什么反复画格？',
    description: '试印、返工、添字、盖印。从日记里一张条约纸的来回，走近外交现场。',
    material: '几天日记连读，备用条约的细工步骤逐步可查。',
    gain: '从一张纸的返工，看见条约谈判的现场功夫。',
  },
];

export const FEATURED_COUNT = PICKS.length;

// 未编排的朝代兜底卡：从标题提取一层分类标签，替代三张卡重复同一个「沿朝次读」。
const FALLBACK_LABELS = [
  ['战事', /战|役|征|兵|武功|教匪|天国|宁远/],
  ['权力交接', /即位|禅|继|储|太子|退位|遗诏|汗位|帝位|密匣|监国|摄政|垂帘|亲政/],
  ['制度与政务', /制度|军机|摊丁|耗羡|奏折|新政|改元/],
  ['文献与著述', /实录|御制|文治|文献|满文|杂录|觉迷|四库|政纪|啸亭/],
  ['人物与家世', /后妃|妃|称号|家世|家庭|议政王|两宫/],
];

function fallbackLabel(title) {
  for (const [label, re] of FALLBACK_LABELS) {
    if (re.test(title)) return label;
  }
  return '沿朝次读';
}

export function readingPick(chapter, curated = PICKS.find((pick) => pick.slug === chapter.slug)) {
  return {
    slug: chapter.slug,
    era: chapter.era,
    title: curated?.title || chapter.title,
    description: curated?.description || chapter.lede || '',
    material: curated?.material || '',
    gain: curated?.gain || '',
    label: curated?.label || '沿朝次读',
    href: `#/chapter/${chapter.slug}${curated?.focus ? `?focus=${encodeURIComponent(curated.focus)}` : ''}`,
    // CTA 位统一给动词，时长只作补充，不再与动作混排
    detail: curated?.focus ? '直达选段' : chapter.readMinutes ? `阅读全文 · 约 ${chapter.readMinutes} 分钟` : '阅读全文',
  };
}

export function selectReadingPicks(chapters, { era, exclude, limit = 3 } = {}) {
  const candidates = chapters.filter((row) => row.slug !== exclude && (!era || row.era === era));
  const result = PICKS.map((pick) => {
    const chapter = candidates.find((row) => row.slug === pick.slug);
    return chapter ? readingPick(chapter, pick) : null;
  }).filter(Boolean);
  if (era) {
    for (const row of candidates) {
      if (result.some((pick) => pick.slug === row.slug) || /年表|皇子表|皇女|后妃表|学术史|清单/.test(row.title)) continue;
      result.push(readingPick(row, { label: fallbackLabel(row.title) }));
      if (result.length >= limit) break;
    }
  }
  return result.slice(0, limit);
}
