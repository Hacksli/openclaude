# Vue remote client — редагування та деплой

Короткий гайд: де міняти код і як побачити зміни у реальному браузері,
підключеному до `/remote`.

## Структура

```
clients/vue-remote/            ← ДЖЕРЕЛЬНИЙ код Vue 3 + Vite (тут ви редагуєте)
  src/
    App.vue                    ← кореневий компонент, роутинг екранів
    components/
      StatusBar.vue            ← шапка: статус з'єднання, налаштування, shutdown
      SessionPicker.vue        ← список сесій, кнопки close/create
      ConnectPanel.vue         ← екран вводу URL+токена
      MessageList.vue + Message.vue ← стрічка повідомлень
      PromptComposer.vue       ← поле вводу
      PermissionBanner.vue     ← діалог підтвердження дозволу
      QueuedMessages.vue       ← чернетки у черзі
      ThinkingIndicator.vue    ← спінер "думає"
    composables/useRemoteSession.ts  ← WebSocket-клієнт + API
    types.ts                   ← типи протоколу (дублюють src/localRemote/types.ts)
    i18n.ts                    ← локалізовані рядки
  dist/                        ← артефакти білду (не комітити)

src/localRemote/client/        ← СТЕЙДЖ для скомпільованого бандла.
                                  Саме звідси демон віддає статику
                                  (див. CLIENT_DIR_CANDIDATES
                                  у daemonServer.ts).

dist/client/                   ← Куди йде бандл у релізному npm-пакеті.
                                  Генерується автоматично з
                                  src/localRemote/client/ у scripts/build.ts.
```

## Протокол WebSocket

Якщо додаєте новий тип повідомлення між браузером і демоном, оновіть
**обидва** файли синхронно:

- `clients/vue-remote/src/types.ts` — браузерний бік
- `src/localRemote/types.ts` — нодовий бік

Потім додайте обробник у:

- Браузер → сервер: `src/localRemote/daemon/sessionRouter.ts`
  (функція `handleClientEvent`)
- Сервер → браузер: `clients/vue-remote/src/composables/useRemoteSession.ts`
  (`ws.onmessage`)

## Як побачити зміни в браузері

### Варіант 1 — повний білд головного пакета (рекомендовано)

`scripts/build.ts` тепер автоматично:

1. Ставить залежності у `clients/vue-remote/` (якщо `node_modules` відсутня)
2. Викликає `npm run build` у `clients/vue-remote/`
3. Копіює `clients/vue-remote/dist/*` → `src/localRemote/client/`
4. Копіює `src/localRemote/client/*` → `dist/client/` (для npm-пакета)
5. Білдить головний `dist/cli.mjs`

Запустіть з кореня репо:

```bash
bun run scripts/build.ts
```

Далі треба **перезапустити демона**, щоб він підхопив нові файли.
Глобально встановлений `openclaude` віддає асети зі своєї інсталяційної
папки, тож для швидкого тестування скопіюйте вміст `dist/client/` у
`<npm-root>/@gitlawb/openclaude/dist/client/` (або перевстановіть пакет).

### Варіант 2 — тільки Vue (швидка ітерація)

```bash
cd clients/vue-remote
npm run dev                 # HMR на http://localhost:5173
```

Vue-dev-сервер не знає про демон — у UI доведеться ввести URL+токен
вручну. Якщо демон на 0.0.0.0:7842, це http://<ваш-IP>:7842 і токен
з `/remote status`.

### Варіант 3 — білд лише Vue та ручний копі

```bash
cd clients/vue-remote
npm run build
rm -rf ../../src/localRemote/client/assets
cp -r dist/* ../../src/localRemote/client/
```

Потім `bun run scripts/build.ts` для оновлення головного бандла (швидкий —
не перебілдить Vue повторно, бо зміст `src/localRemote/client/` вже свіжий,
але все ж виконає Vue-білд удруге — це <1 секунди).

## Рестарт демона

```bash
# Win: знайти PID
netstat -ano | grep ':7842 ' | grep LISTENING
taskkill /PID <pid> /F
rm ~/.nnc/remote-daemon.pid

# Стартонути знову
openclaude remote-daemon &
```

Перевірка:

```bash
curl -s http://127.0.0.1:7842/healthz        # → {"ok":true,"role":"daemon",...}
curl -s http://127.0.0.1:7842/ | grep title  # → <title>remote</title>
```

## Типові пастки

1. **"Я поміняв `.vue`, але в браузері все старе"** — забули ребілдити або
   демон тримає старий дист. Перевірте `curl / | grep index-*.js` — хеш
   у відповіді має збігатися з тим, що у `dist/assets/`.
2. **"Кеш браузера"** — PWA агресивно кешує. `Ctrl+Shift+R` або
   DevTools → Application → Service Workers → Unregister.
3. **`vue-tsc` впав** — `vite build` не запускається, якщо є TS-помилки.
   Спершу `npm run typecheck` для локалізації.
4. **Папка `vue-app/` у корені** — це порожній scaffold (HelloWorld),
   до remote-UI стосунку не має. Ігнорувати.
