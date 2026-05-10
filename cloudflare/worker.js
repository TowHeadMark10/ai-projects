// JWT helpers
async function generateJWT(env) {
  const header = btoa(JSON.stringify({ alg: 'ES256', kid: env.APNS_KEY_ID }))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const now = Math.floor(Date.now() / 1000);
  const payload = btoa(JSON.stringify({ iss: env.APNS_TEAM_ID, iat: now }))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const keyData = env.APNS_PRIVATE_KEY
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');

  const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', binaryKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  );

  const data = new TextEncoder().encode(`${header}.${payload}`);
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, cryptoKey, data
  );

  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${header}.${payload}.${sig}`;
}

async function sendAPNsPush(env, jwt, token, body, sandbox) {
  const host = sandbox ? 'api.sandbox.push.apple.com' : 'api.push.apple.com';
  const url = `https://${host}/3/device/${token}`;
  const topic = `${env.APNS_BUNDLE_ID}.push-type.liveactivity`;

  return fetch(url, {
    method: 'POST',
    headers: {
      authorization: `bearer ${jwt}`,
      'apns-topic': topic,
      'apns-push-type': 'liveactivity',
      'apns-priority': '10',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function buildAPNsBody(sessionType, totalSeconds, pomodoroCount, endTimestamp, timeRemaining, isDone) {
  const contentState = {
    endTimestamp,
    isPaused: false,
    timeRemaining,
    sessionType,
    totalSeconds,
    pomodoroCount,
  };
  return {
    aps: {
      timestamp: Math.floor(Date.now() / 1000),
      event: 'update',
      'content-state': contentState,
    },
  };
}

// Shared JWT via KV — used by both main Worker and DO to avoid TooManyProviderTokenUpdates
async function getSharedJWT(env) {
  const now = Date.now() / 1000;
  const cached = await env.JWT_CACHE.get('jwt', 'json');
  if (cached && now < cached.expiry) return cached.token;
  const token = await generateJWT(env);
  const expiry = now + 45 * 60; // 45 min (Apple limit is 60 min)
  await env.JWT_CACHE.put('jwt', JSON.stringify({ token, expiry }), { expirationTtl: 2700 });
  return token;
}

// Main Worker
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/schedule') {
      const data = await request.json();
      const id = env.TIMER_SCHEDULER.idFromName(data.token);
      const stub = env.TIMER_SCHEDULER.get(id);
      return stub.fetch(new Request('https://do/schedule', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'content-type': 'application/json' },
      }));
    }

    if (request.method === 'POST' && url.pathname === '/cancel') {
      const data = await request.json();
      const id = env.TIMER_SCHEDULER.idFromName(data.token);
      const stub = env.TIMER_SCHEDULER.get(id);
      return stub.fetch(new Request('https://do/cancel', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'content-type': 'application/json' },
      }));
    }

    // Direct push — GCD fast path when app is alive
    if (request.method === 'POST') {
      const { token, sessionType, totalSeconds, pomodoroCount, endTimestamp, timeRemaining, isDone, sandbox } = await request.json();
      const jwt = await getSharedJWT(env);
      const body = buildAPNsBody(sessionType, totalSeconds, pomodoroCount, endTimestamp, timeRemaining, isDone);
      const res = await sendAPNsPush(env, jwt, token, body, sandbox);
      const text = await res.text();
      console.log(`Direct push (${isDone ? 'done' : 'update'}) → ${res.status}: ${text}`);
      return new Response(text, { status: res.status });
    }

    return new Response('Pomodoro APNs Worker', { status: 200 });
  },
};

// Durable Object — handles server-side APNs scheduling
export class TimerScheduler {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async getJWT() {
    return getSharedJWT(this.env);
  }

  async fetch(request) {
    const url = new URL(request.url);
    const data = await request.json();
    if (url.pathname === '/schedule') return this.register(data);
    if (url.pathname === '/cancel') return this.cancel();
    return new Response('Not found', { status: 404 });
  }

  async register(data) {
    const { token, sessionType, totalSeconds, pomodoroCount, endTimestamp, sandbox } = data;
    const now = Date.now() / 1000;
    const schedule = [];
    const maxMinutes = Math.floor(totalSeconds / 60);

    // Minute-mark updates (Xm remaining)
    for (let m = maxMinutes; m >= 1; m--) {
      const fireAt = endTimestamp - m * 60;
      if (fireAt > now + 1) {
        schedule.push({ time: fireAt * 1000, remaining: m * 60, done: false });
      }
    }
    // Done event — DO is the sole sender of the done push
    schedule.push({ time: endTimestamp * 1000, remaining: 0, done: true });
    schedule.sort((a, b) => a.time - b.time);

    await this.state.storage.put('data', { token, sessionType, totalSeconds, pomodoroCount, endTimestamp, sandbox, schedule });
    await this.state.storage.setAlarm(schedule[0].time);

    console.log(`Scheduled ${schedule.length} events, first at ${new Date(schedule[0].time).toISOString()}`);
    return new Response(JSON.stringify({ scheduled: schedule.length }), { status: 200, headers: { 'content-type': 'application/json' } });
  }

  async cancel() {
    await this.state.storage.delete('data');
    await this.state.storage.deleteAlarm();
    console.log('Timer cancelled');
    return new Response('Cancelled', { status: 200 });
  }

  async alarm() {
    const stored = await this.state.storage.get('data');
    if (!stored) return;

    const { token, sessionType, totalSeconds, pomodoroCount, endTimestamp, sandbox, schedule } = stored;
    if (schedule.length === 0) { await this.state.storage.delete('data'); return; }

    const [current, ...remaining] = schedule;
    await this.push(token, sessionType, totalSeconds, pomodoroCount, endTimestamp, current.remaining, current.done, sandbox);

    if (remaining.length > 0) {
      await this.state.storage.put('data', { token, sessionType, totalSeconds, pomodoroCount, endTimestamp, sandbox, schedule: remaining });
      await this.state.storage.setAlarm(remaining[0].time);
    } else {
      await this.state.storage.delete('data');
    }
  }

  async push(token, sessionType, totalSeconds, pomodoroCount, endTimestamp, timeRemaining, isDone, sandbox) {
    try {
      const jwt = await this.getJWT();
      const body = buildAPNsBody(sessionType, totalSeconds, pomodoroCount, endTimestamp, timeRemaining, isDone);
      const res = await sendAPNsPush(this.env, jwt, token, body, sandbox);
      const text = await res.text();
      console.log(`DO push (${isDone ? 'done' : `${timeRemaining}s rem`}) → ${res.status}: ${text}`);

      // Bad token — cancel remaining alarms
      if (res.status === 410 || text.includes('BadDeviceToken') || text.includes('Unregistered')) {
        await this.state.storage.delete('data');
        await this.state.storage.deleteAlarm();
      }
    } catch (err) {
      console.error('DO push error:', err);
    }
  }
}
