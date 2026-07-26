# KeiGo JP

KeiGo JP is an offline-first Expo/React Native app for learning Japanese
business honorific language. It includes searchable respectful and humble
forms, example expressions, quizzes, flashcards, pronunciation, and local
practice statistics. Learning data and preferences stay in device storage.

## Development

The app targets Expo SDK 54 and Node 24. Install dependencies and run the
validation suite with:

```sh
npm ci
npm run lint
npm run typecheck
npm run test:ci
```

Start Metro with `npm start`. Run a local native build with `npm run ios` or
`npm run android`, and start the web version with `npm run web`.

Logic tests use the fast Node/ts-jest project; React Native component tests use
the jest-expo project. Test files belong under `src/__tests__` and use
`.test.ts` or `.test.tsx` respectively.

## Project map

- `src/data` — keigo verbs and expression content
- `src/screens` — Search, Quiz, Flashcards, Guide, Stats, and More screens
- `src/store` — validated, serialized local persistence
- `src/utils` — search, speech, calendar, theme, and shared logic
- `src/__tests__` — logic, persistence, and component tests
- `docs` — hosted privacy and support pages

## Release

Before a release:

1. Run `npm run lint`, `npm run typecheck`, and `npm run test:ci`.
2. Run `npm run doctor` and resolve or explicitly account for every report.
3. Test a production-like build on small and large iOS and Android devices,
   including dark mode, large text, VoiceOver/TalkBack, Japanese speech,
   review/share links, and persistence after relaunch.
4. Confirm the App Store and Google Play metadata, screenshots, privacy
   disclosures, version/build numbers, and support URLs.
5. Build with `eas build --profile production --platform ios` and
   `eas build --profile production --platform android`.
6. Submit only after reviewing the generated artifacts and intended release
   tracks: `eas submit --profile production --platform ios|android`.

EAS owns native build-number increments. User-facing version information must
come from the installed binary rather than a hardcoded string.
