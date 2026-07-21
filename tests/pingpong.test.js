const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('src/activities/pingpong.html', 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
const scriptContent = scriptMatch[1];

function extractFunction(code, funcName) {
  const start = code.indexOf(`function ${funcName}(`);
  if (start === -1) return '';
  let braces = 0;
  let i = start;
  let foundFirstBrace = false;
  while (i < code.length) {
    if (code[i] === '{') {
      braces++;
      foundFirstBrace = true;
    }
    if (code[i] === '}') {
      braces--;
      if (foundFirstBrace && braces === 0) {
        return code.substring(start, i + 1);
      }
    }
    i++;
  }
  return '';
}

const clampCode = extractFunction(scriptContent, 'clamp');
const checkCollisionCode = extractFunction(scriptContent, 'checkCollision');

describe('Pingpong Activity - checkCollision', () => {
  let context;

  beforeEach(() => {
    context = {
      Math: Object.create(Math),
      console: console
    };

    // Make Math.random deterministic
    context.Math.random = () => 0.5;

    vm.createContext(context);

    // Set up environment with needed constants, variables, and mock functions
    vm.runInContext(`
      var PADDLE_W = 14, PADDLE_H = 90, BALL_R = 9, SPD_INC = 0.24, MAX_SPD = 10.0;
      var ball = { x: 0, y: 0, dx: 0, dy: 0, spd: 5 };
      var spawnParticles = function(){};
      var spawnFlash = function(){};
      var PhonicsAudio = { playClick: function(){} };

      ${clampCode}
      ${checkCollisionCode}
    `, context);
  });

  test('should return early and set touching to false if moving away from paddle (left paddle)', () => {
    vm.runInContext(`
      ball.dx = 1; // Moving right, away from left paddle (needs to hit left side to bounce right)
      ball.x = 20;
      ball.y = 50;
      var pd = { x: 10, y: 10, touching: true, solid: true, color: '#f00' };
      checkCollision(pd, true);
    `, context);

    assert.strictEqual(vm.runInContext('pd.touching', context), false);
    assert.strictEqual(vm.runInContext('ball.dx', context), 1);
  });

  test('should return early and set touching to false if moving away from paddle (right paddle)', () => {
    vm.runInContext(`
      ball.dx = -1; // Moving left, away from right paddle
      ball.x = 80;
      ball.y = 50;
      var pd = { x: 100, y: 10, touching: true, solid: true, color: '#f00' };
      checkCollision(pd, false);
    `, context);

    assert.strictEqual(vm.runInContext('pd.touching', context), false);
    assert.strictEqual(vm.runInContext('ball.dx', context), -1);
  });

  test('should return early and set touching to false if ball is too far away', () => {
    vm.runInContext(`
      ball.dx = -1; // Moving towards left paddle
      ball.x = 100; // Far from paddle
      ball.y = 50;
      var pd = { x: 10, y: 10, touching: true, solid: true, color: '#f00' };
      checkCollision(pd, true);
    `, context);

    assert.strictEqual(vm.runInContext('pd.touching', context), false);
  });

  test('should return early if already touching', () => {
    vm.runInContext(`
      ball.dx = -1; // Moving towards left paddle
      ball.x = 20; // Close to paddle
      ball.y = 50; // Aligned with paddle
      var pd = { x: 10, y: 10, touching: true, solid: true, color: '#f00' };

      // Override dx to something that wouldn't normally get filtered by the direction check
      checkCollision(pd, true);
    `, context);

    // The ball's dx should remain -1 because checkCollision returns early
    assert.strictEqual(vm.runInContext('ball.dx', context), -1);
  });

  test('should collide, calculate new angle, increase speed, and set pd.solid to false', () => {
    vm.runInContext(`
      ball.dx = -1; // Moving towards left paddle
      ball.spd = 5;
      ball.x = 20; // Very close to right side of left paddle (x=10, width=14 -> right side=24)
      ball.y = 55; // Middle of paddle (y=10, height=90 -> middle=55)
      var pd = { x: 10, y: 10, touching: false, solid: true, color: '#f00' };

      checkCollision(pd, true);
    `, context);

    assert.strictEqual(vm.runInContext('pd.touching', context), true);
    assert.strictEqual(vm.runInContext('pd.solid', context), false);
    assert.strictEqual(vm.runInContext('pd.glow', context), 35);

    const newSpd = vm.runInContext('ball.spd', context);
    assert.strictEqual(newSpd, 5 + 0.24); // spd + SPD_INC

    const newDx = vm.runInContext('ball.dx', context);
    assert.ok(newDx > 0); // Should bounce back to the right
  });

  test('should cap speed at MAX_SPD', () => {
    vm.runInContext(`
      ball.dx = -1; // Moving towards left paddle
      ball.spd = 9.9;
      ball.x = 20;
      ball.y = 55;
      var pd = { x: 10, y: 10, touching: false, solid: true, color: '#f00' };

      checkCollision(pd, true);
    `, context);

    const newSpd = vm.runInContext('ball.spd', context);
    assert.strictEqual(newSpd, 10.0); // MAX_SPD
  });

  test('should bounce back towards left if hitting right paddle', () => {
    vm.runInContext(`
      ball.dx = 1; // Moving towards right paddle
      ball.spd = 5;
      ball.x = 92; // Very close to left side of right paddle (x=100)
      ball.y = 55; // Middle of paddle
      var pd = { x: 100, y: 10, touching: false, solid: true, color: '#f00' };

      checkCollision(pd, false);
    `, context);

    const newDx = vm.runInContext('ball.dx', context);
    assert.ok(newDx < 0); // Should bounce back to the left
  });

  test('should enforce minimum vertical velocity to prevent horizontal line lock', () => {
    // Math.random returns 0.5, so randomDeflect is (0.5 * 0.8 - 0.4) = 0
    // To make angle nearly 0, we need rel to be nearly 0, which means ball hits exact center
    vm.runInContext(`
      ball.dx = -1;
      ball.spd = 5;
      ball.x = 20;
      ball.y = 55; // Exact center of paddle (y=10, H=90, center=55)
      var pd = { x: 10, y: 10, touching: false, solid: true, color: '#f00' };

      checkCollision(pd, true);
    `, context);

    const newDy = vm.runInContext('ball.dy', context);
    // Since angle was 0, it should be adjusted to 0.2
    // dy = spd * sin(0.2)
    const expectedDy = 5.24 * Math.sin(0.2); // newSpd * sin(0.2)
    assert.ok(Math.abs(newDy - expectedDy) < 0.001);
  });

  test('should pass through if paddle is not solid (ghost paddle)', () => {
    vm.runInContext(`
      ball.dx = -1;
      ball.x = 20;
      ball.y = 55;
      var pd = { x: 10, y: 10, touching: false, solid: false, color: '#f00' };

      checkCollision(pd, true);
    `, context);

    assert.strictEqual(vm.runInContext('pd.touching', context), true);
    // It should just return, so dx remains -1
    assert.strictEqual(vm.runInContext('ball.dx', context), -1);
  });
});
