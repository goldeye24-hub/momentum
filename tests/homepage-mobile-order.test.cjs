const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('marketing service descriptions and showcase precede website production on mobile and desktop', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const sections = [
    'top-grid',
    'service-strip',
    'analytics-row',
    'preview-section',
    'web-home-teaser',
    'bottom-content',
  ];
  const positions = sections.map(name => html.indexOf('<section class="' + name));
  for (let i = 0; i < sections.length; i++) {
    assert.ok(positions[i] >= 0, sections[i] + ' section must exist');
    if (i > 0) {
      assert.ok(positions[i] > positions[i - 1], sections[i] + ' must follow ' + sections[i - 1]);
    }
    assert.equal(html.split('<section class="' + sections[i]).length - 1, 1,
      sections[i] + ' must appear exactly once');
  }
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
