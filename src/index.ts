import { DASHBOARD_HTML } from './ui';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 1. Serve Dashboard (UI) at root
    if (request.method === 'GET' && url.pathname === '/') {
      return new Response(DASHBOARD_HTML, {
        headers: { "Content-Type": "text/html" }
      });
    }

    // 2. API: Analytics Data for Dashboard
    if (url.pathname === '/api/stats') {
      return handleStats(request, env);
    }

    // 3. API: Telegram Webhook
    if (request.method === 'POST' && url.pathname === '/webhook') {
      try {
        const update: any = await request.json();
        if (update.message) {
          ctx.waitUntil(handleMessage(update.message, env));
        }
        return new Response('OK');
      } catch (e) {
        return new Response('Error', { status: 500 });
      }
    }

    return new Response('Not Found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;

// --- BOT LOGIC ---

async function handleMessage(message: any, env: Env) {
  const chatId = message.chat.id;
  const text = message.text || '';
  const user = message.from;

  // A. Handle Download (/start code)
  if (text.startsWith('/start ')) {
    const code = text.split(' ')[1];
    if (code) {
      // Force Subscribe Check
      const isSubscribed = await checkSubscription(user.id, env);
      
      if (!isSubscribed) {
        const channelUrl = `https://t.me/${env.FORCE_CHANNEL.replace('@', '')}`;
        const startUrl = `https://t.me/${env.BOT_USERNAME}?start=${code}`;
        
        return sendMessage(chatId, 
          `⚠️ *Access Denied*\n\nYou must subscribe to our channel to access this file.`, 
          env, 
          {
            inline_keyboard: [[
              { text: "📢 Join Channel", url: channelUrl },
            ], [
              { text: "🔄 Try Again", url: startUrl }
            ]]
          }
        );
      }

      return sendFileByCode(chatId, code, env);
    }
  }

  // B. Handle Welcome
  if (text === '/start') {
    return sendMessage(chatId, 
      `System is Started Successfully ✅\n╰┈➤ Now send me any media to store it...`, 
      env
    );
  }

  // C. Handle Upload
  const fileData = extractFileData(message);
  if (fileData) {
    const code = crypto.randomUUID().split('-')[0];
    const { file_id, file_type, caption } = fileData;

    await env.DB.prepare(
      `INSERT INTO files (code, file_id, file_type, caption, created_at) VALUES (?, ?, ?, ?, ?)`
    ).bind(code, file_id, file_type, caption || '', Date.now()).run();

    const botUrl = `https://t.me/${env.BOT_USERNAME}?start=${code}`;
    const responseText = 
`*Press The Button Or Click To Copy
The Link Below To Share Your File!*

${botUrl}

Press The [Button](${botUrl}) To Open The Link`;

    return sendMessage(chatId, responseText, env, {
      inline_keyboard: [[
        { text: "✖️ Share", url: `https://t.me/share/url?url=${botUrl}` }
      ]]
    });
  }
}

// --- HELPERS ---

async function sendFileByCode(chatId: number, code: string, env: Env) {
  const file = await env.DB.prepare(`SELECT * FROM files WHERE code = ?`).bind(code).first<any>();
  
  if (!file) {
    return sendMessage(chatId, "❌ *File not found.* It may have been deleted.", env);
  }

  // Update View Count
  await env.DB.prepare(`UPDATE files SET views = views + 1 WHERE code = ?`).bind(code).run();

  const method = getMethodByType(file.file_type);
  const payload = {
    chat_id: chatId,
    [file.file_type]: file.file_id,
    caption: file.caption || `Uploaded via @${env.BOT_USERNAME}`,
    protect_content: true
  };

  await callTelegram(method, payload, env);
}

async function checkSubscription(userId: number, env: Env): Promise<boolean> {
  if (!env.FORCE_CHANNEL || env.FORCE_CHANNEL === 'false') return true;
  try {
    const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/getChatMember?chat_id=${env.FORCE_CHANNEL}&user_id=${userId}`;
    const res = await fetch(url);
    const data: any = await res.json();
    if (!data.ok) return true; // Fail open if bot isn't admin
    return ['creator', 'administrator', 'member', 'restricted'].includes(data.result.status);
  } catch (e) {
    return true; 
  }
}

function extractFileData(message: any) {
  if (message.document) return { file_id: message.document.file_id, file_type: 'document', caption: message.caption };
  if (message.video) return { file_id: message.video.file_id, file_type: 'video', caption: message.caption };
  if (message.audio) return { file_id: message.audio.file_id, file_type: 'audio', caption: message.caption };
  if (message.photo) {
    const best = message.photo[message.photo.length - 1];
    return { file_id: best.file_id, file_type: 'photo', caption: message.caption };
  }
  return null;
}

function getMethodByType(type: string) {
  const map: any = { 'document': 'sendDocument', 'video': 'sendVideo', 'photo': 'sendPhoto', 'audio': 'sendAudio' };
  return map[type] || 'sendMessage';
}

async function sendMessage(chatId: number, text: string, env: Env, replyMarkup?: any) {
  return callTelegram('sendMessage', {
    chat_id: chatId,
    text: text,
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
    reply_markup: replyMarkup
  }, env);
}

async function callTelegram(method: string, payload: any, env: Env) {
  return fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

// --- ANALYTICS ---

async function handleStats(req: Request, env: Env) {
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret');

  if (secret !== env.ADMIN_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const totalFiles = await env.DB.prepare(`SELECT COUNT(*) as count FROM files`).first('count');
  const totalViews = await env.DB.prepare(`SELECT SUM(views) as views FROM files`).first('views');
  const recentFiles = await env.DB.prepare(`SELECT code, file_type, views, created_at FROM files ORDER BY created_at DESC LIMIT 10`).all();

  return new Response(JSON.stringify({
    totalFiles,
    totalViews: totalViews || 0,
    recentFiles: recentFiles.results
  }), { headers: { 'Content-Type': 'application/json' } });
}
