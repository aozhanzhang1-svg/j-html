import { kv } from '@vercel/kv';


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
  return { goods: [], staff: [] };
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
  res.writeHead(status, { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' });
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
