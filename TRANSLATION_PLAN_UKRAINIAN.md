# План перекладу на українську мову

## Пріоритет 1: Критичні екрани (перший запуск та основна робота)

### 1.1 StartupModelPicker.tsx
**Файл:** `src/components/StartupModelPicker.tsx`

| Англійська | Українська |
|------------|------------|
| `Model List` | `Список моделей` |
| `Fetching models from {providerLabel}...` | `Завантаження моделей з {providerLabel}...` |
| `Failed to fetch models` | `Не вдалося завантажити моделі` |
| `Press Esc to cancel` | `Натисніть Esc для скасування` |
| `Select model` | `Оберіть модель` |
| `Filter: ` | `Фільтр: ` |
| `No models match "{filter}"` | `Не знайдено моделей, що відповідають "{filter}"` |
| `{cursor + 1}/{filtered.length} - PgUp/PgDn to scroll` | `{cursor + 1}/{filtered.length} - PgUp/PgDn для прокрутки` |
| `Up/Down navigate - Enter confirm - Esc cancel - type to filter` | `↑↓ навігація · Enter вибрати · Esc скасувати · ввод для фільтра` |

### 1.2 Onboarding.tsx
**Файл:** `src/components/Onboarding.tsx`

| Англійська | Українська |
|------------|------------|
| `Neural Network can make mistakes` | `Нейромережі можуть помилятися` |
| `You should always review responses, especially when running code.` | `Ви завжди повинні перевіряти відповіді, особливо при запуску коду.` |
| `Due to prompt injection risks, only use it with code you trust` | `Через ризики ін'єкцій промптів, використовуйте тільки з кодом, якому довіряєте` |
| `For more details see:` | `Детальніше дивіться:` |
| `Use Neural Network's terminal setup?` | `Використати налаштування терміналу Нейромережі?` |
| `For the optimal coding experience, enable the recommended settings for your terminal: {settings}` | `Для оптимального досвіду кодування увімкніть рекомендовані налаштування для вашого терміналу: {settings}` |
| `Yes, use recommended settings` | `Так, використати рекомендовані налаштування` |
| `No, maybe later with /terminal-setup` | `Ні, можливо пізніше через /terminal-setup` |

### 1.3 ModelPicker.tsx
**Файл:** `src/components/ModelPicker.tsx`

| Англійська | Українська |
|------------|------------|
| `Select model` | `Оберіть модель` |
| `Switch between models. Applies to this session and future Neural Network sessions.` | `Перемикання між моделями. Застосовується до цієї сесії та майбутніх сесій Нейромережі.` |
| `Currently using {model} for this session (set by plan mode). Selecting a model will undo this.` | `Зараз використовується {model} для цієї сесії (встановлено режимом планування). Вибір моделі скасує це.` |
| `and {hiddenCount} more...` | `та ще {hiddenCount}...` |
| `Effort not supported` | `Effort не підтримується` |
| `{effort} effort` | `{effort} effort` |
| `(default)` | `(за замовчуванням)` |
| `Fast mode is ON and available with {model} only (/fast). Switching to other models turn off fast mode.` | `Швидкий режим увімкнено і доступний тільки з {model} (/fast). Перехід на інші моделі вимикає швидкий режим.` |
| `Use /fast to turn on Fast mode ({model} only).` | `Використайте /fast для увімкнення швидкого режиму (тільки {model}).` |

### 1.4 PromptInputFooterLeftSide.tsx
**Файл:** `src/components/PromptInput/PromptInputFooterLeftSide.tsx`

| Англійська | Українська |
|------------|------------|
| `Press {key} again to exit` | `Натисніть {key} ще раз для виходу` |
| `Pasting text...` | `Вставлення тексту...` |
| `-- INSERT --` | `-- ВСТАВЛЕННЯ --` |
| `! for bash mode` | `! для режиму bash` |
| `return to team lead` | `повернутися до team lead` |
| `? for shortcuts` | `? для шорткатів` |
| `hold {shortcut} to speak` | `утримуйте {shortcut} для голосу` |
| `option+click` | `option+клік` |
| `shift+click` | `shift+клік` |
| `view tasks` | `переглянути завдання` |
| `manage tasks` | `керувати завданнями` |
| `show tasks` | `показати завдання` |
| `show teammates` | `показати teammates` |
| `hide` | `сховати` |
| `hide tasks` | `сховати завдання` |

