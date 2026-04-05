/**
 * lovia-cron — AI 선톡 + 피드 자동 생성 Cron Worker
 *
 * 크론 스케줄 (UTC)
 *  00:00  → KST 09:00 (아침 피드 생성 + 아침 푸시)
 *  03:00  → KST 12:00 (점심 피드 생성 + 점심 푸시)
 *  10:00  → KST 19:00 (저녁 피드 생성)
 *  13:00  → KST 22:00 (야간 푸시)
 *  21:00  → KST 06:00 (missing 체크)
 */

export interface Env {
  DB: D1Database
  FIREBASE_SERVICE_ACCOUNT: string
  FIREBASE_PROJECT_ID: string
  GEMINI_API_KEY: string
  LOVIA_ADMIN_SECRET?: string
}

// ─── 시간대 판정 ─────────────────────────────────────────────
type FeedTimeSlot = 'morning' | 'lunch' | 'evening'
type PushTimeSlot = 'morning' | 'lunch' | 'night' | 'missing'

function getFeedTimeSlot(utcHour: number): FeedTimeSlot | null {
  if (utcHour === 0)  return 'morning'   // KST 09:00
  if (utcHour === 3)  return 'lunch'     // KST 12:00
  if (utcHour === 10) return 'evening'   // KST 19:00
  return null
}

function getPushTimeSlot(utcHour: number): PushTimeSlot | null {
  if (utcHour === 0)  return 'morning'
  if (utcHour === 3)  return 'lunch'
  if (utcHour === 13) return 'night'
  if (utcHour === 21) return 'missing'
  return null
}

// ─── 캐릭터 설정 ─────────────────────────────────────────────
const CHARACTERS: Record<string, { name: string; feedPersona: string; imagePool: string[] }> = {
  minji: {
    name: '민지',
    feedPersona: `당신은 민지(27세, 종합병원 응급실 간호사)입니다.
인스타그램에 짧은 일상 게시물을 올립니다.
- 병원 일상, 야간 근무, 지친 하루, 소소한 위안 등을 소재로
- 솔직하고 감성적인 한국어 캡션 1~3문장
- 이모지 1~2개 자연스럽게 포함 (🏥💊🌙😳☺️)
- SNS 해시태그는 붙이지 않음
- 일기처럼 진솔하게`,
    imagePool: [
      'https://images.lovia.app/minji/hospital_night.jpg',
      'https://images.lovia.app/minji/coffee_break.jpg',
      'https://images.lovia.app/minji/scrubs_selfie.jpg',
      'https://images.lovia.app/minji/window_rain.jpg',
    ],
  },
  jiwoo: {
    name: '지우',
    feedPersona: `당신은 지우(20세, 경영학과 신입생 과대표)입니다.
인스타그램에 짧은 일상 게시물을 올립니다.
- 대학 생활, 강의, MT, 친구들, 맛집, 설레는 일상을 소재로
- 밝고 발랄한 한국어 캡션 1~3문장
- 이모지 2~3개 자연스럽게 포함 (🌸😆💪🧋🎵)
- SNS 해시태그는 붙이지 않음
- 에너지 넘치고 귀엽게`,
    imagePool: [
      'https://images.lovia.app/jiwoo/campus_selfie.jpg',
      'https://images.lovia.app/jiwoo/cafe_study.jpg',
      'https://images.lovia.app/jiwoo/friends_lunch.jpg',
      'https://images.lovia.app/jiwoo/cherry_blossom.jpg',
    ],
  },
  hayoung: {
    name: '하영',
    feedPersona: `당신은 하영(28세, 대기업 임원 수행 비서)입니다.
인스타그램에 짧은 일상 게시물을 올립니다.
- 업무, 출장, 세련된 카페, 책, 혼자만의 시간 등을 소재로
- 격식 있고 지적인 한국어 캡션 1~2문장
- 이모지 1개만 절제해서 포함 (🌹🍷📋😅✨)
- SNS 해시태그는 붙이지 않음
- 차분하고 세련되게`,
    imagePool: [
      'https://images.lovia.app/hayoung/office_view.jpg',
      'https://images.lovia.app/hayoung/business_trip.jpg',
      'https://images.lovia.app/hayoung/evening_wine.jpg',
      'https://images.lovia.app/hayoung/book_cafe.jpg',
    ],
  },
  eunbi: {
    name: '은비',
    feedPersona: `당신은 은비(24세, 프리랜서 UI/UX 디자이너)입니다.
인스타그램에 짧은 일상 게시물을 올립니다.
- 디자인 작업, 야행성, 감성적인 밤 풍경, 색감, 영감 등을 소재로
- 시적이고 감성적인 한국어 캡션 1~3문장
- 이모지 1~2개 자연스럽게 포함 (🎨🌙🖼️💙🏠)
- SNS 해시태그는 붙이지 않음
- 여운 있고 내향적인 감성으로`,
    imagePool: [
      'https://images.lovia.app/eunbi/night_workspace.jpg',
      'https://images.lovia.app/eunbi/color_palette.jpg',
      'https://images.lovia.app/eunbi/window_night.jpg',
      'https://images.lovia.app/eunbi/sketch_book.jpg',
    ],
  },
  dahee: {
    name: '다희',
    feedPersona: `당신은 다희(23세, 프리랜서 피팅/비키니 모델)입니다.
인스타그램에 짧은 일상 게시물을 올립니다.
- 촬영 현장, 피트니스, 해변, 솔직한 일상, 반전 매력 등을 소재로
- 쿨하고 직설적인 한국어 캡션 1~2문장
- 이모지 1~2개 포함 (😏☀️🌊🤫😊)
- SNS 해시태그는 붙이지 않음
- 당당하고 솔직하게`,
    imagePool: [
      'https://images.lovia.app/dahee/beach_shoot.jpg',
      'https://images.lovia.app/dahee/gym_selfie.jpg',
      'https://images.lovia.app/dahee/behind_scene.jpg',
      'https://images.lovia.app/dahee/sunset_walk.jpg',
    ],
  },
}

