/**
 * lovia-cron — AI 선톡 Cron Worker
 *
 * 크론 스케줄 (UTC)
 *  00:00  → KST 09:00 (morning)
 *  03:00  → KST 12:00 (lunch)
 *  13:00  → KST 22:00 (night)
 *  21:00  → KST 06:00 (missing 체크 — 24h 미접속 유저)
 */

export interface Env {
  DB: D1Database
  FIREBASE_SERVICE_ACCOUNT: string
  FIREBASE_PROJECT_ID: string
}

// ─── 시간대 판정 ─────────────────────────────────────────────
function getTimeSlot(utcHour: number): 'morning' | 'lunch' | 'night' | 'missing' | null {
  if (utcHour === 0)  return 'morning'
  if (utcHour === 3)  return 'lunch'
  if (utcHour === 13) return 'night'
  if (utcHour === 21) return 'missing'
  return null
}

// ─── Firebase FCM 헬퍼 ──────────────────────────────────────
async function getFirebaseAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson)
  const now = Math.floor(Date.now() / 1000)
  const header  = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }

  const encode = (obj: object) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

  const headerB64  = encode(header)
  const payloadB64 = encode(payload)
  const sigInput   = `${headerB64}.${payloadB64}`

  // PEM → CryptoKey
  const pemBody = sa.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '')
  const keyData = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyData.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  )

  const sigBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(sigInput)
  )
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

  const jwt = `${sigInput}.${sigB64}`

  // JWT → OAuth2 access token
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const json: any = await res.json()
  return json.access_token as string
}

async function sendFCM(
  token: string,
  title: string,
  body: string,
  data: Record<string, string>,
  serviceAccountJson: string,
  projectId: string
): Promise<boolean> {
  try {
    const accessToken = await getFirebaseAccessToken(serviceAccountJson)
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body },
            data,
            webpush: {
              notification: { icon: '/favicon.svg', badge: '/favicon.svg' },
              fcm_options: { link: '/' },
            },
          },
        }),
      }
    )
    return res.ok
  } catch {
    return false
  }
}

// ─── 페르소나 이름 맵 ────────────────────────────────────────
const PERSONA_NAMES: Record<string, string> = {
  minji: '민지', jiwoo: '지우', hayoung: '하영', eunbi: '은비', dahee: '다희',
}

// ─── 메인 Scheduled 핸들러 ──────────────────────────────────
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const db = env.DB
    if (!db) return

    const utcHour  = new Date(event.scheduledTime).getUTCHours()
    const timeSlot = getTimeSlot(utcHour)
    if (!timeSlot) return

    const now = new Date(event.scheduledTime).toISOString()
    console.log(`[lovia-cron] slot=${timeSlot} utcHour=${utcHour} time=${now}`)

    // ── 대상 유저 조회 ────────────────────────────────────────
    // 조건:
    //  1. push_opt_in = 1
    //  2. push_token이 존재하는 유저 (JOIN)
    //  3. missing 슬롯: last_active가 24시간 이전 (또는 null)
    //  4. 일반 슬롯: 오늘 같은 slot으로 발송된 이력 없음
    let targetQuery: string
    if (timeSlot === 'missing') {
      targetQuery = `
        SELECT u.id AS user_id,
               COALESCE(u.push_persona_id, 'minji') AS persona_id,
               pt.token
        FROM   users u
        JOIN   push_tokens pt ON pt.user_id = u.id
        WHERE  u.push_opt_in = 1
          AND  (u.last_active IS NULL
                OR u.last_active < datetime('now', '-24 hours'))
          AND  NOT EXISTS (
                 SELECT 1 FROM push_logs pl
                 WHERE pl.user_id = u.id
                   AND pl.time_slot = 'missing'
                   AND pl.sent_at > datetime('now', '-24 hours')
               )
      `
    } else {
      targetQuery = `
        SELECT u.id AS user_id,
               COALESCE(u.push_persona_id, 'minji') AS persona_id,
               pt.token
        FROM   users u
        JOIN   push_tokens pt ON pt.user_id = u.id
        WHERE  u.push_opt_in = 1
          AND  NOT EXISTS (
                 SELECT 1 FROM push_logs pl
                 WHERE pl.user_id = u.id
                   AND pl.time_slot = ?
                   AND pl.sent_at   > datetime('now', '-12 hours')
               )
      `
    }

    type TargetRow = { user_id: number; persona_id: string; token: string }
    let targets: TargetRow[] = []

    try {
      if (timeSlot === 'missing') {
        const res = await db.prepare(targetQuery).all<TargetRow>()
        targets = res.results ?? []
      } else {
        const res = await db.prepare(targetQuery).bind(timeSlot).all<TargetRow>()
        targets = res.results ?? []
      }
    } catch (e) {
      console.error('[lovia-cron] target query error:', e)
      return
    }

    console.log(`[lovia-cron] targets: ${targets.length}`)
    if (targets.length === 0) return

    // ── 배치 처리 ─────────────────────────────────────────────
    for (const target of targets) {
      const { user_id, persona_id, token } = target

      // 메시지 선택 (persona_id 전용 먼저, 없으면 'all')
      type MsgRow = { id: number; message: string }
      let msgRow: MsgRow | null = null
      try {
        msgRow = await db.prepare(
          `SELECT id, message FROM push_messages
           WHERE persona_id = ? AND time_slot = ? AND is_active = 1
           ORDER BY RANDOM() LIMIT 1`
        ).bind(persona_id, timeSlot).first<MsgRow>()

        if (!msgRow) {
          msgRow = await db.prepare(
            `SELECT id, message FROM push_messages
             WHERE persona_id = 'all' AND time_slot = ? AND is_active = 1
             ORDER BY RANDOM() LIMIT 1`
          ).bind(timeSlot).first<MsgRow>()
        }
      } catch (e) {
        console.error('[lovia-cron] msg select error:', e)
        continue
      }

      if (!msgRow) continue

      // FCM 발송
      const personaName = PERSONA_NAMES[persona_id] || '그녀'
      const sent = await sendFCM(
        token,
        `${personaName} ✉️`,
        msgRow.message,
        { personaId: persona_id, type: 'proactive', timeSlot },
        env.FIREBASE_SERVICE_ACCOUNT,
        env.FIREBASE_PROJECT_ID
      )

      if (sent) {
        // 발송 이력 기록
        try {
          await db.prepare(
            `INSERT INTO push_logs (user_id, persona_id, time_slot, message_id)
             VALUES (?, ?, ?, ?)`
          ).bind(user_id, persona_id, timeSlot, msgRow.id).run()
        } catch (e) {
          console.error('[lovia-cron] push_logs insert error:', e)
        }
      }
    }

    console.log(`[lovia-cron] done slot=${timeSlot}`)
  },
}
