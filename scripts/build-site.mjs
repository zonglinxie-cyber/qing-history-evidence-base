import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCsv } from './lib/csv.mjs';
import { CSV_FILES } from './lib/schema.mjs';
import { buildIndex } from '../site/search.js';
import { homeHtml } from '../site/templates.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const dataDir = path.join(root, 'data');
const siteDir = path.join(root, 'site');
const dataOutDir = path.join(siteDir, 'data');
const contentDir = path.join(root, 'content');

function load(name) {
  return loadCsv(path.join(dataDir, name), {
    name,
    required: CSV_FILES[name]?.required,
  });
}

function localPreview(id, remoteUrl) {
  const remote = String(remoteUrl || '').trim();
  if (!id || !remote) return remote;
  const localRel = `media/${id}.jpg`;
  return fs.existsSync(path.join(siteDir, localRel)) ? localRel : remote;
}

function slimPortrait(portrait) {
  if (!portrait) return null;
  return {
    visual_id: portrait.visual_id,
    emperor_id: portrait.emperor_id,
    对象标题: portrait['对象标题'],
    预览文件: localPreview(portrait.visual_id, portrait['预览文件']),
    权利颜色: portrait['权利颜色'],
    可公开展示: portrait['可公开展示'],
    展示角色: portrait['展示角色'],
  };
}

function searchEntry(type, id, hay, extra = {}) {
  return { type, id, hay, ...extra };
}

function writeJson(name, payload) {
  const file = path.join(dataOutDir, name);
  const json = `${JSON.stringify(payload)}\n`;
  fs.writeFileSync(file, json);
  return { name, bytes: json.length };
}

function escHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
  }[ch]));
}

