import { kv } from '@vercel/kv';

// 默认数据 — 与 index.html 保持一致
const DEFAULTS = {
  goods: [
    { icon: '📦', name: '钢材原料', stock: 126 },
    { icon: '🔩', name: '标准钢球', stock: 890 },
    { icon: '🛠️', name: '铸造模具', stock: 32 },
    { icon: '⚙️', name: '机械配件', stock: 157 },
    { icon: '🪨', name: '铸造砂料', stock: 640 },
    { icon: '🧰', name: '维修工具', stock: 48 },
  ],
  staff: [
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
  ],
};

// 本地开发时的内存缓存（无 KV 环境时使用，函数冷启动时重置）
let memCache = null;

async function getData() {
  try {
    const data = await kv.get('stock_data');
    if (data) return data;
  } catch (e) {
    // KV 未连接时回退到内存缓存
    if (memCache) return memCache;
  }
  return { goods: [...DEFAULTS.goods], staff: [...DEFAULTS.staff] };
}

async function setData(data) {
  try {
    await kv.set('stock_data', data);
  } catch (e) {
    // KV 不可用时存到内存
    memCache = data;
  }
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(res, status, body) {
  res.writeHead(status, { ...corsHeaders, 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  // CORS 预检
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    return res.end();
  }

  try {
    if (req.method === 'GET') {
      const data = await getData();
      return json(res, 200, data);
    }

    if (req.method === 'POST') {
      // 解析 body
      let body = '';
      for await (const chunk of req) {
        body += chunk;
      }
      const input = JSON.parse(body);

      // 验证：至少有一个有效数组
      if (!input.goods && !input.staff) {
        return json(res, 400, { error: '请提供 goods 或 staff 数组' });
      }

      // 从 KV 读取当前数据，然后部分合并
      const current = await getData();

      if (input.goods !== undefined) {
        if (!Array.isArray(input.goods)) {
          return json(res, 400, { error: 'goods 必须是数组' });
        }
        current.goods = input.goods;
      }

      if (input.staff !== undefined) {
        if (!Array.isArray(input.staff)) {
          return json(res, 400, { error: 'staff 必须是数组' });
        }
        current.staff = input.staff;
      }

      await setData(current);
      return json(res, 200, { success: true, ...current });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('/api/stock error:', err);
    return json(res, 500, { error: 'Internal server error' });
  }
}
