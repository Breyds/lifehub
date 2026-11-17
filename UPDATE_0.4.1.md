# LifeHub 0.4.1 — Windows update instructions

## 1) Save your data

In the installed LifeHub choose **Settings → My Data → Export JSON**. Keep the backup separate. **Do not uninstall LifeHub** or delete `%APPDATA%/lifehub-personal`.

## 2) Replace project source files

Unzip `LifeHub-v0.4.1-Source.zip`. Copy its contents over the existing LifeHub source folder (the folder with your `.git`, `package.json` and `START_LIFEHUB.bat`), replacing matching source files. Do **not** delete `.git`. This archive contains no `.git`, API key, personal data, `node_modules`, `dist`, or `release`.

## 3) Verify locally

Open PowerShell/CMD in the project folder and run:

```bat
npm install
npm test
npm run build
```

Do not publish if the build fails; share the terminal error for repair.

## 4) Push main (do NOT tag yet)

```bat
git add .
git commit -m "LifeHub 0.4.1 fixes"
git push origin main
```

Go to https://github.com/Breyds/lifehub/actions and confirm **Validate LifeHub** has succeeded on the latest push. If not, open the failed job details.

## 5) Create tag and publish installer

Only after successful CI:

```bat
git tag v0.4.1
git push origin v0.4.1
```

Check **Build and publish LifeHub Windows** at the Actions page. Once green, go to https://github.com/Breyds/lifehub/releases, publish the v0.4.1 draft (if it is a draft) and verify it contains `LifeHub-Setup-0.4.1.exe`, `latest.yml`, and `.blockmap`.

## 6) Install 0.4.1 once and test updater

The **installed older version** may still be unable to auto-update because its updater code is already baked into the EXE. If so, download `LifeHub-Setup-0.4.1.exe` and install it **over** the existing version without uninstalling. This should preserve LifeHub's local data, but keeping the backup is essential.

Open installed LifeHub → Settings → Updates → Check. While 0.4.1 is the newest release, it should report no new update. **You cannot fully test auto-download/install until you publish a newer version (for example 0.4.2).** If GitHub reports an error, share the exact message; publishing assets alone does not prove updater success.

## 7) Verify fixes

- Add an all-day one-time event for tomorrow and confirm dots appear **only tomorrow** in Planner and Study calendar.
- News → click refresh. BBC original article images should appear for supported regions when the publisher feed has thumbnails and internet is accessible. Google News search results may still be text-only.
- Music → see separate **US** and **Regional** charts. Use "Popular now" vs "Released in 7 days". Data comes from public Apple Music feeds, and an unavailable market is reported rather than fabricated.
- No OpenAI API key is required for music charts or RSS images.

## Important limitations

- A successful Node unit test is not the same as a Windows integration test.
- A given national Apple Music storefront might be inaccessible; the Russia feed in particular is optional. The regional chart covers multiple countries rather than claiming to represent every Russian-language trend.
- The live data feeds were not accessible in the build environment; troubleshoot source availability on the actual PC if content is missing.
- Images from third-party publishers can disclose your IP to their image hosts as they load.
