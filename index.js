import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

{ // debug
  const fileFilter = file => file.endsWith('.png') || file.endsWith('.html');
  fs.readdirSync('.')
    .filter(fileFilter)
    .forEach(file => fs.unlinkSync(file));
}

var processArgs = process.argv.slice(2);
const isAllowScreenshot = processArgs.includes('--screenshots') || process.env.ALLOW_SCREENSHOT === 'true';
const isDebug = processArgs.includes('--debug') || process.env.DEBUG === 'true';
const isLogoutAfterExtract = processArgs.includes('--logout');

// Debugging utility
const screenshot = (page, path) => isAllowScreenshot && page.screenshot({ path, fullPage: true });
const debug = (...args) => isDebug && console.debug(...args);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const cookieDomain = '.itch.io';
const indexURL = 'https://itch.io/login';
const gameURL = 'https://geeseki.itch.io/sugar-service';

const browser = await puppeteer.launch();
const page = await browser.newPage();

const cookiesFile = 'cookies.json';
if (!fs.existsSync(cookiesFile)) {
  console.log('No cookies found, logging in...');
  if (!process.env.ITCHIO_USERNAME || !process.env.ITCHIO_PASSWORD) {
    console.error('Please set ITCHIO_USERNAME and ITCHIO_PASSWORD environment variables.');
    process.exit(1);
  }

  await page.goto(indexURL, { waitUntil: 'networkidle2' });

  debug('Screenshotting login page...');
  await screenshot(page, 'login-page.png');

  const inputsDiv = '.login_form_widget';
  const usernameInput = `${inputsDiv} input[name="username"]`;
  const passwordInput = `${inputsDiv} input[name="password"]`;

  debug('Filling in login form...');
  await page.type(usernameInput, process.env.ITCHIO_USERNAME, { delay: 50 });
  await page.type(passwordInput, process.env.ITCHIO_PASSWORD, { delay: 50 });

  debug('Screenshotting filled login form...');
  await screenshot(page, 'filled-login-form.png');

  debug('Submitting login form...');
  await page.click('.buttons .button');
  debug('Waiting for navigation after login...');

  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  debug('Navigation after login complete, screenshotting...');
  await screenshot(page, 'after-login.png');
  debug('Navigating to game page...');

  const cookieFilter = cookie => cookie.domain === cookieDomain;
  const cookies = await browser.cookies().then(cookies => cookies.filter(cookieFilter));
  debug('Cookies obtained, saving to cookies.json...');
  fs.writeFileSync('cookies.json', JSON.stringify(cookies, null, 2));
  debug('Cookies saved to cookies.json');
  console.log('Login successful!');
} else {
  const cookies = JSON.parse(fs.readFileSync(cookiesFile));
  debug('Cookies loaded from cookies.json.');
  await browser.setCookie(...cookies);
}

console.info('Opening game page...');
await page.goto(gameURL, { waitUntil: 'networkidle2' });
console.log('Game page loaded.');

const moreInfoSelector = '.toggle_info_btn';
await page.click(moreInfoSelector);
debug('More info button clicked.');

await sleep(1000);

debug('Taking screenshot of game page...');
await screenshot(page, 'game-page.png');
debug('Game page screenshot taken...');

const html = await page.content();
if (isLogoutAfterExtract) {
  const userMenuBtn = '.drop_menu_wrap';
  debug('Clicking user menu button...');
  await page.click(userMenuBtn);
  debug('Waiting for user menu to appear...');

  await page.waitForSelector('.drop_menu', { visible: true });
  debug('User menu is visible, taking screenshot...');

  debug('Logging out...');
  await page.click('.drop_menu a[data-label="log_out"]');
  await sleep(2000);
  await page.goto(gameURL, { waitUntil: 'networkidle2' });

  debug('Game page reloaded after logout, taking final screenshot...');
  await screenshot(page, 'final-game-page.png');
  debug('Final screenshot taken, logging out complete.');
}

await browser.close();

console.log('Extracting game information from the page...');
const $ = cheerio.load(html);
const rows = $('.game_info_panel_widget.base_widget table tr');
const table = {};

rows.each((i, el) => {
  const key = $(el).find('td').first().text().trim();
  const abbr = $(el).find('abbr').attr('title')?.trim();
  const value = $(el).find('td').last().text().trim();

  if (key === 'Updated' || key === 'Released')
    table[key] = `${abbr} (${value})`;
  else
    table[key] = `${value}`;
});

console.log(table);
console.log('Game information extracted successfully!');
process.exit(0);