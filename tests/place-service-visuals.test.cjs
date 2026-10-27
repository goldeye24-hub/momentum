const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'services/place-seo/index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'services/distinct-visuals.css'), 'utf8');

test('the two original generated screenshots are real locally hosted image files', () => {
  const images = [
    ['place-search-reference.webp', '960', '1200'],
    ['place-detail-reference.webp', '760', '1605'],
  ];
  for (const [name, w, h] of images) {
    const local = path.join(root, 'assets/place', name);
    const bytes = fs.readFileSync(local);
    assert.ok(bytes.length > 20000, name + ' cannot be placeholder');
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    assert.match(html, new RegExp('<img[^>]+src="/assets/place/' + name.replace(/\./g, '\\.') + '"[^>]+width="' + w + '"[^>]+height="' + h + '"'));
  }
});

test('exactly two image cards occupy the existing place service section', () => {
  assert.equal((html.match(/id="visual-overview"/g) || []).length, 1);
  assert.equal((html.match(/class="place-shot-card"/g) || []).length, 2);
  assert.match(html, /플레이스 SEO 최적화/);
  assert.match(html, /플레이스 점검·보완 및 수정/);
  assert.doesNotMatch(html, /class="place-demo-screen"/);
  assert.doesNotMatch(html, /class="place-audit-screen"/);
});

test('screen mockups remain clearly disclosed as fictional examples', () => {
  assert.match(html, /서비스 설명을 위한 가상 예시/);
  assert.match(html, /실제 네이버·구글 검색화면이나 운영 성과가 아니며/);
  assert.equal((html.match(/href="#inquiry">(?:SEO 최적화|점검·보완) 상담하기/g)||[]).length, 2);
  assert.match(html, /id="inquiry"/);
});

test('mobile stacks the two images and preserves full image on small screens', () => {
  assert.match(css, /\.place-shot-grid\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  const mobile = css.split('@media(max-width:780px)')[1] || '';
  assert.match(mobile, /\.place-shot-grid\{grid-template-columns:1fr/);
  assert.match(mobile, /\.place-shot-frame img,[^\{]+\{height:auto;max-height:none;width:100%/);
});
