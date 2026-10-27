const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../services/place-seo/index.html'), 'utf8');

test('place illustrations are original screenshots rather than fake HTML portal replicas', () => {
  assert.match(html, /\/assets\/place\/place-search-reference\.webp/);
  assert.match(html, /\/assets\/place\/place-detail-reference\.webp/);
  assert.doesNotMatch(html, /class="dv-live-map"/);
  assert.doesNotMatch(html, /class="dv-map"/);
  assert.doesNotMatch(html, /class="place-map-pin"/);
  assert.doesNotMatch(html, /class="place-audit-mobile"/);
  assert.match(html, /가상 예시/);
});