### 1.5 PromptInputHelpMenu.tsx
**Файл:** `src/components/PromptInput/PromptInputHelpMenu.tsx`

| Англійська | Українська |
|------------|------------|
| `{shortcut} for terminal` | `{shortcut} для терміналу` |
| `to auto-accept edits` | `для авто-прийняття змін` |
| `to cycle modes` | `для перемикання режимів` |
| `{shortcut} for verbose output` | `{shortcut} для детального виводу` |
| `{shortcut} to toggle tasks` | `{shortcut} для перемикання завдань` |
| `{shortcut} to undo` | `{shortcut} для скасування` |
| `{shortcut} to paste images` | `{shortcut} для вставлення зображень` |
| `{shortcut} to switch model` | `{shortcut} для перемикання моделі` |
| `{shortcut} to toggle fast mode` | `{shortcut} для перемикання fast mode` |
| `{shortcut} to stash prompt` | `{shortcut} для збереження промпту` |
| `{shortcut} to edit in $EDITOR` | `{shortcut} для редагування в $EDITOR` |

## Пріоритет 2: Налаштування та вибір

### 2.1 ThemePicker.tsx
**Файл:** `src/components/ThemePicker.tsx`

| Англійська | Українська |
|------------|------------|
| `Auto (match terminal)` | `Авто (відповідно до терміналу)` |
| `Fire (sunset - Neural Network default)` | `Вогонь (захід сонця - Нейромережа за замовчуванням)` |
| `Dark mode` | `Темний режим` |
| `Light mode` | `Світлий режим` |
| `Dark mode (colorblind-friendly)` | `Темний режим (для людей з дальтонізмом)` |
| `Light mode (colorblind-friendly)` | `Світлий режим (для людей з дальтонізмом)` |
| `Dark mode (ANSI colors only)` | `Темний режим (тільки ANSI кольори)` |
| `Light mode (ANSI colors only)` | `Світлий режим (тільки ANSI кольори)` |
| `Let's get started.` | `Почнемо.` |
| `Choose the text style that looks best with your terminal` | `Оберіть стиль тексту, який найкраще виглядає у вашому терміналі` |
| `Press {key} again to exit` | `Натисніть {key} ще раз для виходу` |

### 2.2 EffortPicker.tsx
**Файл:** `src/components/EffortPicker.tsx`

| Англійська | Українська |
|------------|------------|
| `Auto` | `Авто` |
| `Use the default effort level for your model` | `Використовувати рівень effort за замовчуванням для вашої моделі` |
| `Set effort level` | `Встановити рівень effort` |
| `OpenAI/Codex provider ({provider})` | `Постачальник OpenAI/Codex ({provider})` |
| `Active model - {provider} provider` | `Активна модель - постачальник {provider}` |
| `Effort not supported for this model` | `Effort не підтримується для цієї моделі` |
| `(current)` | `(поточний)` |

### 2.3 OutputStylePicker.tsx
**Файл:** `src/components/OutputStylePicker.tsx`

| Англійська | Українська |
|------------|------------|
| `Default` | `За замовчуванням` |
| `Completes coding tasks efficiently and provides concise responses` | `Ефективно виконує завдання з кодування та надає стислі відповіді` |
| `This changes how Neural Network communicates with you` | `Це змінює спосіб спілкування Neural Network з вами` |
| `Loading output styles...` | `Завантаження стилів виводу...` |
| `Preferred output style` | `Бажаний стиль виводу` |

### 2.4 LanguagePicker.tsx
**Файл:** `src/components/LanguagePicker.tsx`

| Англійська | Українська |
|------------|------------|
| `Enter your preferred response and voice language:` | `Введіть бажану мову для відповідей та голосу:` |
| `e.g., Japanese, Japanese, Espanol...` | `напр., українська, Deutsch, Español...` |
| `Leave empty for default (English)` | `Залиште порожнім для мови за замовчуванням (англійська)` |

## Пріоритет 3: Діалоги дозволів

### 3.1 PermissionDialog.tsx та пов'язані файли
**Файл:** `src/components/permissions/`

