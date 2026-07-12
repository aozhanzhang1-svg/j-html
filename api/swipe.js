import { kv } from '@vercel/kv';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(res, status, body) {
  res.writeHead(status, { ...corsHeaders, 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

// 内存缓存（本地开发 KV 不可用时回退）
let memSwipes = [];
let memCards = [];
let memStock = null;

// ── 刷卡记录 ──
async function getSwipes() {
  try {
    const data = await kv.get('swipes_data');
    if (data) return data;
  } catch (e) {
    console.error('[swipe] KV 读取失败，回退到内存:', e.message);
  }
  return memSwipes;
}

// KV 最多保留 500 条刷卡记录，超出自动删除最旧的
const MAX_RECORDS = 500;

async function addSwipe(record) {
  let swipes = await getSwipes();
  swipes.push(record);
  // 超出上限：只保留最新的 MAX_RECORDS 条
  if (swipes.length > MAX_RECORDS) {
    swipes = swipes.slice(swipes.length - MAX_RECORDS);
    console.log(`[swipe] 记录超过 ${MAX_RECORDS} 条，已自动删除旧记录`);
  }
  try {
    await kv.set('swipes_data', swipes);
    console.log(`[swipe] KV 写入成功，共 ${swipes.length} 条`);
  } catch (e) {
    console.error('[swipe] KV 写入失败，仅存内存:', e.message);
    memSwipes = swipes;
  }
  return swipes;
}

async function clearSwipes() {
  memSwipes = [];
  try {
    await kv.del('swipes_data');
  } catch (e) {
    console.error('[swipe] KV 删除失败:', e.message);
  }
}

// ── 卡片绑定 ──
async function getCards() {
  try {
    const data = await kv.get('cards_data');
    if (data) { memCards = data; return data; }
  } catch (e) { /* ignore */ }
  return memCards;
}

// 规范化卡号：去空格、去横线、转大写，统一比较
function normalizeCardId(id) {
  return (id || '').replace(/[\s\-_]/g, '').toUpperCase();
}

// 根据 cardId 查绑定名
async function lookupCardName(cardId) {
  const cards = await getCards();
  const norm = normalizeCardId(cardId);
  const found = cards.find(c => normalizeCardId(c.cardId) === norm);
  return found ? found.name : null;
}

// ── 人员到岗同步 ──
const STAFF_DEFAULTS = [
  { icon: '👷', name: '鸡大强', status: 'morning' },
  { icon: '👷‍♂️', name: '鸡大国', status: 'night' },
  { icon: '👷‍♀️', name: '鸡大梅', status: 'all' },
  { icon: '🧑‍🏭', name: '鸡大海', status: 'morning' },
  { icon: '👷', name: '鸡大山', status: 'night' },
  { icon: '👷‍♂️', name: '鸡大刚', status: 'all' },
  { icon: '👷‍♀️', name: '鸡大芬', status: 'morning' },
  { icon: '🧑‍🏭', name: '鸡大军', status: 'night' },
  { icon: '👷', name: '鸡大林', status: 'all' },
  { icon: '👷‍♂️', name: '鸡大忠', status: 'morning' },
  { icon: '👷‍♀️', name: '鸡大秀', status: 'night' },
  { icon: '🧑‍🏭', name: '鸡大福', status: 'all' },
  { icon: '👷', name: '鸡大荣', status: 'morning' },
  { icon: '👷‍♂️', name: '鸡大伟', status: 'night' },
  { icon: '👷‍♀️', name: '鸡大莲', status: 'all' },
  { icon: '🧑‍🏭', name: '鸡大斌', status: 'morning' },
  { icon: '👷', name: '鸡大彪', status: 'night' },
  { icon: '👷‍♂️', name: '鸡大祥', status: 'all' },
  { icon: '👷‍♀️', name: '鸡大芝', status: 'morning' },
  { icon: '🧑‍🏭', name: '鸡大坤', status: 'night' },
  { icon: '👷', name: '鸡小宇', status: 'all' },
  { icon: '👷‍♂️', name: '鸡小航', status: 'morning' },
  { icon: '👷‍♀️', name: '鸡小婷', status: 'night' },
  { icon: '🧑‍🏭', name: '鸡小泽', status: 'all' },
  { icon: '👷', name: '鸡小豪', status: 'morning' },
  { icon: '👷‍♂️', name: '鸡小凯', status: 'night' },
  { icon: '👷‍♀️', name: '鸡小冉', status: 'all' },
  { icon: '🧑‍🏭', name: '鸡小辰', status: 'morning' },
  { icon: '👷', name: '鸡小硕', status: 'night' },
  { icon: '👷‍♂️', name: '鸡小杨', status: 'all' },
  { icon: '👷‍♀️', name: '鸡小诺', status: 'morning' },
  { icon: '🧑‍🏭', name: '鸡小峰', status: 'night' },
  { icon: '👷', name: '鸡小恒', status: 'all' },
  { icon: '👷‍♂️', name: '鸡小乐', status: 'morning' },
  { icon: '👷‍♀️', name: '鸡小晴', status: 'night' },
  { icon: '🧑‍🏭', name: '鸡小川', status: 'all' },
  { icon: '👷', name: '鸡小帆', status: 'morning' },
  { icon: '👷‍♂️', name: '鸡小源', status: 'night' },
  { icon: '👷‍♀️', name: '鸡小萱', status: 'all' },
  { icon: '🧑‍🏭', name: '鸡小炎', status: 'morning' },
];

async function getStock() {
  try {
    const data = await kv.get('stock_data');
    if (data) { memStock = data; return data; }
  } catch (e) { /* ignore */ }
  if (memStock) return memStock;
  return null;
}

async function setStock(data) {
  memStock = data;
  try {
    await kv.set('stock_data', data);
  } catch (e) {
    console.error('[swipe] stock_data 更新失败:', e.message);
  }
}

// 刷卡后同步到人员到岗：如果此人已在 staff 列表中，标为"全天在岗"并记录刷卡时间
async function syncStaffAttendance(personName, swipeTime) {
  if (!personName) return { synced: false, reason: 'no name' };

  let stock = await getStock();
  if (!stock) {
    // stock_data 还没初始化，跳过
    return { synced: false, reason: 'stock not initialized' };
  }

  if (!stock.staff) stock.staff = [];

  // 查找是否已有此人
  const idx = stock.staff.findIndex(
    s => s.name.toLowerCase() === personName.toLowerCase()
  );

  if (idx >= 0) {
    // 已存在：更新到岗状态 + 记录最后刷卡时间
    stock.staff[idx].status = 'all';
    stock.staff[idx].lastSwipe = swipeTime;
    await setStock(stock);
    console.log(`[swipe] 同步到岗: ${stock.staff[idx].name} → 全天在岗`);
    return { synced: true, action: 'updated', name: stock.staff[idx].name };
  } else {
    // 新人：自动添加到 staff 列表
    stock.staff.push({
      icon: '💳',
      name: personName,
      status: 'all',
      lastSwipe: swipeTime,
    });
    await setStock(stock);
    console.log(`[swipe] 自动添加人员: ${personName}`);
    return { synced: true, action: 'added', name: personName };
  }
}

// ── 主 handler ──
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    return res.end();
  }

  try {
    // GET — 返回全部刷卡记录（最新在前）
    if (req.method === 'GET') {
      const swipes = await getSwipes();
      return json(res, 200, {
        swipes: [...swipes].reverse(),
        total: swipes.length,
      });
    }

    // POST — 追加一条刷卡记录
    if (req.method === 'POST') {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
      }

      let input;
      try { input = JSON.parse(body); } catch {
        return json(res, 400, { error: 'JSON 格式错误' });
      }

      if (!input.cardId) {
        return json(res, 400, { error: '缺少 cardId（卡号）' });
      }

      const cardId = String(input.cardId).trim();

      // 以网页端卡片绑定为准（覆盖 ESP32 硬编码名字）
      const boundName = await lookupCardName(cardId);
      const name = boundName || input.name || '';

      const record = {
        cardId,
        name,
        time: input.time || new Date().toISOString(),
      };

      const swipes = await addSwipe(record);

      // 同步到人员到岗
      const syncResult = await syncStaffAttendance(name, record.time);

      return json(res, 200, {
        success: true,
        total: swipes.length,
        record,
        sync: syncResult,
      });
    }

    // DELETE — 清空全部刷卡记录
    if (req.method === 'DELETE') {
      await clearSwipes();
      return json(res, 200, { success: true, message: '刷卡记录已清空' });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('[swipe] 未捕获错误:', err);
    return json(res, 500, { error: 'Internal server error' });
  }
}
