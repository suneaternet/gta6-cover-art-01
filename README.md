# Vice Cover Studio

[![make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/c/gta6-cover-art-01)

Turn your photos into GTA-style multi-panel cover art — a Vice City sunset
poster with bold caption lettering, exported as a PNG to share.

## Try it

Open `app/index.html` in desktop Chrome. No build step, no network: every
script, font and sample photo is a file under `app/`.

1. **Add photos** from your machine (or press *Use samples*).
2. Pick a **layout** — Vice Trio, Quad or Hero Strip — and an **export size**
   (1080 × 1080, 1080 × 1350 or 1920 × 1080).
3. Click a panel to select it, then drag the photo inside it to reposition,
   scroll to zoom, or use the Zoom / Pan sliders. Click a photo thumbnail to
   put it in the selected panel; *Fill all panels* uses one photo everywhere.
4. Write your **title and subtitle**, pick a colour grade (Sunset, Neon,
   Teal, Mono) and a caption style.
5. **Export PNG** — the cover downloads and is shown in the app.

Photos stay on your machine; nothing is uploaded.

## Originality

An original design: no Rockstar Games logo, wordmark, official artwork,
character or font. Display type is Anton and body type is Archivo, both
under the SIL Open Font License (see `app/fonts/OFL-Anton.txt` and
`app/fonts/OFL-Archivo.txt`). Sample photos were made with an image model.
The palm silhouettes and sun are drawn by the app's own canvas code.

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `app/` and `screenshots/` to the output directory and
writes `dossier.json` with the vendored make.fun library
(`vendor/makefun-app.ts`, unchanged from the kit).

## License

MIT — see [LICENSE](LICENSE).

## Referral

Built for make.fun — referral code `q0fbnzcq`.
