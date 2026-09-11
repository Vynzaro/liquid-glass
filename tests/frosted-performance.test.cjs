const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const extensionDir = path.join(root, 'liquid-glass@thinkingcoding1231.gmail.com');

function read(relativePath) {
  return fs.readFileSync(path.join(extensionDir, relativePath), 'utf8');
}

test('Frosted preferences, schema and shader uniforms stay in sync', () => {
  const schema = read('schemas/org.gnome.shell.extensions.liquid-glass@thinkingcoding1231.gmail.com.gschema.xml');
  const prefs = read('prefs.js');
  const shader = read('shaders/glass.frag');
  const effect = read('src/liquidEffect.ts');

  for (const [key, uniform] of [
    ['material-mode', 'material_mode'],
    ['frosted-strength', 'frosted_strength'],
    ['frosted-grain', 'frosted_grain'],
  ]) {
    assert.match(schema, new RegExp(`<key name="${key}"`));
    assert.match(prefs, new RegExp(`['"]${key}['"]`));
    assert.match(shader, new RegExp(`uniform float ${uniform};`));
    assert.match(effect, new RegExp(`['"]${uniform}['"]`));
  }

  assert.match(prefs, /Liquid Glass/);
  assert.match(prefs, /Frosted Glass \(Performance\)/);
  assert.match(prefs, /Hybrid Glass/);
});

test('Frosted composite path performs one blurred-background lookup', () => {
  const shader = read('shaders/glass.frag');
  const match = shader.match(/if \(isFrosted\) \{([\s\S]*?)\n\s*\} else \{/);

  assert.ok(match, 'Frosted shader branch was not found');
  const textureReads = match[1].match(/texture2D\(cogl_sampler1/g) ?? [];
  assert.equal(textureReads.length, 1);
  assert.doesNotMatch(match[1], /getDisplacement|chroma_strength|heightGradient/);
});

test('Composite uniforms are not re-uploaded wholesale during every paint', () => {
  const effect = read('src/liquidEffect.ts');
  const start = effect.indexOf('\n  vfunc_paint_target(');
  const end = effect.indexOf('\n  /**', start);

  assert.notEqual(start, -1, 'paint method was not found');
  assert.notEqual(end, -1, 'paint method boundary was not found');
  assert.doesNotMatch(effect.slice(start, end), /this\._applyPendingUniforms\(\)/);
  assert.match(effect, /const _shaderSourceCache = new Map/);
  assert.match(effect, /_pipelineTextureBindings/);
  assert.equal((effect.match(/\.set_layer_texture\(/g) ?? []).length, 1,
    'all texture bindings should pass through the state cache');
  assert.match(effect, /this\._setFloat\('fast_mode', 0\.0\)/);
});

test('Clean installs use only declared, available development dependencies', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = read('package-lock.json');

  assert.equal(pkg.dependencies, undefined);
  assert.deepEqual(Object.keys(pkg.devDependencies).sort(), [
    '@girs/gnome-shell',
    'typescript',
  ]);
  assert.doesNotMatch(lock, /@gtile\/gjs/);
  assert.equal(pkg.scripts.verify, 'npm run build && npm test');
});