| Англійська | Українська |
|------------|------------|
| `Loading explanation...` | `Завантаження пояснення...` |
| `Low risk` | `Низький ризик` |
| `Med risk` | `Середній ризик` |
| `High risk` | `Високий ризик` |
| `Explanation unavailable` | `Пояснення недоступне` |
| `Esc to cancel` | `Esc для скасування` |
| `In plan mode, the model will:` | `У режимі планування модель:` |
| `Explore the codebase thoroughly` | `Детально дослідить кодову базу` |
| `Identify existing patterns` | `Визначить існуючі патерни` |
| `Design an implementation strategy` | `Розробить стратегію реалізації` |
| `Present a plan for your approval` | `Представить план для вашого схвалення` |
| `Would you like to proceed?` | `Ви хочете продовжити?` |
| `Plan saved!` | `План збережено!` |
| `Here is the plan:` | `Ось план:` |
| `Requested permissions:` | `Запитані дозволи:` |
| `Auto-approved` | `Авто-схвалено` |
| `Requires manual approval` | `Потребує ручного схвалення` |
| `Ctrl-D to hide debug info` | `Ctrl-D для приховування debug info` |
| `Ctrl+d to show debug info` | `Ctrl+d для показу debug info` |
| `Yes, allow reading from {dir}/ during this session` | `Так, дозволити читання з {dir}/ протягом цієї сесії` |
| `Yes, allow all edits in {dir}/ during this session` | `Так, дозволити всі зміни в {dir}/ протягом цієї сесії` |
| `{n}. Chat about this` | `{n}. Обговорити це` |
| `Skip interview and plan immediately` | `Пропустити інтерв'ю та відразу перейти до планування` |
| `Enter to select - {shortcut} - Esc to cancel` | `Enter для вибору - {shortcut} - Esc для скасування` |
| `Notes:` | `Примітки:` |
| `Submit` | `Надіслати` |
| `Waiting for team lead approval` | `Очікування схвалення team lead` |
| `Tool: ` | `Інструмент: ` |
| `Action: ` | `Дія: ` |
| `Permission request sent to team '{teamName}' leader` | `Запит дозволу надіслано лідеру команди '{teamName}'` |

## Пріоритет 4: Інші критичні компоненти

### 4.1 Doctor.tsx
**Файл:** `src/screens/Doctor.tsx`

| Англійська | Українська |
|------------|------------|
| `Failed to fetch versions` | `Не вдалося завантажити версії` |
| `Stable version: {version}` | `Стабільна версія: {version}` |
| `Latest version: {version}` | `Остання версія: {version}` |
| `Neural Network diagnostics dismissed` | `Діагностика Нейромережі закрита` |
| `Checking installation status...` | `Перевірка статусу встановлення...` |
| `Diagnostics` | `Діагностика` |
| `OK` | `OK` |
| `Not working` | `Не працює` |
| `bundled` | `вбудована` |
| `vendor` | `vendor` |
| `Recommendation: {text}` | `Рекомендація: {text}` |
| `Warning: Multiple installations found` | `Попередження: Знайдено кілька встановлень` |
| `Invalid Settings` | `Невірні налаштування` |
| `Updates` | `Оновлення` |
| `Managed by package manager` | `Керується менеджером пакетів` |
| `Update permissions: Yes` | `Оновити дозволи: Так` |
| `No (requires sudo)` | `Ні (потребує sudo)` |
| `Auto-update channel: {channel}` | `Канал авто-оновлення: {channel}` |
| `Environment Variables` | `Змінні середовища` |
| `Version Locks` | `Блокування версій` |
| `Cleaned {n} stale lock(s)` | `Очищено {n} застарілих блокувань` |
| `No active version locks` | `Немає активних блокувань версій` |
| `Agent Parse Errors` | `Помилки парсингу Agent` |
| `Failed to parse {n} agent file(s):` | `Не вдалося пропарсити {n} файл(ів) agent:` |
| `Plugin Errors` | `Помилки плагінів` |
| `{n} plugin error(s) detected:` | `Виявлено {n} помилку(ок) плагінів:` |
| `Unreachable Permission Rules` | `Недоступні правила дозволів` |
| `Context Usage Warnings` | `Попередження про використання контексту` |

### 4.2 Settings.tsx
**Файл:** `src/components/Settings/Settings.tsx`

| Англійська | Українська |
|------------|------------|
| `Status dialog dismissed` | `Діалог статусу закрито` |
| `Status` | `Статус` |
| `Config` | `Конфіг` |
| `Usage` | `Використання` |
| `Gates` | `Gates` |

### 4.3 HelpV2/General.tsx
**Файл:** `src/components/HelpV2/General.tsx`

