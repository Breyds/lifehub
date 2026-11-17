# Оновити LifeHub з 0.3.1 до 0.4.0 через GitHub

Репозиторій: **https://github.com/Breyds/lifehub**.

**Не видаляй встановлений LifeHub 0.3.1. Спочатку створи резервну копію:** у програмі Налаштування → Мої дані → Експортувати JSON.

## 1. Онови вихідний код

1. Розпакуй `LifeHub-v0.4.0-Source.zip`.
2. Скопіюй **увесь вміст** (включно з `.github`) у папку проєкту, звідки ти раніше запускав `git push`.
3. Погодься на заміну однакових файлів.
4. **НЕ видаляй папку `.git`** (вона не входить до архіву), `node_modules`, `release` і `dist` можна залишити — це не вихідний код.

## 2. Перевір перед публікацією

У PowerShell у папці LifeHub:

```powershell
npm install
npm test
npm run build
```

Якщо хоча б одна команда впала — **не став тег**. Надішли повідомлення про помилку, особливо шлях до файлу, номер рядка, код TS і текст.

## 3. Відправ код на GitHub БЕЗ тега

```powershell
git status
git add .
git commit -m "LifeHub 0.4.0 features"
git push origin main
```

Відкрий **https://github.com/Breyds/lifehub/actions** і знайди нову збірку **Validate LifeHub**. Вона запускає `npm test` + `npm run build` на GitHub Windows. **Перевір зелену галочку, перш ніж перейти далі.**

## 4. Збери інсталятор автоматично

Лише якщо Validate LifeHub завершився без помилок:

```powershell
git tag v0.4.0
git push origin v0.4.0
```

У Actions з'явиться **Build and publish LifeHub Windows**. Після успішного виконання відкрий **https://github.com/Breyds/lifehub/releases** і опублікуй Draft 0.4.0, якщо GitHub не зробив це сам.

У релізі мають бути:

- `LifeHub-Setup-0.4.0.exe`
- `latest.yml`
- `LifeHub-Setup-0.4.0.exe.blockmap`

## 5. Онови встановлений LifeHub

Відкрий LifeHub 0.3.1 → Налаштування → Перевірити оновлення. Після завантаження підтверди встановлення 0.4.0. Якщо автооновлення непідписаного інсталятора не вдається, завантаж `LifeHub-Setup-0.4.0.exe` з Releases і встанови **поверх попередньої версії**, без видалення даних.

## Передача помилок

Після зеленого `Validate LifeHub` код повинен збиратися в Windows CI, однак справжні інтеграції (API-фото/новини, авторизація, сповіщення, автооновлення) ще потрібно перевірити на твоєму комп'ютері.
