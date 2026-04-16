# Neural Network

Neural Network — це CLI з відкритим вихідним кодом для роботи з моделями в хмарі та локально.

Використовуй OpenAI-сумісні API, Gemini, GitHub Models, Codex OAuth, Codex, Ollama, Atomic Chat та інші підтримувані бекенди в єдиному термінальному робочому процесі: промпти, інструменти, агенти, MCP, slash-команди та стрімінговий вивід.

[![PR Checks](https://github.com/Hacksli/openclaude/actions/workflows/pr-checks.yml/badge.svg?branch=main)](https://github.com/Hacksli/openclaude/actions/workflows/pr-checks.yml)
[![Release](https://img.shields.io/github/v/tag/Hacksli/openclaude?label=release&color=0ea5e9)](https://github.com/Hacksli/openclaude/tags)
[![Discussions](https://img.shields.io/badge/discussions-open-7c3aed)](https://github.com/Hacksli/openclaude/discussions)
[![Security Policy](https://img.shields.io/badge/security-policy-0f766e)](SECURITY.md)
[![License](https://img.shields.io/badge/license-MIT-2563eb)](LICENSE)

[Швидкий старт](#швидкий-старт) | [Налаштування](#інструкції-налаштування) | [Провайдери](#підтримувані-провайдери) | [Reжим undercover](#режим-undercover) | [Збірка з вихідного коду](#збірка-з-вихідного-коду-та-локальна-розробка) | [Розширення VS Code](#розширення-vs-code) | [Спільнота](#спільнота)

## Історія зірок

[![Star History Chart](https://api.star-history.com/chart?repos=hacksli/openclaude&type=date&legend=top-left)](https://www.star-history.com/?repos=hacksli%2Fopenclaude&type=date&legend=top-left)

## Чому Neural Network

- Один CLI для всіх хмарних API та локальних бекендів
- Збереження профілів провайдерів у додатку через `/provider`
- Робота з OpenAI-сумісними сервісами, Gemini, GitHub Models, Codex OAuth, Codex, Ollama, Atomic Chat та іншими провайдерами
- Єдиний робочий процес для кодингу: bash, інструменти роботи з файлами, grep, glob, агенти, задачі, MCP та веб-інструменти
- Вбудоване розширення VS Code для інтеграції запуску та підтримки тем

## Швидкий старт

### Встановлення

```bash
npm install -g @hacksli/openclaude
```

Якщо після встановлення з'являється помилка `ripgrep not found`, встанови ripgrep системно та переконайся, що `rg --version` працює в тому ж терміналі перед запуском Neural Network.

### Запуск

```bash
openclaude
```

Усередині Neural Network:

- запусти `/provider` для налаштування провайдера та збереження профілів
- запусти `/onboard-github` для налаштування GitHub Models

### Найшвидший налаштування OpenAI

macOS / Linux:

```bash
export CLAUDE_CODE_USE_OPENAI=1
export OPENAI_API_KEY=sk-your-key-here
export OPENAI_MODEL=gpt-4o

openclaude
```

Windows PowerShell:

```powershell
$env:CLAUDE_CODE_USE_OPENAI="1"
$env:OPENAI_API_KEY="sk-your-key-here"
$env:OPENAI_MODEL="gpt-4o"

openclaude
```

### Найшвидший налаштування локального Ollama

macOS / Linux:

```bash
export CLAUDE_CODE_USE_OPENAI=1
export OPENAI_BASE_URL=http://localhost:11434/v1
export OPENAI_MODEL=qwen2.5-coder:7b

openclaude
```

Windows PowerShell:

```powershell
$env:CLAUDE_CODE_USE_OPENAI="1"
$env:OPENAI_BASE_URL="http://localhost:11434/v1"
$env:OPENAI_MODEL="qwen2.5-coder:7b"

openclaude
```

### Використання команди запуску Ollama

Якщо у тебе встановлений [Ollama](https://ollama.com), можна взагалі не налаштовувати змінні оточення:

```bash
ollama launch openclaude --model qwen2.5-coder:7b
```

Це автоматично встановлює `ANTHROPIC_BASE_URL`, маршрутизацію моделей та авторизацію, щоб весь трафік API йшов через твій локальний екземпляр Ollama. Працює з будь-якою завантаженою моделлю — локальною або хмарною.

## Інструкції налаштування

Дружні інструкції для початківців:

- [Налаштування для новачків](docs/non-technical-setup.md)
- [Швидкий старт для Windows](docs/quick-start-windows.md)
- [Швидкий старт для macOS / Linux](docs/quick-start-mac-linux.md)

Просунуті інструкції та збірка з вихідного коду:

- [Просунуте налаштування](docs/advanced-setup.md)
- [Встановлення на Android](ANDROID_INSTALL.md)
- [Remote Session (`/remote`)](docs/remote-session.md) — дзеркалювання активної сесії на телефон через HTTP + WebSocket

## Підтримувані провайдери

| Провайдер | Шлях налаштування | Примітки |
| --- | --- | --- |
| OpenAI-сумісні | `/provider` або змінні оточення | Працює з OpenAI, OpenRouter, DeepSeek, Groq, Mistral, LM Studio та іншими сумісними `/v1` серверами |
| Gemini | `/provider` або змінні оточення | Підтримує API ключ, access token або локальний ADC workflow на поточній `main` |
| GitHub Models | `/onboard-github` | Іnteractive onboarding із збереженням облікових даних |
| Codex OAuth | `/provider` | Відкриває вхід у ChatGPT у браузері та безпечно зберігає облікові дані Codex |
| Codex | `/provider` | Використовує існуючу авторизацію Codex CLI, безпечне сховище Neural Network або змінні оточення |
| Ollama | `/provider`, змінні оточення або `ollama launch` | Локальний інференс без API ключа |
| Atomic Chat | просунуте налаштування | Локальний бекенд для Apple Silicon |
| Bedrock / Vertex / Foundry | змінні оточення | Додаткові інтеграції провайдерів для підтримуваних середовищ |
| OpenRouter | `/provider` або змінні оточення | Агрегатор моделей з підтримкою єдиного API |
| NVIDIA NIM | `/provider` або змінні оточення | GPU-прискорені моделі NVIDIA |
| MiniMax | `/provider` або змінні оточення | Китайський провайдер великих моделей |

## Що працює

- **Робочі процеси з інструментами**: Bash, читання/запис/редагування файлів, grep, glob, агенти, задачі, MCP та slash-команди
- **Стрімінг відповідей**: Вивід токенів у реальному часі та прогрес інструментів
- **Виклик інструментів**: Багатокрокові цикли виклику інструментів з виконанням та подальшими відповідями
- **Зображення**: URL та base64 зображення для провайдерів з підтримкою vision
- **Профілі провайдерів**: Керівництво з налаштування та збереження в `.openclaude-profile.json`
- **Локальні та віддалені бекенди**: Cloud API, локальні сервери та локальний інференс на Apple Silicon

## Примітки провайдерів

Neural Network підтримує кількох провайдерів, але поведінка може відрізнятися.

- Функції, специфічні для Anthropic, можуть відсутні на інших провайдерах
- Якість роботи інструментів сильно залежить від обраної моделі
- Менші локальні моделі можуть мати проблеми з довгими багатокрокovими циклами
- Деякі провайдери мають нижчі ліміти виводу, ніж налаштування CLI за замовчуванням

Для найкращих результатів використовуй моделі з сильною підтримкою tool/function calling.

## Маршрутизація агентів

Neural Network може маршрутизувати різних агентів до різних моделей через налаштування. Це корисно для оптимізації витрат або розподілу роботи за міцністю моделі.

Додай у `~/.claude/settings.json`:

```json
{
  "agentModels": {
    "deepseek-chat": {
      "base_url": "https://api.deepseek.com/v1",
      "api_key": "sk-your-key"
    },
    "gpt-4o": {
      "base_url": "https://api.openai.com/v1",
      "api_key": "sk-your-key"
    }
  },
  "agentRouting": {
    "Explore": "deepseek-chat",
    "Plan": "gpt-4o",
    "general-purpose": "gpt-4o",
    "frontend-dev": "deepseek-chat",
    "default": "gpt-4o"
  }
}
```

Якщо відповідності маршрутизації не знайдено, використовується глобальний провайдер.

> **Примітка:** Значення `api_key` у `settings.json` зберігаються у відкритому тексті. Залиш цей файл приватним і не коміть у систему контролю версій.

## Web Search та WebFetch

За замовчуванням `WebSearch` працює на не-Anthropic моделях через DuckDuckGo. Це дає GPT-4o, DeepSeek, Gemini, Ollama та іншим OpenAI-сумісним провайдерам безкоштовний шлях пошуку в інтернеті.

> **Примітка:** Резервний варіант DuckDuckGo працює через парсинг результатів пошуку і може бути обмежений rate-limit, заблокований або підпорядковуватися умовам використання DuckDuckGo. Для більш надійного варіанту налаштуй Firecrawl.

Для нативних бекендів Anthropic та відповідей Codex Neural Network зберігає нативну пошукову поведінку провайдера.

`WebFetch` працює, але його базовий HTTP плюс шлях HTML-to-markdown може все ще не працювати на сайтах з JavaScript або сайтах, які блокують прості HTTP-запити.

Встанови API ключ [Firecrawl](https://firecrawl.dev) для пошуку/fetch через Firecrawl:

```bash
export FIRECRAWL_API_KEY=your-key-here
```

З увімкненим Firecrawl:

- `WebSearch` може використовувати пошук Firecrawl, а DuckDuckGo залишається безкоштовним варіантом за замовчуванням для не-Claude моделей
- `WebFetch` використовує endpoint scrape Firecrawl замість сирого HTTP, коректно обробляючи сторінки з JavaScript

Безкоштовний тариф на [firecrawl.dev](https://firecrawl.dev) включає 500 кредитів. Ключ необов'язковий.

---

## Режим undercover

Neural Network має **режим undercover**, який змушує асистента писати як звичайний розробник: без ідентифікації AI, без назв моделей у виводі та без маркерів авторства AI в комітах або PR.

Коли активний, режим undercover:

- Пропускає рядки `You are powered by claude-...` та будь-які згадки Claude / OpenClaude / назв моделей із системного промпту
- Додає інструкцію у промпти комітів та PR уникати маркерів авторства AI
- Видаляє `Co-Authored-By:` та атрибуцію `Generated with OpenClaude` з комітів і PR
- Показує індикатор `undercover` у футері промпту

Undercover **увімкнено за замовчуванням**. Керуй ним через:

```bash
# Запуск з undercover вимкненим
export OPENCLAUDE_UNDERCOVER=0
openclaude
```

Або перемкни під час роботи в Neural Network:

```
/undercover           # показати поточний стан
/undercover on        # увімкнути
/undercover off       # вимкнути
/undercover toggle    # перемкнути поточний стан
```

Перемкнення набуває повної сили на наступному повідомленні (поточний промпт може вже бути кешованим).

---

## Headless gRPC сервер

Neural Network можна запустити як headless gRPC-сервіс, що дозволяє інтегрувати його агентні можливості (інструменти, bash, редагування файлів) в інші додатки, CI/CD пайплайни або користувацькі інтерфейси. Сервер використовує двонаправлений стрімінг для відправки чанків тексту в реальному часі, викликів інструментів та запиту дозволів на чутливі команди.

### 1. Запуск gRPC сервера

Запусти основний двигун як gRPC-сервіс на `localhost:50051`:

```bash
npm run dev:grpc
```

#### Налаштування

| Змінна | За замовчуванням | Опис |
|-----------|-------------|------------------------------------------------|
| `GRPC_PORT` | `50051` | Порт, на якому слухає gRPC-сервер |
| `GRPC_HOST` | `localhost` | Адреса прив'язки. Використовуй `0.0.0.0` для відкриття на всіх інтерфейсах (не рекомендується без автентифікації) |

### 2. Запуск тестового CLI клієнта

Ми надаємо легкий CLI клієнт, який спілкується виключно через gRPC. Він працює як основний інтерактивний CLI, відтворює кольори, стрімує токени та запитує дозвіл на інструменти через подію `action_required` gRPC.

У окремому терміналі запусти:

```bash
npm run dev:grpc:cli
```

*Примітка: gRPC визначення знаходяться у `src/proto/openclaude.proto`. Можна використовувати цей файл для генерації клієнтів у Python, Go, Rust або будь-якій іншій мові.*

---

## Збірка з вихідного коду та локальна розробка

```bash
bun install
bun run build
node dist/cli.mjs
```

Корисні команди:

- `bun run dev`
- `bun test`
- `bun run test:coverage`
- `bun run security:pr-scan -- --base origin/main`
- `bun run smoke`
- `bun run doctor:runtime`
- `bun run verify:privacy`
- Фocused `bun test ...` запуски для областей, яких торкнувсяся

## Тестування та покриття

Neural Network використовує вбудований тестовий раннер Bun для юніт-тестів.

Запуск повної юніт-тестовоїsuite:

```bash
bun test
```

Генерація покриття юніт-тестів:

```bash
bun run test:coverage
```

Відкрити візуальний звіт про покриття:

```bash
open coverage/index.html
```

Якщо вже є `coverage/lcov.info` і потрібно лише перестворити UI:

```bash
bun run test:coverage:ui
```

Використовуй фокусовані запуски тестів, коли торкаєшся лише однієї області:

- `bun run test:provider`
- `bun run test:provider-recommendation`
- `bun test path/to/file.test.ts`

Рекомендована валідація контриб'ютора перед відкриттям PR:

- `bun run build`
- `bun run smoke`
- `bun run test:coverage` для ширшого покриття, коли зміни торкаються спільного runtime або логіки провайдерів
- focused `bun test ...` запуски для файлів і потоків, які змінив

Звіт про покриття записується у `coverage/lcov.info`, а Neural Network також генерує heatmap у стилі git-активності в `coverage/index.html`.

## Структура репозиторію

- `src/` — основний CLI/runtime
- `scripts/` — збірка, перевірка та обслуговування
- `docs/` — налаштування, контриб'ютор та проектна документація
- `python/` — окремі Python-помічники та їх тести
- `vscode-extension/openclaude-vscode/` — розширення VS Code
- `.github/` — автоматизація репо, шаблони та налаштування CI
- `bin/` — CLI ланцюжки входу

## Розширення VS Code

Репозиторій включає розширення VS Code в [`vscode-extension/openclaude-vscode`](vscode-extension/openclaude-vscode) для інтеграції запуску Neural Network, UI центру керування з підтримкою провайдерів та підтримки тем.

## Безпека

Якщо знайшов проблему безпеки, дивіться [SECURITY.md](SECURITY.md).

## Спільнота

- Використовуй [GitHub Discussions](https://github.com/Hacksli/openclaude/discussions) для питань, ідей та спілкування спільноти
- Використовуй [GitHub Issues](https://github.com/Hacksli/openclaude/issues) для підтверджених багів та реалізації функцій

## Контриб'юція

Внесок вітається.

Для великих змін спочатку відкрий issue, щоб уточнити scope перед реалізацією. Корисні команди валідації:

- `bun run build`
- `bun run test:coverage`
- `bun run smoke`
- focused `bun test ...` запуски для торкнених областей

## Відмова від відповідальності

Neural Network — це незалежний спільнотний проект, який не афілійований, не схвалений і не спонсорований Anthropic.

Neural Network походить з кодової бази Claude Code і з тих пір суттєво модифікований для підтримки кількох провайдерів та відкритого використання. "Claude" та "Claude Code" — торгові марки Anthropic PBC. Дивіться [LICENSE](LICENSE) для деталей.

## Ліцензія

Дивіться [LICENSE](LICENSE).
