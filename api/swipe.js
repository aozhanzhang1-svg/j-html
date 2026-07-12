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

async function getSwipes() {
  try {
    const data = await kv.get('swipes_data');
    if (data) return data;
  } catch (e) {
    console.error('[swipe] KV 读取失败，回退到内存:', e.message);
  }
  return memSwipes;
}

async function addSwipe(record) {
  const swipes = await getSwipes();
  swipes.push(record);
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
    console.log('[swipe] KV 已清空');
  } catch (e) {
    console.error('[swipe] KV 删除失败:', e.message);
  }
}

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
        source: 'kv',
      });
    }

    // POST — 追加一条刷卡记录
    if (req.method === 'POST') {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
      }

      let input;
      try {
        input = JSON.parse(body);
      } catch {
        return json(res, 400, { error: 'JSON 格式错误' });
      }

      if (!input.cardId) {
        return json(res, 400, { error: '缺少 cardId（卡号）' });
      }

      const record = {
        cardId: String(input.cardId).trim(),
        name: input.name || '',
        time: input.time || new Date().toISOString(),
      };

      const swipes = await addSwipe(record);
      return json(res, 200, { success: true, total: swipes.length, record });
    }

    // DELETE — 清空全部刷卡记录（需确认参数）
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
