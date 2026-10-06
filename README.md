# Divertory

Analyza prechodov bedien cez divertory. Staticka stranka (`public/index.html`) + dve Vercel funkcie,
ktore ukladaju datasety do **privatneho Vercel Blob** uloziska, chranene spolocnym heslom.

```
public/index.html   UI + analyza (bezi v prehliadaci)
api/login.js        POST = prihlasenie heslom, DELETE = odhlasenie
api/datasets.js     GET zoznam / GET ?id= / PUT / DELETE ?id=
api/_auth.js        podpisana session cookie (HMAC, 30 dni)
```

## Nasadenie

1. Push do GitHubu:
   ```bash
   git init -b main && git add . && git commit -m "Divertory: shared storage"
   gh repo create Temporary-Permanent-Fix/divertory --private --source=. --push
   ```
2. Vercel -> Add New -> Project -> import repozitara. Framework Preset: **Other**, build command a output directory nechat prazdne.
3. Projekt -> Storage -> Create Database -> **Blob**, Access: **Private**, pripojit k projektu
   (prida `BLOB_READ_WRITE_TOKEN`). Pristup sa po vytvoreni uloziska neda zmenit.
4. Projekt -> Settings -> Environment Variables: `APP_PASSWORD` = dlhe nahodne heslo (Production + Preview).
5. Redeploy (premenne sa nacitaju az pri novom deployi).

Lokalne: `npm i -g vercel && vercel link && vercel env pull && vercel dev`.

## Spravanie

- Bez prihlasenia funguje analyza lokalne; posledny dataset sa drzi v IndexedDB prehliadaca.
- Po prihlaseni: "Ulozit aktualne data na server" ulozi surove riadky + priradenie stlpcov. Kazdy s heslom moze nacitat aj zmazat.
- Limit: ~4.2 MB po gzip kompresii (limit tela requestu Vercel funkcii je 4.5 MB). Pri prekroceni sa ulozia len 3 priradene stlpce; ak ani to nestaci, treba dataset rozdelit.
- Zmena `APP_PASSWORD` odhlasi vsetkych.
