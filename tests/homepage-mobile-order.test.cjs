const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('marketing hero precedes website-production teaser on the homepage', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const hero = html.indexOf('<section class="top-grid"');
  const site = html.indexOf('<section class="web-home-teaser');
  assert.ok(hero > 0, 'marketing hero must exist');
  assert.ok(site > hero, 'website-production teaser must follow marketing hero');
  assert.equal((html.match(/<section class="top-grid"/g) || []).length, 1);
  assert.equal((html.match(/<section class="web-home-teaser/g) || []).length, 1);
});

test('the user-rejected local marketing footnote is not displayed', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.doesNotMatch(html, /class="hero-footnote"/);
});

test('mobile hero retains the flow layout fix', () => {
  const css = fs.readFileSync(path.join(__dirname, '../momentum-visual-home.css'), 'utf8');
  assert.match(css, /MOBILE HERO FLOW FIX 2026-10-27/);
  assert.match(css, /\.top-grid \.hero-perks\s*\{/);
  assert.match(css, /\.top-grid \.hero-media\s*\{/);
});
