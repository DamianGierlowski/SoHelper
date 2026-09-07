# Daily Quest Manager — specyfikacja v1

Cel: wiedzieć, które questy można wziąć **teraz**, bez pamiętania o niczym.

## Ustalenia

- **Interfejs jest po angielsku** — cały tekst widoczny dla użytkownika, łącznie
  z komunikatami błędów rzucanymi w procesie głównym (trafiają do paska błędu w UI).
  Komentarze w kodzie i ta dokumentacja zostają po polsku.

- Aplikacja obsługuje **wiele profili (postaci)**. Każda postać ma własną historię wzięć.
- Quest ma: nazwę, NPC-ta który go daje, lokalizację, długość cooldownu.
- **Cooldown liczy się od momentu wzięcia** questa, nie od oddania.
  Wzięty o 8:00 przy cooldownie 24 h → następny raz o 8:00 następnego dnia.
  Kiedy quest faktycznie skończysz, nie ma znaczenia i tego nie zapisujemy.
- Rejestrujemy **wyłącznie zdarzenie „wziąłem"**. Brak stanu „w trakcie", brak oddawania.
- Wzięcie zapisujesz albo jednym kliknięciem („teraz"), albo wskazując datę i godzinę wstecz.
- Lokacje są wbudowane (18, przeniesione z poprzedniego helpera). **Questy i NPC-tów
  dodaje użytkownik sam** — nie dowozimy gotowej bazy.

## Model danych

```
profiles[]   id, nick, createdAt
locations[]  id, name, nameRu, timezone          ← wbudowane, src/shared/locations.json
npcs[]       id, name, locationId                ← dodaje użytkownik
quests[]     id, name, npcId, cooldownMinutes    ← dodaje użytkownik
takes[]      id, profileId, questId, takenAt     ← log zdarzeń
```

Lokalizacja questa wynika z NPC-ta (`quest → npc → location`), nie jest osobnym polem.
Dzięki temu nie da się zapisać questa stojącego w dwóch miejscach naraz. Jeśli okaże się,
że quest bywa *dawany* gdzie indziej niż *wykonywany*, dołożymy drugie pole wtedy.

`takes` to log zdarzeń, nie pole `lastTakenAt` na queście. Kosztuje tyle samo, a daje
za darmo cofanie (usuń ostatnie zdarzenie — wraca poprzednie), historię i statystyki.

### Stan wyliczany, nie zapisywany

```
lastTake  = max(takes[profil, quest].takenAt)
nextAt    = lastTake + cooldownMinutes
dostępny  = nextAt <= teraz
```

Nic o dostępności nie trafia na dysk. Stan nie może się rozjechać z danymi, bo nie istnieje
osobno — jest funkcją czystą z logu i aktualnego czasu.

## Zasady dla liczników

**Odliczanie zawsze z timestampów, nigdy dekrementacją.** Laptop idzie w sen; licznik
zmniejszany co sekundę obudzi się spóźniony o tyle, ile trwał sen. Zapisujemy `takenAt`
jako epoch ms UTC i przy każdym ticku liczymy `nextAt - Date.now()`.

**Jeden interwał 1 s na całą listę**, nie po jednym na wiersz. Przy 30 questach 30 osobnych
`setInterval` to 30 przerenderowań na sekundę zamiast jednego.

**Po wybudzeniu wymuszamy przeliczenie** — Electron `powerMonitor` event `resume`, żeby lista
nie czekała do następnego ticku z nieaktualnymi danymi.

## Otwarte, świadomie odłożone

- **Granica doby.** Statystyki typu „zrobione dziś", „postęp dnia", „seria dni" wymagają
  decyzji, kiedy zaczyna się doba (reset serwera vs. lokalna północ). W v1 ich nie ma.
- **Powiadomienia** systemowe, gdy quest się odnowi — naturalne rozwinięcie, poza v1.
- **Strefy czasowe lokacji** — dane są w `locations.json` (`timezone`), na razie nieużywane.

## Zakres v1

1. Zarządzanie profilami: dodaj, przełącz, zmień nazwę, usuń. Postać to sam nick —
   frakcja i poziom nic nie wnosiły, a były kolejnym polem do wypełnienia.
2. CRUD NPC-tów (nazwa + lokacja z wbudowanej listy).
3. CRUD questów (nazwa + NPC + cooldown).
4. Lista questów aktywnego profilu: status, odliczanie, sortowanie „najbliższe do odnowy".
5. Akcje: „Wziąłem teraz", wzięcie wstecz (data + godzina), „Cofnij".
6. Filtry: szukajka, lokalizacja, NPC, segment wszystkie/dostępne/cooldown.

## Persystencja

**SQLite przez wbudowany moduł `node:sqlite`** (Electron 44 = Node 24), plik
`sohelper.db` w `app.getPath('userData')`. Zero zależności i zero kompilacji —
odpada cały koszt `better-sqlite3` (przebudowa pod ABI Electrona, prebuildy per
platforma, packaging). Baza chodzi w WAL, z włączonymi kluczami obcymi.

Właścicielem bazy jest proces główny. Renderer nie dotyka dysku — komunikacja przez
IPC `invoke/handle` na `contextBridge`, zgodnie z `sandbox: true`.

### Schemat

```sql
settings(key, value)
profiles(id, nick, created_at)
npcs(id, name, location_id)
quests(id, name, npc_id → npcs ON DELETE RESTRICT, cooldown_minutes)
takes(id, profile_id → profiles CASCADE, quest_id → quests CASCADE, taken_at)
INDEX takes(profile_id, quest_id, taken_at DESC)
```

Reguły kasowania są celowo niesymetryczne:

- usunięcie **profilu** lub **questa** kasuje kaskadą jego wzięcia — to dane bez
  wartości w oderwaniu od właściciela,
- usunięcie **NPC-ta** z questami jest **odrzucane** (`RESTRICT`) — kasowanie questów
  przy okazji byłoby cichą utratą danych. Aplikacja mówi ile ich jest i każe zdecydować.

Lokacje **nie są w bazie**. Są statyczne i dowożone z aplikacją
(`src/shared/locations.json`, wbudowane w bundle), więc należą do repo, nie do bazy
stanu użytkownika. Baza trzyma wyłącznie to, co użytkownik zmienia.

### Migracje

`PRAGMA user_version` + ponumerowane kroki w `src/main/db/migrations.mts`. Każdy krok
leci w transakcji — nieudana migracja cofa się w całości. Baza w wersji nowszej niż
aplikacja **odmawia startu** zamiast dać się popsuć starszemu kodowi.

### Warstwa danych jest wolna od Electrona

`src/main/db/*.mts` nie importuje niczego z `electron`, więc chodzi na czystym Node
i da się ją testować bez uruchamiania aplikacji: `npm run test:db`.
Rozszerzenie `.mts` jest tu istotne — `package.json` ma `type: commonjs`, więc bez
niego Node nie załadowałby tych plików jako modułów ES.
