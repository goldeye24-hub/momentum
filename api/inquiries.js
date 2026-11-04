import { createHash } from 'node:crypto';

const RECIPIENT = 'notrack@naver.com';
const MAX_BYTES = 12_000;

const clean = (value, max = 200) => String(value ?? '')
  .replace(/[\u0000-\u001f\u007f]/g, ' ')
  .replace(/\s+/g, ' ').trim().slice(0, max);
const yes = (v) => v === true || v === 'true' || v === 'on';
const response = (res, status, data) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(data);
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return response(res, 405, { error: 'POST 요청만 가능합니다.' });
  const origin = req.headers?.origin;
  const host = req.headers?.host;
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return response(res, 403, { error: '허용되지 않은 요청입니다.' });
    } catch { return response(res, 403, { error: '허용되지 않은 요청입니다.' }); }
  }

  let data;
  try {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
    if (Buffer.byteLength(raw, 'utf8') > MAX_BYTES) return response(res, 413, { error: '입력 내용이 너무 깁니다.' });
    data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error('invalid');
  } catch { return response(res, 400, { error: '입력 형식을 확인해 주세요.' }); }
  if (clean(data.website, 50)) return response(res, 400, { error: '자동 제출이 감지되었습니다.' });
  if (!yes(data.agree)) return response(res, 400, { error: '개인정보 수집·이용 동의가 필요합니다.' });

  const shop = clean(data.shop, 120);
  const name = clean(data.name, 60);
  const phone = clean(data.phone, 22);
  const stage = clean(data.businessStage, 100);
  const purpose = clean(data.marketingGoal, 200);
  const message = String(data.message ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, 1200);
  const region = clean(data.region, 100);
  const product = clean(data.productTitle, 120);
  const contact = clean(data.contact, 30);
  const budget = clean(data.budget, 35);
  if (!shop || !name || !/^[0-9+()\-\s]{9,22}$/.test(phone) || !stage) {
    return response(res, 400, { error: '업체명·담당자·연락처·사업 단계를 확인해 주세요.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MOMENTUM_MAIL_FROM;
  if (!apiKey || !from) {
    console.error('Inquiry mail config missing; no email was sent');
    return response(res, 503, { error: '현재 메일 접수가 준비 중입니다. 잠시 후 다시 시도해 주세요.' });
  }

  const lines = [
    '모멘텀마케팅 홈페이지 상담 신청', '',
    `업체명: ${shop}`, `담당자: ${name}`, `연락처: ${phone}`,
    `사업 단계: ${stage}`, `주요 고민: ${purpose || '미선택'}`,
    `관심 상품: ${product || '전체 상담'}`, `예상 예산: ${budget ? budget + ' 원' : '미기재'}`,
    `지역: ${region || '미기재'}`, `상담 방식: ${contact || '전화'}`,
    '추가 요청사항:', message || '(없음)', '',
    '※ 고객이 상담 연락을 위한 개인정보 수집·이용에 동의하여 제출한 내용입니다.',
  ];
  const idempotency = createHash('sha256')
    .update(JSON.stringify({ shop, name, phone, stage, purpose, message, budget }) + new Date().toISOString().slice(0, 13))
    .digest('hex');
  try {
    const mailResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotency,
      },
      body: JSON.stringify({
        from,
        to: [RECIPIENT],
        subject: `[모멘텀 상담] ${shop} · ${name}`,
        text: lines.join('\n'),
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!mailResp.ok) {
      const body = await mailResp.text();
      console.error('Email provider rejected submission:', mailResp.status, body.slice(0, 250));
      return response(res, 502, { error: '문의 전달이 완료되지 않았습니다. 다시 시도해 주세요.' });
    }
    return response(res, 200, { success: true, message: '상담 문의가 접수되었습니다. 담당자가 확인 후 연락드리겠습니다.' });
  } catch (err) {
    console.error('Email provider transport failed:', String(err).slice(0, 120));
    return response(res, 502, { error: '문의 전달 여부를 확인하지 못했습니다. 중복 제출 전에 담당자에게 확인해 주세요.' });
  }
}