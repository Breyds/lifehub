# LifeHub 0.4.2

- Тонкі скролбари для Electron / Windows.
- Новинні реакції: негайне приховування, вкладка прихованих, повернення, персоналізованіший порядок на основі реакцій і ключових слів.
- Тематичні картки замість пустих фото, пагінація новин, музика вилучена з новинних категорій.
- Перевірка TikTok-посилань: відео через oEmbed, чесний статус для колекцій, без доступу до приватних списків.
- Spotify: пошук треку з чарта.

# LifeHub Changelog

## 0.4.1 — Calendar, News, Music & Update Repair

- **Calendar:** an uncompleted one-off all-day event appears only on its scheduled calendar date. Overdue tasks remain accessible in Today without creating phantom future calendar events. The fix covers Study calendar too.
- **News photos:** allow publisher-provided HTTPS thumbnails under Electron CSP; supplement Google News search with BBC publisher RSS for selected regions and technology. Some news stories still have no photo.
- **Music charts (beta):** separate live Apple Music top-song charts for US and regional markets (Kazakhstan, Ukraine; Russia when available); switch between current popularity and releases dated within the past 7 days. Source/ranking are displayed honestly. No OpenAI API cost for charts.
- **Music Friday:** trigger a refresh when the Friday reminder fires while LifeHub is open.
- **Updater:** if packaged `app-update.yml` is missing or not targeting `Breyds/lifehub`, fall back to configuring the public GitHub release feed directly. Show GitHub-specific errors rather than an ambiguous “not configured” status.
- Added regression tests for calendar dates, feed images, regional music data and CSP.

**Validation:** 27 Node module tests and syntax checks passed in the current environment; a full Electron/TypeScript build and actual Windows auto-update must still be verified in your GitHub Actions / installed app. Apple Music RSS live access cannot be verified in this offline environment.

# Історія LifeHub

## 0.4.0 — Personal Modules

- Завдання з кількісною ціллю, датованим прогресом і кольоровою важливістю.
- Події на цілий день, можливість редагувати і видаляти з календаря.
- Новий перегляд усіх справ по датах, кастомні підтвердження видалення.
- Проєкти з контрольними етапами, прогресом та нотатками.
- Домашній фітнес, профіль, доріжка, фото їжі з ручним підтвердженням AI-оцінок.
- CS2: журнал статистики й цілі, демоаналіз запланований на майбутнє.
- Календар стрімів із завершенням ефіру, календар навчання.
- RSS новини за регіонами, переклад заголовків UA/RU за запитом, фото за наявності в RSS.
- Музичний RSS, посилання на колекцію TikTok (без автоматичного сканування).
- Нікнейм, аватар, перенесення імпорту чатів до налаштувань.
- GitHub Actions CI на main перед релізним тегом.

## 0.3.1 — Build Fix

- Виправлення TypeScript збірки 0.3.0.

## 0.4.3 — Музичні релізи та TikTok-колекції (експеримент)
- Чарти Apple Music: топ-100 замість топ-25 за ринками.
- Окреме розширене джерело треків з альбомів, випущених за останні 7 днів і представлених в Apple Music Top Albums. Це не гарантує, що кожна композиція увійшла в чарт синглів.
- TikTok: експериментальний перегляд повної публічної колекції у вбудованому ізольованому вікні. LifeHub зчитує доступні відеопосилання з видимої сторінки, без доступу до паролів і без приватних API.
- Короткі TikTok-посилання: спроба відкрити й перейти на повний URL.
- Показ списку знайдених відео і Spotify-пошуку за доступним звуком або підписом (не автоматичне розпізнавання аудіо).
- Виправлено кеш старих музичних даних після переходу з 0.4.2.
- Обмеження: TikTok може вимагати авторизацію, міняти HTML або блокувати автоматичне читання. Читання відеокарток не означає Shazam/ідентифікацію пісень.
