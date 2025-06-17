import * as cheerio from 'cheerio';

//https://geeseki.itch.io/sugar-service
const url = 'https://geeseki.itch.io/sugar-service'; // URL страницы itch.io
const res = await fetch(url);
const html = await res.text();
const $ = cheerio.load(html);

// Находим таблицу
const $rows = $('.game_info_panel_widget.base_widget table tr');

// Выводим пары: ключ => значение
$rows.each((i, el) => {
  const key = $(el).find('td').first().text().trim();
  const abbr = $(el).find('abbr').attr('title')?.trim();
  console.log(`${key}: ${abbr || '—'}`);
});
