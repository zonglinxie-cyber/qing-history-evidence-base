export function normalize(text) {
  return String(text || '').toLowerCase().replace(/[·\s；;，,。.\-_/]/g, '');
}

export function grams(text) {
  const value = normalize(text);
  const out = [];
  const seen = new Set();
  if (!value) return out;
  for (let i = 0; i + 1 < value.length; i += 1) {
    const token = value.slice(i, i + 2);
    if (seen.has(token)) continue;
    seen.add(token);
    out.push(token);
  }
  return out;
}

function intersect(left, right) {
  const set = new Set(right);
  return left.filter((id) => set.has(id));
}

export function buildIndex(entries) {
  const postings = Object.create(null);
  entries.forEach((entry, index) => {
    for (const gram of grams(entry.hay)) {
      if (!postings[gram]) postings[gram] = [];
      postings[gram].push(index);
    }
  });
  return { entries, postings };
}

export function lookup(index, query) {
  const needle = normalize(query);
  if (!needle || !index?.entries) return [];
  const take = (list) => {
    const hits = [];
    const seen = new Set();
    for (const entry of list) {
      const key = `${entry.type}:${entry.id}`;
      if (!entry || seen.has(key) || !normalize(entry.hay).includes(needle)) continue;
      seen.add(key);
      hits.push(entry);
    }
    return hits;
  };
  const rank = (list) => {
    const hits = take(list);
    hits.sort((a, b) => {
      const aTitle = normalize(a.label || '').includes(needle) ? 0 : 1;
      const bTitle = normalize(b.label || '').includes(needle) ? 0 : 1;
      return aTitle - bTitle;
    });
    if (needle.length < 2) return hits.slice(0, 50);
    return hits;
  };
  if (needle.length < 2 || !index.postings) return rank(index.entries);
  const tokens = grams(needle);
  let ids = null;
  for (const token of tokens) {
    const post = index.postings[token];
    if (!post) return [];
    ids = ids ? intersect(ids, post) : post.slice();
    if (!ids.length) return [];
  }
  return rank((ids || []).map((id) => index.entries[id]));
}