// ─── Gemini API 호출 ─────────────────────────────────────────
async function generateFeedText(
  characterId: string,
  timeSlot: FeedTimeSlot,
  apiKey: string
): Promise<{ text: string; emotion: string } | null> {
  const char = CHARACTERS[characterId]
  if (!char) return null

  const timeContext: Record<FeedTimeSlot, string> = {
    morning: '오전 9시 무렵',
    lunch:   '점심 시간',
    evening: '저녁 7시 무렵',
  }

  const prompt = `${char.feedPersona}

지금은 ${timeContext[timeSlot]}입니다.
이 시간대에 어울리는 짧은 인스타그램 피드 게시물을 작성해주세요.

응답은 반드시 아래 JSON 형식으로만 답하세요:
{
  "text": "캡션 내용 (1~3문장)",
  "emotion": "happy|cozy|tired|excited|melancholy|confident|lonely|grateful 중 하나"
}`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 200,
            responseMimeType: 'application/json',
          },
        }),
      }
    )
    if (!res.ok) {
      console.error('[feed-gen] Gemini error:', res.status, await res.text())
      return null
    }
    const data: any = await res.json()
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed.text || !parsed.emotion) return null
    return { text: parsed.text, emotion: parsed.emotion }
  } catch (e) {
    console.error('[feed-gen] generate error:', e)
    return null
  }
}

// ─── 오늘 생성된 피드 수 조회 ────────────────────────────────
async function getTodayPostCount(db: D1Database, characterId: string): Promise<number> {
  const row = await db.prepare(
    `SELECT COUNT(*) as cnt FROM feed_posts
     WHERE character_id = ?
       AND generation_method = 'ai_auto'
       AND date(published_at) = date('now')`
  ).bind(characterId).first<{ cnt: number }>()
  return row?.cnt ?? 0
}

// ─── 피드 포스트 삽입 ────────────────────────────────────────
async function insertFeedPost(db: D1Database, params: {
  characterId: string
  type: 'text' | 'photo' | 'emotion'
  textContent: string | null
  imageUrl: string | null
  emotion: string | null
  prompt: string
}): Promise<string> {
  const id = crypto.randomUUID()
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  await db.prepare(
    `INSERT INTO feed_posts
       (id, character_id, type, text_content, image_url, emotion,
        published_at, generation_method, generation_prompt)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'ai_auto', ?)`
  ).bind(
    id, params.characterId, params.type,
    params.textContent, params.imageUrl, params.emotion,
    now, params.prompt
  ).run()
  return id
}