| Англійська | Українська |
|------------|------------|
| `Neural Network understands your codebase, makes edits with your permission, and executes commands - right from your terminal.` | `Нейромережа розуміє вашу кодову базу, вносить зміни з вашого дозволу та виконує команди - прямо з вашого терміналу.` |
| `Shortcuts` | `Шорткати` |

### 4.4 InterruptedByUser.tsx
**Файл:** `src/components/InterruptedByUser.tsx`

| Англійська | Українська |
|------------|------------|
| `Interrupted` | `Перервано` |
| `What to do instead?` | `Що робити натомість?` |

### 4.5 PressEnterToContinue.tsx
**Файл:** `src/components/PressEnterToContinue.tsx`

| Англійська | Українська |
|------------|------------|
| `Press Enter to continue...` | `Натисніть Enter для продовження...` |

### 4.6 CompactSummary.tsx
**Файл:** `src/components/CompactSummary.tsx`

| Англійська | Українська |
|------------|------------|
| `Summarized conversation` | `Сконцентрована розмова` |
| `Summarized {n} messages` | `Концентровано {n} повідомлень` |
| `up to this point` | `до цього моменту` |
| `from this point` | `з цього моменту` |
| `Context: '{userContext}'` | `Контекст: '{userContext}'` |

### 4.7 ResumeConversation.tsx
**Файл:** `src/screens/ResumeConversation.tsx`

| Англійська | Українська |
|------------|------------|
| `Failed to resume conversation.` | `Не вдалося відновити розмову.` |
| `Choose a different conversation to continue.` | `Оберіть іншу розмову для продовження.` |
| `No conversations found to resume.` | `Не знайдено розмов для відновлення.` |
| `Press Ctrl+C to exit and start a new conversation.` | `Натисніть Ctrl+C для виходу та початку нової розмови.` |
| `(Command copied to clipboard)` | `(Команду скопійовано в буфер обміну)` |

## Пріоритет 5: CLI команди

### 5.1 CLI commands output
**Файли:** `src/commands/*/`

Перевірити всі команди в `src/commands/` на наявність англійських повідомлень:
- `help/help.tsx`
- `doctor/doctor.tsx`
- `config/config.tsx`
- `mcp/mcp.tsx`
- `model/model.tsx`
- `permissions/permissions.tsx`
- `output-style/output-style.tsx`
- `theme/theme.tsx`
- `vim/vim.tsx`
- `usage/usage.tsx`
- `status/index.tsx`

---

## Інструкції для виконання

1. **Почніть з Пріоритету 1** - це найбільш видимі екрани для користувача
2. **Використовуйте існуючі переклади** - звертайтеся до `StartupProviderWizard.tsx` як прикладу
3. **Зберігайте змінні** - `{variable}` не перекладаються
4. **Консистентність термінології**:
   - `provider` → `постачальник`
   - `model` → `модель`
   - `session` → `сесія`
   - `terminal` → `термінал`
   - `settings` → `налаштування`
   - `key` → `ключ`
   - `permission` → `дозвіл`
   - `task` → `завдання`
   - `team` → `команда`
   - `plan mode` → `режим планування`
   - `fast mode` → `швидкий режим`

5. **Технічні терміни** можна залишати англійськими якщо:
   - Це назви команд (`/help`, `/model`)
   - Це назви функцій або параметрів
   - Не існує загальноприйнятого українського еквівалента

---

## Статус виконання

- [ ] Пріоритет 1: StartupModelPicker.tsx
- [ ] Пріоритет 1: Onboarding.tsx
- [ ] Пріоритет 1: ModelPicker.tsx
- [ ] Пріоритет 1: PromptInputFooterLeftSide.tsx
- [ ] Пріоритет 1: PromptInputHelpMenu.tsx
- [ ] Пріоритет 2: ThemePicker.tsx
- [ ] Пріоритет 2: EffortPicker.tsx
- [ ] Пріоритет 2: OutputStylePicker.tsx
- [ ] Пріоритет 2: LanguagePicker.tsx
- [ ] Пріоритет 3: permissions/ (всі файли)
- [ ] Пріоритет 4: Doctor.tsx
- [ ] Пріоритет 4: Settings.tsx
- [ ] Пріоритет 4: HelpV2/General.tsx
- [ ] Пріоритет 4: Інші діалоги
- [ ] Пріоритет 5: CLI команди
