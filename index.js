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

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const cookieDomain = '.itch.io';
const indexURL = 'https://itch.io/login';
const gameURL = 'https://geeseki.itch.io/sugar-service';

const browser = await puppeteer.launch();
const page = await browser.newPage();

const cookiesFile = 'cookies.json';
if (!fs.existsSync(cookiesFile)) {
  await page.goto(indexURL, { waitUntil: 'networkidle2' });

  console.debug('Screenshotting login page...');
  await page.screenshot({ path: 'login-page.png', fullPage: true });

  const inputsDiv = '.login_form_widget';
  const usernameInput = `${inputsDiv} input[name="username"]`;
  const passwordInput = `${inputsDiv} input[name="password"]`;

  console.debug('Filling in login form...');
  await page.type(usernameInput, process.env.ITCHIO_USERNAME, { delay: 50 });
  await page.type(passwordInput, process.env.ITCHIO_PASSWORD, { delay: 50 });

  console.debug('Screenshotting filled login form...');
  await page.screenshot({ path: 'filled-login-form.png', fullPage: true });

  console.debug('Submitting login form...');
  await page.click('.buttons .button');
  console.debug('Waiting for navigation after login...');

  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  console.debug('Navigation after login complete, screenshotting...');
  await page.screenshot({ path: 'after-login.png', fullPage: true });
  console.debug('Navigating to game page...');

  const cookieFilter = cookie => cookie.domain === cookieDomain;
  const cookies = await browser.cookies().then(cookies => cookies.filter(cookieFilter));
  console.debug('Cookies after login:', cookies);
  fs.writeFileSync('cookies.json', JSON.stringify(cookies, null, 2));
  console.debug('Cookies saved to cookies.json');
} else {
  const cookies = JSON.parse(fs.readFileSync(cookiesFile));
  console.debug('Cookies loaded from cookies.json:', cookies);
  await browser.setCookie(...cookies);
}

await page.goto(gameURL, { waitUntil: 'networkidle2' });
console.debug('Game page loaded, waiting for content warning...');

const moreInfoSelector = '.toggle_info_btn';
await page.click(moreInfoSelector);
console.debug('More info button clicked, waiting for content warning...');

await sleep(2000); // Wait for the content warning to appear

console.debug('Taking screenshot of game page...');
await page.screenshot({ path: 'game-page.png', fullPage: true });
console.debug('Game page screenshot taken, extracting content warning...');

const html = await page.content();

if (false) { // If you want to log out after taking the screenshot
  const userMenuBtn = '.drop_menu_wrap';
  console.debug('Clicking user menu button...');
  await page.click(userMenuBtn);
  console.debug('Waiting for user menu to appear...');

  await page.waitForSelector('.drop_menu', { visible: true });
  console.debug('User menu is visible, taking screenshot...');

  console.debug('Logging out...');
  await page.click('.drop_menu a[data-label="log_out"]');
  await sleep(2000);
  await page.goto(gameURL, { waitUntil: 'networkidle2' });

  console.debug('Game page reloaded after logout, taking final screenshot...');
  await page.screenshot({ path: 'final-game-page.png', fullPage: true });
  console.debug('Extracting game information from the page...');
}
await browser.close();

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
process.exit(0);