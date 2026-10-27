const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../services/place-seo/index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../services/distinct-visuals.css'), 'utf8');

test('one existing place showcase holds both requested marketing services', () => {
  assert.equal((html.match(/id="visual-overview"/g) || []).length, 1);
  assert.equal((html.match(/class="place-demo-card"/g) || []).length, 2);
  assert.match(html, /플레이스 SEO 최적화/);
  assert.match(html, /플레이스 점검·보완 및 수정/);
  assert.doesNotMatch(html, /class="dv-board--live-map"/);
  assert.doesNotMatch(html, /class="dv-photo"/);
});

test('screens are labeled as illustrative, links lead to existing consultation form', () => {
  assert.match(html, /가상 업체·메뉴·검색화면 예시/);
  assert.match(html, /검색 순위와 예약 증가를 보장하지 않습니다/);
  assert.equal((html.match(/href="#inquiry" aria-label="플레이스/g) || []).length, 2);
  assert.match(html, /id="inquiry"/);
});

test('service visuals stack responsively and source text remains legible', () => {
  assert.match(css, /\.place-pair\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:780px\)\{[^}]*\.place-pair\{grid-template-columns:1fr/);
  assert.match(css, /@media\(max-width:450px\)/);
});
