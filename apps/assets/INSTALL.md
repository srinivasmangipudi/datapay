# DataPay — Drop-in Brand Package

Everything you need to wire the DataPay identity into a **Next.js** web app and a
**React Native / Expo** mobile app. All icons are pre-generated; the components and
config are copy-paste.

```
datapay-brand-package/
├── INSTALL.md                     ← you are here
├── tokens.ts                      ← shared colour/type/spacing tokens (both stacks)
│
├── nextjs-public/                 ← copy ALL of this into your Next.js /public
│   ├── favicon.ico                (16/32/48 multi-res)
│   ├── favicon.svg
│   ├── favicon-16x16.png · -32x32 · -48x48
│   ├── apple-touch-icon.png       (180, opaque)
│   ├── android-chrome-192x192.png · -512x512
│   ├── icon-maskable-512.png      (maskable, safe-zone aware)
│   ├── icon.svg                   (App Router auto-detects /app/icon.svg if placed there)
│   └── site.webmanifest
├── nextjs-metadata.ts             ← paste `metadata` export into app/layout.tsx
├── DataPayLogo.tsx                ← <DataPayMark/> + <DataPayLogo/> (web)
│
├── expo-assets/                   ← copy into your Expo project's ./assets
│   ├── icon.png                   (1024, opaque — OS masks the corners)
│   ├── adaptive-icon.png          (1024, transparent foreground — Android)
│   ├── splash.png                 (1284×2778, ink bg)
│   └── favicon.png                (expo web)
├── expo-app.config-snippet.json   ← merge the `expo` block into app.json
├── DataPayLogo.native.tsx         ← <DataPayMark/> + <DataPayLogo/> (react-native-svg)
│
└── shared-images/                 ← og-images, pattern tiles, horizontal logos
```

---

## Next.js (App Router)

1. Copy everything in **`nextjs-public/`** into your project's **`/public`**.
2. Copy **`shared-images/og-image.png`** into **`/public`** too (metadata references `/og-image.png`).
3. Paste the `metadata` export from **`nextjs-metadata.ts`** into your root **`app/layout.tsx`**
   (or merge with your existing metadata object).
4. Drop **`tokens.ts`** and **`DataPayLogo.tsx`** into e.g. `lib/brand/`.
5. Load fonts — add to `app/layout.tsx` head or via `next/font`:
   - Cabinet Grotesk + Switzer: https://www.fontshare.com (free)
   - Spline Sans Mono: `next/font/google` → `Spline_Sans_Mono`
6. Use it:
   ```tsx
   import { DataPayLogo, DataPayMark } from "@/lib/brand/DataPayLogo";
   <DataPayLogo tagline="Your data is your asset" />
   <DataPayMark size={32} dark />
   ```

That's it — favicons, PWA manifest, Apple touch icon, and OG/Twitter cards all wired.

---

## React Native / Expo

1. `npx expo install react-native-svg expo-font`
2. Copy everything in **`expo-assets/`** into your project's **`./assets`**.
3. Merge the `expo` block from **`expo-app.config-snippet.json`** into your **`app.json`**
   (keep your own `bundleIdentifier` / `package` if you already have them).
4. Drop **`tokens.ts`** and **`DataPayLogo.native.tsx`** into e.g. `src/brand/`.
5. Load fonts with `expo-font` (see the note at the bottom of `DataPayLogo.native.tsx`).
6. Use it:
   ```tsx
   import { DataPayLogo, DataPayMark } from "./src/brand/DataPayLogo.native";
   <DataPayLogo tagline="Make your data work for you" />
   <DataPayMark size={40} dark />
   ```
7. `npx expo prebuild` (or EAS build) will bake in the icon, adaptive icon, and splash.

---

## Colours (from tokens.ts)
| token | hex | use |
|---|---|---|
| ink | #101418 | text, dark surfaces, "custody" |
| porcelain | #F6F5F1 | light surfaces |
| jade | #0E7A5C | trust, growth, data record (primary accent) |
| jadeBright | #12946F | jade on dark |
| brass | #B98F2F | **value & money only** + the "Pay" wordmark |
| brassBright | #D4AA45 | brass on dark |
| mist | #8A939B | secondary text |

## Two rules that keep it on-brand
1. **Brass is for value/money and the "Pay" wordmark only** — never body text.
2. **"Pay" leans −9°, "Data" stays upright.** The components already do this.

## Regenerating icons
All icons were rendered from SVG sources. If you change the mark, re-run the
generator that produced these (the two-tone circle-holds-square geometry) and the
whole set updates together — vector in, every size out.
