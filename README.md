# Fantasy — Пошаговая стратегия в стиле Средиземья

## Описание

Прототип пошаговой стратегии, **в основу которого легла** классическая игра [**Fantasy Empires**](https://en.wikipedia.org/wiki/Fantasy_Empires) (1993, Silicon Knights / SSI). Действие разворачивается в мире Средиземья. Игроки управляют королевствами, состоящими из земель, на которых можно строить здания и производить юнитов (войска и героев) для расширения владений и боёв.

Исполняемое приложение — **Spring Boot** с **REST API** и in-memory хранилищем миров. Пакет `gui` пока пустой (интерфейса нет).

---

## Технологии и сборка

- **Java 17**
- **Spring Boot 3.4** (`spring-boot-starter-web`, validation)
- **Gradle** (корневой проект + подмодуль `fantasy.server`)
- **Lombok** (compile-only)

```bash
# Сборка
./gradlew build

# Тесты
./gradlew test
```

---

## Модули Gradle

| Модуль | Назначение |
|--------|------------|
| **Корень (`fantasy`)** | Домен, application layer, REST, in-memory репозиторий, точка входа `FantasyApplication` |
| **`fantasy.server`** | Отдельный Java-модуль без Spring: упрощённые классы `ru.lr.entity` (`World`, `Land`, `Building`, `Barrack`, `Wall`); **не** подключён к корневому Spring-приложению как зависимость |

---

## Архитектура кода (актуальная)

Основная логика игры для приложения живёт в **`ru.lr.domain`**. Поверх неё — гексагональные слои **application** и **infrastructure**.

```
ru.lr/
├── FantasyApplication.java          # Spring Boot
├── domain/                          # Доменная модель и доменные действия
│   ├── model/                       # World, Land, Player, Turn, Warrior, WorldFactory, здания…
│   │   ├── building/
│   │   └── visitors/
│   └── action/                      # IGameAction, BuildBuildingAction, NewRecruitsAction,
│                                    # WarriorsMoveInAction, WarriorsMoveOutAction
├── application/                     # Слой приложения
│   ├── port/
│   │   ├── input/                  # WorldUseCase, LandUseCase, TurnUseCase
│   │   └── output/                  # WorldRepository
│   └── service/                     # WorldService, LandService, TurnService
├── infrastructure/
│   ├── adapter/
│   │   ├── persistence/             # InMemoryWorldRepository
│   │   └── rest/                    # WorldController, LandController, TurnController + DTO запросов
│   └── config/                      # AppConfig
├── entity/                          # Легаси: дублирует предметную модель (см. ниже)
├── action/                          # Легаси: дублирует действия из domain.action
└── gui/                             # Заглушка под UI (файлов нет)
```

### Легаси-пакеты `entity` и `action`

В исходниках параллельно существуют **`ru.lr.entity.*`** и **`ru.lr.action.*`** — это более ранняя копия модели и действий. **Тесты** (`src/test/java/ru/lr/entity`, `ru/lr/action`) всё ещё импортируют эти пакеты.

**Слой Spring и REST использует только `ru.lr.domain`.** При разработке новых фич ориентироваться на `domain`; со временем имеет смысл перевести тесты на `domain` и убрать дублирование.

---

## Хранение миров

- Интерфейс **`WorldRepository`** (выходной порт).
- Реализация **`InMemoryWorldRepository`**: потокобезопасная `Map`, идентификаторы миров — **`Long`**, выдаются последовательно при первом `save`.

У **сущностей внутри мира** в домене также есть идентификаторы, где применимо: например, **`World.id`**, **`Land.id`** (при генерации карты задаются из порядкового номера клетки).

---

## Основные сущности домена (`ru.lr.domain.model`)

Ниже — схема полей по коду (без полного повторения всех методов).

### Player

```java
public class Player {
    private Long id;
    private int level;
    private String name;
}
```

### Land

```java
public class Land implements Comparable<Land> {
    private Long id;
    private String name;
    private int costs;
    private Player player;
    private Buildings buildings;
    private List<Warrior> warriors;
    private List<WarriorType> accessBuildWarriorTypes;
    private List<Land> neighboring;
}
```

Клетки соединяются с соседями по **4 сторонам** (сетка в `WorldFactory`).

### Warrior

```java
public class Warrior {
    private WarriorType type;
    private int count;
    private int level;
}
```

### WarriorType

Перечисление совпадает по смыслу с прежним описанием: обычные юниты (`hero = false`) и герои (`hero = true`). Имена констант в Java: **`FIGHTER`**, **`ORC`**, … — именно **они** нужны в JSON для REST (см. `WarriorType.valueOf(...)`).

### World

```java
public class World {
    private Long id;
    private List<Land> lands;
    private Dimension size;   // java.awt.Dimension: width = sizeX, height = sizeY
    private Turn turn;        // очередь хода; при создании мира инициализируется в конструкторе
    public Turn getTurn();   // лениво создаёт Turn, если null (например после десериализации)
}
```

Ключевые операции: `warriorsMoveIn`, `warriorsMoveOut`, `buildBuilding`, `battle`, `newRecruits`, `getLand`, `getPlayerLands`.

### Turn (`ru.lr.domain.model.Turn`)

```java
public class Turn {
    private Long id;
    private int turnNumber;
    private World world;              // в JSON не сериализуется (@JsonIgnore)
    private Deque<IGameAction> actionOfTurn;  // в JSON не сериализуется; см. pendingActionsCount
    int getPendingActionsCount();     // размер очереди для API
    // acceptAction(IGameAction) — hot: сразу action(); иначе в очередь
    // doTurn() — по одному шагу отложенных действий, незавершённые возвращаются в очередь
}
```

### WorldFactory

```java
public class WorldFactory {
    public WorldFactory(Player... players);
    public World create(int sizeX, int sizeY);
}
```

- Минимальный размер поля: **2×2** (`IllegalArgumentException` с сообщением `Минимальные размеры поля 2x2`).
- Если переданы игроки, на **случайных свободных** землях выставляется `setPlayer(...)` (отдельного автодобавления замков фабрика не делает).
- Каждая земля изначально получает доступ к найму **`WarriorType.FIGHTER`**.

**`WorldService.createWorld(sizeX, sizeY)`** вызывает **`new WorldFactory()`** без игроков: все земли без владельца, «нейтральные». Метод **`createWorldWithPlayers`** принимает игроков и использует ту же фабрику с ними (в REST пока не выведен отдельный endpoint).

---

## Здания (`ru.lr.domain.model.building`)

Иерархия как в модели: **`Building`** → `CastleBuilding`, `BarrackBuilding`, `WallBuilding`, `ClericCastleBuilding`, `MagicCastleBuilding`.

**`Buildings`** ограничивает число строений (в т.ч. `MAX_BUILDINGS = 6`), ведёт счётчики казарм / магического и клерикского замков, уровень стен (`WallLevel`) и флаги вроде `canBuildMagicCastle` / `canBuildClericCastle` (см. код класса).

Паттерн **Visitor**: `IBuildingVisitor`, `BuildingVisitorNewBuilding` в `domain.model.visitors`.

---

## Действия (`ru.lr.domain.action`)

Интерфейс **`IGameAction`**: `boolean action()`, `boolean hot()`.

| Класс | `hot()` | Назначение |
|--------|---------|------------|
| **BuildBuildingAction** | `true` | Построить здание через `world.buildBuilding` |
| **WarriorsMoveOutAction** | `true` | Вывести войска с земли |
| **WarriorsMoveInAction** | `false` | Отложенный «приход» на землю с обратным отсчётом `turnCount` |
| **NewRecruitsAction** | `false` | Отложенный набор юнитов с обратным отсчётом `turnCount` |

---

## Слой приложения и REST

### Сервисы

- **`WorldService`** — создание/чтение/список/удаление мира, `getPlayerLands`, сохранение.
- **`LandService`** — земли, соседи, стройка, набор, перемещение войск.
- **`TurnService`** — «текущий ход» и выполнение `doTurn()`.

### Поведение API и очередь хода

У каждого **`World`** один объект **`Turn`** (`world.getTurn()`), тот же экземпляр возвращает **`TurnService.getCurrentTurn`** и обрабатывает **`TurnService.executeTurn`**.

**`LandService`** не вызывает `world.buildBuilding` / `newRecruits` / `warriorsMoveIn|Out` напрямую для сценариев REST: все операции проходят через **`world.getTurn().acceptAction(...)`**:

| Операция REST | Действия |
|---------------|----------|
| Строительство | **`BuildBuildingAction`** (`hot` — выполняется сразу внутри `acceptAction`) |
| Найм | **`NewRecruitsAction`** (отложено; параметр **`turnCount`** ≥ 1, по умолчанию 1) |
| Перемещение | **`WarriorsMoveOutAction`** (hot, сразу) затем **`WarriorsMoveInAction`** (отложено; **`turns`** из тела запроса, по умолчанию 1) |

Чтобы **завершить шаг** по отложенным действиям (и увеличить `turnNumber`), клиент вызывает **`POST /api/worlds/{worldId}/turns/execute`** (`Turn.doTurn()` + сохранение мира).

В ответе **`Turn`** в JSON доступны, в частности, `turnNumber` и **`pendingActionsCount`** (размер очереди); сами объекты `IGameAction` клиенту не отдаются.

### HTTP API (базовый префикс зависит от развёртывания; в коде — относительные пути)

**Миры** — `WorldController` → `@RequestMapping("/api/worlds")`

| Метод | Путь | Описание |
|--------|------|----------|
| `GET` | `/api/worlds` | Список миров |
| `GET` | `/api/worlds/{id}` | Мир по id |
| `POST` | `/api/worlds` | Создать мир; тело **`CreateWorldRequest`**: `sizeX`, `sizeY` (мин. 2) |
| `DELETE` | `/api/worlds/{id}` | Удалить мир |

**Земли** — `LandController` → `@RequestMapping("/api/worlds/{worldId}/lands")`

| Метод | Путь | Описание |
|--------|------|----------|
| `GET` | `.../lands` | Все земли мира |
| `GET` | `.../lands/{landId}` | Одна земля |
| `GET` | `.../lands/{landId}/neighbors` | Соседи |
| `POST` | `.../lands/{landId}/build` | Строительство; **`BuildBuildingRequest`**: `buildingType`, опционально `wallLevel` для стены |
| `POST` | `.../lands/{landId}/recruit` | Найм; **`RecruitRequest`**: `warriorType` (**имя enum**, напр. `FIGHTER`), `count`, опционально **`turnCount`** (≥ 1, по умолчанию 1) |
| `POST` | `.../lands/{fromLandId}/move` | Перемещение; **`MoveWarriorsRequest`**: `toLandId`, список `{ type, count, level? }`, опционально **`turns`** (≥ 1, по умолчанию 1) для `WarriorsMoveInAction` |

Значения **`buildingType`** (строка, регистр как в `switch`): `CASTLE`, `BARRACK`, `WALL`, `MAGIC_CASTLE`, `CLERIC_CASTLE`. Для **`WALL`**: `wallLevel` — индекс в **`WallLevel.values()`** (0…3).

**Ход** — `TurnController` → `@RequestMapping("/api/worlds/{worldId}/turns")`

| Метод | Путь | Описание |
|--------|------|----------|
| `GET` | `.../turns/current` | Текущий `Turn` мира (`turnNumber`, `pendingActionsCount`, …) |
| `POST` | `.../turns/execute` | `Turn.doTurn()` для очереди этого мира и сохранение |

Ответы сейчас отдают **доменные** объекты (`World`, `Land`, `Turn`) как JSON: у **`Land`** есть ссылки **`neighboring`** на другие `Land` — клиентам может понадобиться контроль сериализации (DTO / `@JsonIdentityInfo`), чтобы избежать циклов и лишнего объёма.

---

## Боевая система

Реализация **`World.battle`**: взаимные потери по парам защитник/атакующий через `Math.min(counts)`, затем при ненулевом остатке атакующих — смена владельца и `warriorsMoveIn` (см. исходник).

---

## Незавершённые и спорные места

- **`Hero`**: есть в **`ru.lr.entity`**, в **`domain`** отдельного класса нет.
- **`ClericCastleBuilding` / `MagicCastleBuilding`**: в **domain** `acceptBuildingVisitor` реализованы; легаси-классы в `entity` могут отличаться — смотреть актуальный **`ru.lr.domain.model.building`**.
- **GUI**: не реализован.

---

## Тесты (текущее расположение)

```
src/test/java/ru/lr/
├── action/          # BuildBuildingActionTest, WarriorsMoveIn/OutActionTest → пакет ru.lr.entity
└── entity/          # TurnTest, WorldFactoryTest → ru.lr.entity
```

Планомерно желательно перевести тесты на **`ru.lr.domain`**, чтобы они проверяли тот же код, что и приложение.

---

## Схема взаимодействий (упрощённо)

```
┌──────────────────────────────────────────────┐
│ World (id, lands, size, turn)               │
│  Turn — очередь IGameAction                  │
│  Land ── Land … (neighboring, player, …)    │
└──────────────────────────────────────────────┘
         ▲
         │ сохранение
┌────────┴────────┐     ┌─────────────────────┐
│ WorldRepository │ ←── │ WorldService,        │
│ (in-memory)     │     │ LandService,         │
└─────────────────┘     │ TurnService          │
                        └──────────┬──────────┘
                                   │
                        ┌──────────┴──────────┐
                        │ REST controllers    │
                        └─────────────────────┘
```

**`LandService`** ставит действия в очередь через **`world.getTurn().acceptAction`**; **`TurnService.executeTurn`** вызывает **`doTurn`** для этой же очереди.