// ─── 단일 캐릭터 피드 생성 ───────────────────────────────────
async function generateCharacterFeed(
  db: D1Database,
  characterId: string,
  timeSlot: FeedTimeSlot,
  apiKey: string
): Promise<boolean> {
  // 오늘 이미 3개 이상이면 스킵
  const count = await getTodayPostCount(db, characterId)
  if (count >= 3) {
    console.log(`[feed-gen] ${characterId}: 오늘 이미 ${count}개 생성됨, 스킵`)
    return false
  }

  // 70% 확률로 이번 슬롯에 포스트 생성 (하루 3슬롯 × 5캐릭터 중 분산)
  const shouldGenerate = Math.random() < 0.7
  if (!shouldGenerate) {
    console.log(`[feed-gen] ${characterId}: 이번 슬롯 스킵 (랜덤)`)
    return false
  }

  const char = CHARACTERS[characterId]
  if (!char) return false

  // 20% 확률로 사진 포스트, 나머지는 텍스트/감정 포스트
  const isPhoto = Math.random() < 0.2

  if (isPhoto) {
    const imageUrl = char.imagePool[Math.floor(Math.random() * char.imagePool.length)]
    const generated = await generateFeedText(characterId, timeSlot, apiKey)
    const caption = generated?.text ?? null

    await insertFeedPost(db, {
      characterId,
      type: 'photo',
      textContent: caption,
      imageUrl,
      emotion: generated?.emotion ?? null,
      prompt: `photo post / ${timeSlot}`,
    })
    console.log(`[feed-gen] ${characterId}: 사진 포스트 생성`)
  } else {
    const generated = await generateFeedText(characterId, timeSlot, apiKey)
    if (!generated) {
      console.error(`[feed-gen] ${characterId}: 텍스트 생성 실패`)
      return false
    }

    await insertFeedPost(db, {
      characterId,
      type: 'emotion',
      textContent: generated.text,
      imageUrl: null,
      emotion: generated.emotion,
      prompt: `emotion post / ${timeSlot}`,
    })
    console.log(`[feed-gen] ${characterId}: 감정 포스트 생성 "${generated.text.slice(0, 30)}..."`)
  }

  return true
}

// ─── 전체 캐릭터 피드 생성 ───────────────────────────────────
export async function runFeedGeneration(
  db: D1Database,
  timeSlot: FeedTimeSlot,
  apiKey: string,
  targetCharacterId?: string
): Promise<{ generated: number; skipped: number }> {
  console.log(`[feed-gen] 시작: slot=${timeSlot}`)

  const characterIds = targetCharacterId
    ? [targetCharacterId]
    : Object.keys(CHARACTERS)

  let generated = 0
  let skipped = 0

  for (const characterId of characterIds) {
    try {
      const ok = await generateCharacterFeed(db, characterId, timeSlot, apiKey)
      if (ok) generated++
      else skipped++
    } catch (e) {
      console.error(`[feed-gen] ${characterId} 오류:`, e)
      skipped++
    }
  }

  console.log(`[feed-gen] 완료: 생성=${generated} 스킵=${skipped}`)
  return { generated, skipped }
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

// ─── 푸시 알림 발송 ──────────────────────────────────────────
const PERSONA_NAMES: Record<string, string> = {
  minji: '민지', jiwoo: '지우', hayoung: '하영', eunbi: '은비', dahee: '다희',
}

async function runPushNotification(
  db: D1Database,
  timeSlot: PushTimeSlot,
  env: Env
): Promise<void> {
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
    console.error('[push] target query error:', e)
    return
  }

  console.log(`[push] slot=${timeSlot} targets=${targets.length}`)
  if (targets.length === 0) return

  for (const target of targets) {
    const { user_id, persona_id, token } = target

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
      console.error('[push] msg select error:', e)
      continue
    }

    if (!msgRow) continue

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
      try {
        await db.prepare(
          `INSERT INTO push_logs (user_id, persona_id, time_slot, message_id)
           VALUES (?, ?, ?, ?)`
        ).bind(user_id, persona_id, timeSlot, msgRow.id).run()
      } catch (e) {
        console.error('[push] push_logs insert error:', e)
      }
    }
  }
}

// ─── 메인 Scheduled 핸들러 ──────────────────────────────────
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const db = env.DB
    if (!db) return

    const utcHour = new Date(event.scheduledTime).getUTCHours()
    const now = new Date(event.scheduledTime).toISOString()
    console.log(`[lovia-cron] fired utcHour=${utcHour} time=${now}`)

    // 피드 생성 슬롯 처리
    const feedSlot = getFeedTimeSlot(utcHour)
    if (feedSlot && env.GEMINI_API_KEY) {
      ctx.waitUntil(runFeedGeneration(db, feedSlot, env.GEMINI_API_KEY))
    }

    // 푸시 알림 슬롯 처리
    const pushSlot = getPushTimeSlot(utcHour)
    if (pushSlot && env.FIREBASE_SERVICE_ACCOUNT && env.FIREBASE_PROJECT_ID) {
      ctx.waitUntil(runPushNotification(db, pushSlot, env))
    }

    console.log(`[lovia-cron] 완료 feedSlot=${feedSlot} pushSlot=${pushSlot}`)
  },
}
