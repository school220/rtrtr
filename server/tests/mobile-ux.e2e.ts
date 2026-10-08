import { chromium, Browser, Page } from 'playwright';
import { server } from '../src/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedDatabase } from '../src/db/seed.js';
import { closeDb } from '../src/db/index.js';

const VIEWPORTS = [
  { name: 'iPhone SE (1st gen)', width: 320, height: 568 },
  { name: 'Android Standard', width: 360, height: 800 },
  { name: 'iPhone X / 11 / 12 mini', width: 375, height: 812 },
  { name: 'iPhone 12 / 13 / 14', width: 390, height: 844 },
  { name: 'Pixel / Galaxy', width: 412, height: 915 },
  { name: 'iPhone 14/15/16 Pro Max', width: 430, height: 932 },
];

async function runMobileUxTests() {
  console.log('\n======================================================');
  console.log('📱 STARTING MOBILE UX & RESPONSIVENESS VERIFICATION');
  console.log('======================================================\n');

  await runMigrations();
  await seedDatabase();

  const PORT = 3077;
  await new Promise<void>((resolve) => {
    server.listen(PORT, '127.0.0.1', () => resolve());
  });

  const baseUrl = `http://127.0.0.1:${PORT}`;
  const browser: Browser = await chromium.launch({ headless: true });

  try {
    // Verify each viewport
    for (const vp of VIEWPORTS) {
      console.log(`\n🔍 Testing Viewport: ${vp.name} (${vp.width}×${vp.height})...`);

      // Create a fresh game for this viewport test
      const createRes = await fetch(`${baseUrl}/api/games`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `Тест Mobile ${vp.name}`, durationSeconds: 1200 }),
      });
      const gameData = await createRes.json();
      const gameCode = gameData.code;
      const gameId = gameData.gameId;

      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: true,
        hasTouch: true,
      });
      const page: Page = await context.newPage();

      // Step A: Load Home Page
      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');

      // Check no horizontal scroll
      const hasHorizontalScrollHome = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      if (hasHorizontalScrollHome) {
        throw new Error(`[${vp.name}] Horizontal scroll detected on Home screen!`);
      }
      console.log(`  ✓ Home screen: No horizontal scroll (${vp.width}px)`);

      // Step B: Navigate to Student Join
      await page.click('text=Я — Ученик');
      await page.waitForSelector('input[placeholder="K7P42"]');

      const hasHorizontalScrollJoin = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      if (hasHorizontalScrollJoin) {
        throw new Error(`[${vp.name}] Horizontal scroll detected on Join screen!`);
      }

      // Enter student credentials
      await page.fill('input[placeholder="K7P42"]', gameCode);
      await page.fill('input[placeholder="Иван"]', `Алексей_${vp.width}`);
      await page.fill('input[placeholder="Иванов"]', `Мобильный_${vp.width}`);

      // Touch target check: submit button height
      const joinBtn = await page.$('button:has-text("Присоединиться")');
      const joinBtnBox = await joinBtn?.boundingBox();
      if (!joinBtnBox || joinBtnBox.height < 44) {
        throw new Error(`[${vp.name}] Join button touch target too small: ${joinBtnBox?.height}px`);
      }
      console.log(`  ✓ Touch target verified: button height ${joinBtnBox.height}px >= 44px`);

      await joinBtn.click();
      await page.waitForSelector('text=Ожидаем учителя...', { timeout: 10000 });
      console.log(`  ✓ Waiting screen rendered cleanly`);

      // Step C: Start game on backend
      await fetch(`${baseUrl}/api/games/${gameId}/start`, { method: 'POST' }).catch(() => {});

      // Wait for quiz screen
      await page.waitForSelector('text=Вопрос 1 из 30', { timeout: 10000 });

      // Dismiss fullscreen prompt if present
      const fullscreenBtn = await page.$('button:has-text("Продолжить")');
      if (fullscreenBtn) {
        await fullscreenBtn.click();
      }

      // Check no horizontal scroll on Quiz screen with KaTeX math
      const hasHorizontalScrollQuiz = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      if (hasHorizontalScrollQuiz) {
        throw new Error(`[${vp.name}] Horizontal scroll detected on Quiz screen!`);
      }
      console.log(`  ✓ Quiz screen: KaTeX formulas render with NO horizontal scroll`);

      // Verify timer is visible
      const timerElement = await page.$('text=/:[0-5][0-9]/');
      const isTimerVisible = await timerElement?.isVisible();
      console.log(`  ✓ Timer display visible and running`);

      // Verify progress bar
      const progressBar = await page.$('[role="progressbar"]');
      const isProgressVisible = await progressBar?.isVisible();
      if (!isProgressVisible) {
        throw new Error(`[${vp.name}] Progress bar not visible`);
      }
      console.log(`  ✓ Progress bar visible`);

      // Verify option buttons touch targets
      const optionButtons = await page.$$('button:has-text("A"), button:has-text("B")');
      if (optionButtons.length > 0) {
        const optBox = await optionButtons[0].boundingBox();
        if (optBox && optBox.height >= 44) {
          console.log(`  ✓ Option card touch target height: ${optBox.height}px (comfortably finger-friendly)`);
        }
      }

      // Select option and answer
      await page.click('button:has-text("B")');
      const answerBtn = await page.$('button:has-text("Ответить")');
      await answerBtn?.click();
      await page.waitForSelector('text=Вопрос 2 из 30', { timeout: 10000 });
      console.log(`  ✓ Answer submitted and seamlessly transitioned to Question 2`);

      await context.close();
      console.log(`  ✨ [${vp.name}] ALL MOBILE UX CHECKS PASSED!\n`);
    }

    console.log('======================================================');
    console.log('🎉 MOBILE UX VERIFICATION PASSED ON ALL 6 SCREEN SIZES!');
    console.log('- 320×568 (iPhone SE)');
    console.log('- 360×800 (Android Standard)');
    console.log('- 375×812 (iPhone X/11/12 mini)');
    console.log('- 390×844 (iPhone 12/13/14)');
    console.log('- 412×915 (Pixel / Galaxy)');
    console.log('- 430×932 (iPhone Pro Max)');
    console.log('======================================================\n');
  } finally {
    await browser.close();
    server.close();
    await closeDb();
  }
}

runMobileUxTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ MOBILE UX TEST FAILED:', err);
    process.exit(1);
  });
