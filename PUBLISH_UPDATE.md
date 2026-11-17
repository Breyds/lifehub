# LifeHub 0.3.1 — виправлення помилок збірки

Ця версія виправляє 10 TypeScript/React JSX-помилок `unknown` у `src/WorkspacePages.tsx` з невдалої збірки 0.3.0. Дані встановленої програми видаляти не потрібно.

## Встановлення виправленого коду

1. Розпакуй LifeHub-v0.3.1-Fix.zip.
2. Скопіюй його вміст до локальної папки Git-проєкту LifeHub (`...\LifeHub`), замінивши файли. НЕ видаляй папку `.git`.
3. Відкрий PowerShell **у папці проєкту**.
4. Запусти:

```powershell
npm install
npm run build
npm test
```

5. Якщо немає помилок, виконай:

```powershell
git add .
git commit -m "Fix TypeScript JSX errors in LifeHub 0.3.1"
git push origin main
git tag v0.3.1
git push origin v0.3.1
```

6. На GitHub відкрий Actions. Перевір, що робота `windows-installer` успішна.
7. У Releases знайди чернетку 0.3.1 і натисни `Publish release`. Чернетку **0.3.0 не публікуй**.
8. На комп'ютері запусти LifeHub 0.2.0, перевір оновлення. Якщо автооновлення не працює, завантаж LifeHub-Setup-0.3.1.exe з Releases і встанови поверх без видалення даних.

**Увага:** не роби `git tag -f v0.3.0`; це інший, уже опублікований у Git тег.
