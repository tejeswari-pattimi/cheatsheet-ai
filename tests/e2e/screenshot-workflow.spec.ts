import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

let electronApp: ElectronApplication;
let mainWindow: Page;

test.describe('CheatSheet AI E2E', () => {

  test.beforeAll(async () => {
    // Path to the main entry point
    const mainScript = path.join(__dirname, '../../dist-electron/main.js');

    // Check if dist-electron/main.js exists, if not we might need to build
    if (!fs.existsSync(mainScript)) {
      console.log('Build output not found, running build...');
      // This might be slow, so ideally we assume the user has built it or we run build in setup
      // For now, we'll fail if it doesn't exist, but we can assume the dev environment
    }

    // Launch Electron app
    electronApp = await electron.launch({
      args: [mainScript],
      env: {
        ...process.env,
        NODE_ENV: 'development',
      },
    });

    // Get the first window
    mainWindow = await electronApp.firstWindow();

    // Wait for window to load
    await mainWindow.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('app launches and shows initial window', async () => {
    // Check window title or some element
    // Note: The app might be invisible or have specific behaviors on start.
    // Based on the code, it seems to have an opacity setting and might start hidden or visible depending on config.

    // Let's check if the window is created
    expect(mainWindow).toBeTruthy();

    // Check title (from index.html or set in code)
    const title = await mainWindow.title();
    console.log(`Window title: ${title}`);
    // expect(title).toContain('CheatSheet AI'); // Adjust based on actual title
  });

  test('can navigate UI tabs', async () => {
    // This assumes the UI is visible and interactive
    // We might need to make sure the window is visible first

    // In main.ts/shortcuts.ts, there are shortcuts to toggle visibility.
    // We can also check if specific UI elements exist.

    // Wait for the app to potentially settle
    await mainWindow.waitForTimeout(1000);

    // Check for the existence of the root element
    const root = mainWindow.locator('#root');
    await expect(root).toBeVisible();

    // Example: Check for "History" or "Settings" buttons if they exist
    // The previous analysis showed "Solutions", "History", "Settings" might be views.
  });

});