function inlineMd(text) {
  let out = escHtml(text);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const safe = /^(https?:\/\/|#\/)/.test(href) ? href : '#';
    const extra = safe.startsWith('http') ? ' target="_blank" rel="noopener"' : '';
    return `<a class="link" href="${escHtml(safe)}"${extra}>${label}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return out;
}

function mdToHtml(src) {
  const text = String(src || '').replace(/\r\n/g, '\n').replace(/^# .+\n+/, '');
  const lines = text.split('\n');
  const html = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    if (line.startsWith('## ')) {
      html.push(`<h2>${inlineMd(line.slice(3))}</h2>`);
      i += 1;
      continue;
    }
    if (line.startsWith('### ')) {
      html.push(`<h3>${inlineMd(line.slice(4))}</h3>`);
      i += 1;
      continue;
    }
    if (line.startsWith('- ')) {
      const items = [];
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(`<li>${inlineMd(lines[i].slice(2))}</li>`);
        i += 1;
      }
      html.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(`<li>${inlineMd(lines[i].replace(/^\d+\. /, ''))}</li>`);
        i += 1;
      }
      html.push(`<ol>${items.join('')}</ol>`);
      continue;
    }
    if (line.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        const cells = lines[i].split('|').slice(1, -1).map((cell) => cell.trim());
        if (!/^[-: ]+$/.test(cells.join(''))) rows.push(cells);
        i += 1;
      }
      if (rows.length) {
        const [head, ...body] = rows;
        html.push(`<div class="table-wrap"><table><thead><tr>${head.map((cell) => `<th>${inlineMd(cell)}</th>`).join('')}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${inlineMd(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      }
      continue;
    }
    const para = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() && !/^(#{1,3} |\- |\d+\. |\|)/.test(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    html.push(`<p>${inlineMd(para.join(' '))}</p>`);
  }
  return html.join('\n');
}

function build() {
  const emperors = load('qing-emperors.csv');
  const cards = load('qing-emperor-research-cards.csv');
  const portraits = load('emperor-portraits.csv');
  const crosswalk = load('entity-id-crosswalk.csv');
  const people = load('phase0-people.csv');
  const sources = load('source-rights-ledger.csv');
  const sourceIndex = load('qing-emperor-source-index.csv');
  const tasks = load('task-queue.csv');
  const kangxiUnits = load('kangxi-source-units.csv');
  const kangxiClaims = load('kangxi-source-claims.csv');
  const yongzhengUnits = load('yongzheng-source-units.csv');
  const yongzhengClaims = load('yongzheng-source-claims.csv');
  const units = [...kangxiUnits, ...yongzhengUnits];
  const claims = [...kangxiClaims, ...yongzhengClaims];
  const lanes = load('side-lanes.csv');
  const empressTimeline = load('kangxi-empress-timeline.csv');
  const princes = load('kangxi-princes.csv');
  const heirChain = load('kangxi-heir-chain.csv');
  const historicSites = load('historic-sites.csv');
  const questions = load('golden-questions.csv');
  const chapterRows = load('chapters.csv');

  for (const row of portraits) {
    row['预览文件'] = localPreview(row.visual_id, row['预览文件']);
  }
  for (const row of historicSites) {
    row['预览文件'] = localPreview(row.site_id, row['预览文件']);
  }

  const portraitsByEmperor = new Map();
  for (const row of portraits) {
    const list = portraitsByEmperor.get(row.emperor_id) || [];
    list.push(row);
    portraitsByEmperor.set(row.emperor_id, list);
  }
  function primaryPortrait(emperorId) {
    const list = portraitsByEmperor.get(emperorId) || [];
    return list.find((row) => row['展示角色'] === '默认朝服像') || list[0] || null;
  }
  const crosswalkByLegacy = new Map(crosswalk.map((row) => [row.legacy_emperor_id, row]));

  const emperorRecords = emperors.map((emperor) => {
    const map = crosswalkByLegacy.get(emperor.emperor_id);
    return {
      ...emperor,
      person_id: map?.person_id || '',
      id_status: map?.status || '',
      portrait: slimPortrait(primaryPortrait(emperor.emperor_id)),
    };
  });

  const chapters = chapterRows.map((row) => {
    const file = path.join(contentDir, row.file);
    const markdown = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    return { ...row, markdown, bodyHtml: mdToHtml(markdown) };
  });

  const coverage = {
    emperors: emperors.length,
    people: people.length,
    sources: sources.length,
    claims: claims.length,
    verifiedClaims: claims.filter((row) => row['复核人']).length,
    portraits: portraits.length,
    lanes: lanes.length,
    empressEvents: empressTimeline.length,
    princes: princes.length,
    heirEvents: heirChain.length,
    sites: historicSites.length,
    questions: questions.length,
    chapters: chapters.length,
    tasksDone: tasks.filter((row) => row['状态'] === '已完成').length,
    tasksTotal: tasks.length,
  };

  const suggest = [];
  const seenPeople = new Set();
  for (const emperor of emperorRecords) {
    seenPeople.add(emperor.person_id);
    suggest.push({
      id: emperor.person_id,
      label: emperor['年号或通称'].split('；')[0],
      extra: emperor['规范名'],
      hay: [emperor.person_id, emperor.emperor_id, emperor['规范名'], emperor['年号或通称'], emperor['庙号'], emperor['父亲'], emperor['母亲']].join(' '),
    });
  }
  for (const person of people) {
    if (seenPeople.has(person.person_id)) continue;
    suggest.push({
      id: person.person_id,
      label: person['规范名'].replace(/^爱新觉罗·/, ''),
      extra: person['常用名或异名'],
      hay: [person.person_id, person['规范名'], person['常用名或异名'], person['人物类型']].join(' '),
    });
  }

  const searchEntries = [
    ...suggest.map((row) => searchEntry('person', row.id, row.hay, { label: row.label, extra: row.extra })),
    ...claims.map((row) => searchEntry('claim', row['Assertion ID'], Object.values(row).join(' '))),
    ...sources.map((row) => searchEntry('source', row.source_id, Object.values(row).join(' '))),
    ...lanes.map((row) => searchEntry('lane', row.lane_id, Object.values(row).join(' '))),
    ...empressTimeline.map((row) => searchEntry('empress', row.event_id, Object.values(row).join(' '))),
    ...princes.map((row) => searchEntry('prince', row.person_id, Object.values(row).join(' '), {
      label: row['规范名'].replace(/^爱新觉罗·/, ''),
      extra: row['表序标签'],
    })),
    ...heirChain.map((row) => searchEntry('heir', row.event_id, Object.values(row).join(' '))),
    ...historicSites.map((row) => searchEntry('site', row.site_id, Object.values(row).join(' '))),
    ...questions.map((row) => searchEntry('question', row.question_id, Object.values(row).join(' '), {
      label: row['问题'],
      extra: row['类别'],
    })),
    ...chapters.map((row) => searchEntry('chapter', row.slug, [row.title, row.lede, row.era, row.markdown].join(' '), {
      label: row.title,
      extra: row.era,
    })),
  ];

  fs.mkdirSync(dataOutDir, { recursive: true });
  const written = [
    writeJson('home.json', {
      generatedAt: new Date().toISOString(),
      notice: '引文可回原文。家谱尚未用玉牒核对。',
      emperors: emperorRecords,
      sites: historicSites,
      coverage,
      suggest,
    }),
    writeJson('people.json', { people, portraits, crosswalk }),
    writeJson('kangxi.json', { units, claims, lanes, empressTimeline, princes, heirChain, chapters, questions }),
    writeJson('catalog.json', { sources, sourceIndex, tasks }),
    writeJson('search.json', buildIndex(searchEntries)),
  ];

  const legacy = path.join(siteDir, 'data.js');
  if (fs.existsSync(legacy)) fs.unlinkSync(legacy);

  const indexPath = path.join(siteDir, 'index.html');
  let indexHtml = fs.readFileSync(indexPath, 'utf8');
  const homeRe = /<main id="main"[^>]*>[\s\S]*?<\/main>/;
  if (homeRe.test(indexHtml)) {
    const home = homeHtml(emperorRecords, historicSites, { onerror: false });
    indexHtml = indexHtml.replace(homeRe, `<main id="main" data-ssr="home">\n${home}\n  </main>`);
    fs.writeFileSync(indexPath, indexHtml);
  } else {
    console.warn('WARN: index.html 未找到 <main id="main">，跳过直出。');
  }

  const summary = written.map((item) => `${item.name} ${item.bytes}B`).join(', ');
  console.log(`Wrote site/data/{${written.map((item) => item.name).join(', ')}} (${summary})`);
  console.log(`Home emperors ${emperorRecords.length}, sites ${historicSites.length}, search entries ${searchEntries.length}`);
}

build();

if (process.argv.includes('--watch')) {
  let timer = null;
  const kick = (event, filename) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      console.log(`rebuild after ${event} ${filename || ''}`);
      try {
        build();
      } catch (err) {
        console.error(err);
      }
    }, 200);
  };
  fs.watch(dataDir, { recursive: true }, kick);
  fs.watch(contentDir, { recursive: true }, kick);
  fs.watch(path.join(siteDir, 'templates.js'), kick);
  console.log('watching data/, content/, site/templates.js');
}
