import { kv } from '@vercel/kv';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(res, status, body) {
  res.writeHead(status, { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

// 规范化卡号：去空格、去横线、转大写
function normId(id) {
  return (id || '').replace(/[\s\-_]/g, '').toUpperCase();
}

let memCards = null;

async function getCards() {
  try {
    const data = await kv.get('cards_data');
    if (data) return data;
  } catch (e) {
    console.error('[cards] KV 读取失败，回退到内存:', e.message);
    if (memCards) return memCards;
  }
  return memCards;
}

async function saveCards(cards) {
  memCards = cards;
  try {
    await kv.set('cards_data', cards);
    console.log(`[cards] KV 写入成功，共 ${cards.length} 条`);
  } catch (e) {
    console.error('[cards] KV 写入失败:', e.message);
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    return res.end();
  }

  try {
    // GET — 返回全部卡片绑定
    if (req.method === 'GET') {
      const cards = await getCards();
      return json(res, 200, { cards, total: cards.length });
    }

    // POST — 添加/更新卡片绑定
    if (req.method === 'POST') {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
      }

      let input;
      try { input = JSON.parse(body); } catch {
        return json(res, 400, { error: 'JSON 格式错误' });
      }

      // 支持单条添加 { cardId, name }
      // 也支持全量替换 { cards: [...] }
      if (input.cards && Array.isArray(input.cards)) {
        // 全量替换
        await saveCards(input.cards);
        return json(res, 200, { success: true, total: input.cards.length });
      }

      if (!input.cardId || !input.name) {
        return json(res, 400, { error: '请提供 cardId 和 name' });
      }

      const cards = await getCards();
      const cardId = normId(String(input.cardId));
      const name = String(input.name).trim();

      // 查找是否已存在（规范化比较，忽略空格和大小写）
      const idx = cards.findIndex(c => normId(c.cardId) === cardId);
      if (idx >= 0) {
        cards[idx].cardId = cardId;  // 统一格式
        cards[idx].name = name;
      } else {
        cards.push({ cardId, name });
      }

      await saveCards(cards);
      return json(res, 200, { success: true, total: cards.length, action: idx >= 0 ? 'updated' : 'added' });
    }

    // DELETE — 删除卡片绑定（body 传 { cardId }）
    if (req.method === 'DELETE') {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
      }
      let input;
      try { input = JSON.parse(body); } catch {
        return json(res, 400, { error: 'JSON 格式错误' });
      }

      if (!input.cardId) {
        return json(res, 400, { error: '请提供 cardId' });
      }

      const cards = await getCards();
      const cardId = normId(String(input.cardId));
      const filtered = cards.filter(c => normId(c.cardId) !== cardId);

      if (filtered.length === cards.length) {
        return json(res, 404, { error: '未找到该卡片' });
      }

      await saveCards(filtered);
      return json(res, 200, { success: true, total: filtered.length });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('[cards] 未捕获错误:', err);
    return json(res, 500, { error: 'Internal server error' });
  }
}
