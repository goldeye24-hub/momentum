const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../services/place-seo/index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../services/distinct-visuals.css'), 'utf8');

test('place page shows an actual Google Maps iframe with native attribution retained', () => {
  assert.match(html, /<iframe[^>]+src="https:\/\/maps\.google\.com\/maps\?[^"]+output=embed"/);
  assert.match(html, /class="dv-live-map"/);
  assert.match(css, /\.dv-live-map iframe\s*\{/);
  assert.doesNotMatch(css, /\.dv-live-map iframe\s*\{[^}]*display\s*:\s*none/);
});
test('place guide links to real services, never invented search rankings or fake maps', () => {
  assert.match(html, /https:\/\/map\.naver\.com\/p\/search\//);
  assert.match(html, /https:\/\/www\.google\.com\/maps\/search\//);
  assert.doesNotMatch(html, /class="dv-map"/);
  assert.doesNotMatch(html, /class="dv-searchbar"/);
  assert.doesNotMatch(html, /class="visual-navmark"/);
  assert.match(html, /검색결과는 지역·시점·이용자에 따라 달라집니다/);
});
