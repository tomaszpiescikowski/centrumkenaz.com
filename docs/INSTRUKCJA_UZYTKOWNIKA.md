# Instrukcja Obsługi Kenaz – Przewodnik Użytkownika
### Kompletny przewodnik dla zwykłego użytkownika aplikacji

---

> **Wersja dokumentu:** 2.0  
> **Data:** luty 2026  
> **Dotyczy:** aplikacja webowa i PWA Kenaz Centrum

---

## Spis treści

**Część I – Pierwsze kroki**

1. [Czym jest Kenaz?](#1-czym-jest-kenaz)
2. [Rejestracja i logowanie](#2-rejestracja-i-logowanie)
3. [Strona główna](#3-strona-główna)
4. [Oczekiwanie na akceptację konta](#4-oczekiwanie-na-akceptację-konta)
5. [Ustawienia i język interfejsu](#5-ustawienia-i-język-interfejsu)

**Część II – Główne funkcje aplikacji**

6. [Kalendarz wydarzeń](#6-kalendarz-wydarzeń)
7. [Szczegóły wydarzenia](#7-szczegóły-wydarzenia)
8. [Rejestracja na wydarzenie](#8-rejestracja-na-wydarzenie)
9. [Płatność za wydarzenie](#9-płatność-za-wydarzenie)
10. [Lista oczekujących (waitlist)](#10-lista-oczekujących-waitlist)
11. [Chat i komentarze](#11-chat-i-komentarze)

**Część III – Moje konto**

12. [Panel – moje aktywności](#12-panel--moje-aktywności)
13. [Profil użytkownika i ustawienia konta](#13-profil-użytkownika-i-ustawienia-konta)
14. [Plany i subskrypcje](#14-plany-i-subskrypcje)
15. [Publiczny profil użytkownika](#15-publiczny-profil-użytkownika)

**Część IV – Pozostałe strony**

16. [Wesprzyj nas – darowizny](#16-wesprzyj-nas--darowizny)
17. [O nas](#17-o-nas)
18. [Polityka prywatności i Regulamin](#18-polityka-prywatności-i-regulamin)

**Część V – Dodatki**

19. [Aplikacja mobilna (PWA)](#19-aplikacja-mobilna-pwa)
20. [Tryb ciemny i jasny](#20-tryb-ciemny-i-jasny)
21. [Powiadomienia i komunikaty systemowe](#21-powiadomienia-i-komunikaty-systemowe)
22. [Często zadawane pytania (FAQ)](#22-często-zadawane-pytania-faq)
23. [Słownik pojęć](#23-słownik-pojęć)

---

---

# CZĘŚĆ I – PIERWSZE KROKI

---

## 1. Czym jest Kenaz?

**Kenaz Centrum** to platforma społecznościowa dla aktywnej społeczności lokalnej. Aplikacja umożliwia:

- przeglądanie i zapisywanie się na **wydarzenia** (treningi, warsztaty, wycieczki i inne aktywności),
- komunikowanie się z uczestnikami za pomocą **wbudowanego chatu**,
- zarządzanie własną **subskrypcją** i historią rejestracji,
- wspieranie centrum poprzez **darowizny** na stronie „Wesprzyj nas".

### 1.1 Jak używać tej instrukcji?

Każdy rozdział opisuje **jedną stronę lub funkcję** aplikacji. Przy każdym opisie znajdziesz:

- **Adres URL** danej strony (np. `/calendar`),
- **Kto ma dostęp** do tej strony,
- **Opis funkcji** krok po kroku,
- **Wskazówki** i **ważne uwagi**.

---

## 2. Rejestracja i logowanie

**Adres:** `/login`  
**Dostęp:** wszyscy (w tym niezalogowani)

### 2.1 Jak zalogować się do Kenaz?

Kenaz używa wyłącznie logowania przez **Google**. Aby skorzystać z aplikacji:

1. Otwórz stronę główną aplikacji lub przejdź bezpośrednio pod adres `/login`.
2. Kliknij przycisk **„Zaloguj się przez Google"**.
3. Zostaniesz przekierowany do strony logowania Google. Wybierz swoje konto lub zaloguj się danymi Google.
4. Po pierwszym zalogowaniu Twoje konto zostanie automatycznie **zarejestrowane** w systemie Kenaz.
5. Zostaniesz przekierowany z powrotem do aplikacji.

> **Ważne:** Przy pierwszym logowaniu konto trafia do statusu **„Oczekujące na akceptację"**. Korzystanie z pełnych funkcji aplikacji (kalendarza, chatu, rejestracji na wydarzenia) będzie możliwe dopiero po zatwierdzeniu konta przez administratora. Więcej na ten temat w [rozdziale 4](#4-oczekiwanie-na-akceptację-konta).

### 2.2 Hasła i resetowanie

Kenaz nie używa haseł – logowanie odbywa się wyłącznie przez Google. Jeśli nie pamiętasz hasła do swojego konta Google, skorzystaj z opcji odzyskiwania konta dostępnej bezpośrednio na stronie Google.

### 2.3 Wylogowanie

Aby wylogować się z aplikacji:

1. Przejdź do strony **„Moje konto"** (ikona osoby w nawigacji lub adres `/me`).
2. Przewiń stronę na dół.
3. Kliknij przycisk **„Wyloguj się"**.

Po wylogowaniu zostaniesz przekierowany na stronę główną. Twoje dane i rejestracje pozostaną zapisane w systemie.

---

## 3. Strona główna

**Adres:** `/`  
**Dostęp:** wszyscy (w tym niezalogowani)

### 3.1 Co zobaczysz na stronie głównej?

Strona główna to **punkt startowy** aplikacji. Jej układ jest celowo prosty – w centrum ekranu widnieje logo Kenaz Centrum, a poniżej trzy przyciski:

- **„Zaloguj się"** – prowadzi do strony logowania (`/login`), gdzie możesz zalogować się przez Google.
- **„O nas"** – prowadzi do strony z informacjami o organizacji (`/about`).
- **„Wesprzyj nas"** – prowadzi do strony darowizn (`/support`), gdzie możesz wesprzeć finansowo centrum nawet bez posiadania konta.

Strona główna jest zaprojektowana zarówno pod kątem urządzeń mobilnych, jak i desktopowych. Logo i przyciski automatycznie dostosowują swój rozmiar do ekranu.

### 3.2 Dla zalogowanych użytkowników

Zalogowani użytkownicy zazwyczaj nie odwiedzają strony głównej – aplikacja automatycznie kieruje ich do **kalendarza** (`/calendar`) po zalogowaniu. Strona główna służy głównie jako landing page dla nowych odwiedzających.

### 3.3 Tryb ciemny i jasny

Strona główna, podobnie jak cała aplikacja, obsługuje zarówno tryb jasny (domyślny dla większości urządzeń), jak i tryb ciemny. Możesz zmienić motyw w ustawieniach konta lub klikając odpowiedni przełącznik w pasku nawigacyjnym. Szczegóły w [rozdziale 20](#20-tryb-ciemny-i-jasny).

---

## 4. Oczekiwanie na akceptację konta

**Adres:** `/pending-approval`  
**Dostęp:** zalogowani użytkownicy ze statusem „oczekujące"

### 4.1 Dlaczego moje konto oczekuje na akceptację?

Kenaz to **zamknięta społeczność** – każde nowe konto musi zostać zatwierdzone przez administratora. Dzięki temu platforma zachowuje wysoki poziom bezpieczeństwa i spójności grupy.

Po pierwszym zalogowaniu przez Google Twoje konto automatycznie trafia do kolejki oczekujących. Administrator widzi Twoje imię, adres e-mail oraz datę rejestracji.

### 4.2 Co widzę w czasie oczekiwania?

Podczas oczekiwania na akceptację:

- **Kalendarz** jest widoczny, ale **zamazany** – nie możesz przeglądać szczegółów wydarzeń.
- **Panel** (lista twoich rejestracji) jest widoczny, ale również zamazany i niedostępny.
- **Chat** jest niedostępny.
- Możesz przeglądać strony ogólne: **O nas**, **Wesprzyj nas**, **Politykę prywatności** i **Regulamin**.

Na ekranie pojawia się informacja, że konto oczekuje na akceptację, oraz prośba o cierpliwość.

### 4.3 Jak długo trwa akceptacja?

Czas akceptacji zależy od dostępności administratora. Zwykle odbywa się to w ciągu **1–2 dni roboczych**. Jeśli po dłuższym czasie konto nadal nie zostało zatwierdzone, skontaktuj się z organizacją.

### 4.4 Co się dzieje po akceptacji?

Po zatwierdzeniu konta przez administratora:

1. Przy kolejnym zalogowaniu zobaczysz **ekran powitalny** z możliwością wyboru planu subskrypcji.
2. Zostaniesz przekierowany do strony **Plany i subskrypcje** (`/plans?welcome=1`).
3. Możesz od razu wybrać plan lub wrócić do konta i zdecydować później.
4. Od tej chwili masz pełny dostęp do wszystkich funkcji aplikacji.

### 4.5 Blokada konta

Konto może zostać **zablokowane** przez administratora. W takim przypadku zostanie ono cofnięte do statusu „oczekującego" i wymagana będzie ponowna akceptacja. Zablokowany użytkownik nie ma dostępu do płatnych funkcji aplikacji.

---

## 5. Ustawienia i język interfejsu

### 5.1 Dostępne języki

Aplikacja Kenaz jest dostępna w kilku językach:

| Kod | Język |
|-----|-------|
| `pl` | Polski (domyślny) |
| `en` | English |
| `zh` | 中文 (chiński) |
| `nl` | Nederlands (niderlandzki) |
| `it` | Italiano (włoski) |
| `sl` | Ślōnski (śląski) |

### 5.2 Jak zmienić język?

Język możesz zmienić na stronie **Moje konto** (`/me`):

1. Przejdź do `/me`.
2. W sekcji ustawień znajdź **selektor języka**.
3. Wybierz preferowany język z listy.

Zmiana języka jest natychmiastowa i obowiązuje przez całą sesję oraz przy kolejnych odwiedzinach (ustawienie jest zapamiętywane w przeglądarce).

### 5.3 Jak zmienić miasto?

Na stronie konta możesz wybrać swoje **miasto**. Ustawienie to wpływa na wyświetlane wydarzenia – filtrując je do relewantnej lokalizacji.

1. Przejdź do `/me`.
2. W sekcji ustawień znajdź **selektor miasta**.
3. Wybierz swoje miasto z listy.

---

---

# CZĘŚĆ II – GŁÓWNE FUNKCJE APLIKACJI

---

## 6. Kalendarz wydarzeń

**Adres:** `/calendar`  
**Dostęp:** wszyscy (pełny dostęp tylko dla zalogowanych i zatwierdzonych użytkowników)

### 6.1 Ogólne informacje

Kalendarz jest **głównym centrum aplikacji**. Pokazuje wszystkie nadchodzące wydarzenia organizowane przez Kenaz – treningi, warsztaty, wykłady, wyjścia i wiele innych aktywności.

Dla użytkowników niezalogowanych lub oczekujących na akceptację kalendarz jest **widoczny, ale zamazany** – można zobaczyć ogólny zarys wydarzeń, ale nie można wchodzić w szczegóły ani rejestrować się.

### 6.2 Jak wygląda kalendarz?

Kalendarz wyświetla wydarzenia w widoku **miesięcznym lub tygodniowym** (zależnie od urządzenia i ustawień). Każdy dzień z wydarzeniami jest oznaczony. Możesz:

- **Przeglądać dni** – klikając w datę zobaczysz listę wydarzeń w tym dniu.
- **Nawigować między miesiącami** – strzałkami góra/dół lub lewo/prawo.
- **Klikać w wydarzenie** – aby przejść do szczegółów danego spotkania.

### 6.3 Oznaczenia wydarzeń na kalendarzu

Każde wydarzenie na kalendarzu może być oznaczone jedną z **ikon kategorii**. Ikony pojawiają się obok nazwy wydarzenia i informują o jego typie (np. karate, morsowanie, yoga).

### 6.4 Filtrowanie według miasta

Jeśli masz ustawione miasto w profilu, kalendarz może **automatycznie filtrować** wydarzenia do Twojej lokalizacji. Możesz też zmienić filtr bezpośrednio na stronie kalendarza.

### 6.5 Prywatność i blokada

Jeśli jesteś **niezalogowany**:
- Kalendarz jest widoczny, ale zamazany (blur).
- Kliknięcie w wydarzenie nic nie robi – formularz jest nieaktywny.
- Wyświetla się zachęta do zalogowania.

Jeśli Twoje konto **oczekuje na akceptację**:
- Sytuacja jest identyczna jak dla niezalogowanych – kalendarz jest niedostępny.
- Po zatwierdzeniu konta uzyskujesz pełny dostęp.

---

## 7. Szczegóły wydarzenia

**Adres:** `/event/:id`  
**Dostęp:** zalogowani i zatwierdzeni użytkownicy

### 7.1 Jak otworzyć szczegóły wydarzenia?

Aby zobaczyć szczegóły konkretnego wydarzenia:

1. Przejdź do kalendarza (`/calendar`).
2. Kliknij w datę, aby zobaczyć listę wydarzeń danego dnia.
3. Kliknij w nazwę wybranego wydarzenia.
4. Zostaniesz przekierowany na stronę ze szczegółami: `/event/:id`.

### 7.2 Co zawiera strona szczegółów?

Strona szczegółów wydarzenia zawiera:

| Sekcja | Opis |
|--------|------|
| **Tytuł i ikona** | Nazwa wydarzenia z ikoną kategorii |
| **Data i godzina** | Dokładna data, godzina rozpoczęcia (i ewentualnie zakończenia) |
| **Miasto i lokalizacja** | Miejsce spotkania; przycisk „Otwórz w Google Maps" |
| **Opis** | Szczegółowy opis aktywności |
| **Cena** | Cena dla gości lub informacja o bezpłatności |
| **Dostępność miejsc** | Liczba wolnych miejsc lub informacja o zapełnieniu |
| **Uczestnicy** | Lista potwierdzonych uczestników (imiona i awatary) |
| **Lista oczekujących** | Osoby na liście oczekujących (jeśli brak miejsc) |
| **Przycisk rejestracji** | Zapis, anulowanie zapisu lub informacja o statusie |
| **Komentarze** | Sekcja komentarzy i dyskusji pod wydarzeniem |
| **Google Calendar** | Przycisk dodania do własnego Google Calendar |

### 7.3 Dwie ceny – dla gości i dla członków

Przy wydarzeniach płatnych możesz zobaczyć **dwie ceny**:

- **Cena dla gości** – standardowa cena dla wszystkich uczestników bez subskrypcji.
- **Cena dla członków** – obniżona cena dla osób z aktywną subskrypcją Kenaz.

> **Wskazówka:** Jeśli regularnie uczestniczysz w wydarzeniach, opłaca się rozważyć wykupienie subskrypcji – ceny dla członków są zazwyczaj znacznie niższe lub zerowe.

### 7.4 Dodanie do Google Calendar

Na stronie szczegółów wydarzenia znajdziesz przycisk **„Dodaj do Google Calendar"**. Kliknięcie go otworzy nową kartę z formularzem Google Calendar, gdzie możesz zapisać wydarzenie w swoim kalendarzu z automatycznie uzupełnioną datą, godziną i lokalizacją.

### 7.5 Komentarze pod wydarzeniem

Każde wydarzenie posiada **sekcję komentarzy**, gdzie uczestnicy i inne zainteresowane osoby mogą zadawać pytania, komentować i rozmawiać. Szczegółowy opis systemu komentarzy znajdziesz w [rozdziale 11](#11-chat-i-komentarze).

---

## 8. Rejestracja na wydarzenie

**Adres:** `/event/:id`  
**Dostęp:** zalogowani i zatwierdzeni użytkownicy

### 8.1 Jak zapisać się na wydarzenie?

1. Przejdź na stronę szczegółów wybranego wydarzenia.
2. Sprawdź dostępność miejsc (wyświetlona liczba wolnych miejsc lub komunikat o zapełnieniu).
3. Kliknij przycisk **„Zapisz się"**.
4. Jeśli wydarzenie jest **bezpłatne**: rejestracja zostanie potwierdzona natychmiast. Zobaczysz komunikat sukcesu.
5. Jeśli wydarzenie jest **płatne**: zostaniesz przekierowany do procesu płatności (patrz [rozdział 9](#9-płatność-za-wydarzenie)).

### 8.2 Stany rejestracji

Twoja rejestracja może mieć jeden z następujących statusów:

| Status | Znaczenie |
|--------|-----------|
| **Potwierdzony** | Jesteś zapisany i potwierdzony – masz zagwarantowane miejsce |
| **Oczekuje na płatność** | Zarejestrowany, ale płatność jeszcze nie została potwierdzona |
| **Lista oczekujących** | Brak miejsc – jesteś na liście i zostaniesz automatycznie przeniesiony, gdy zwolni się miejsce |
| **Anulowany** | Rejestracja została anulowana przez Ciebie lub administratora |

### 8.3 Jak anulować rejestrację?

Możesz anulować rejestrację na wydarzenie w dwóch miejscach:

**Ze strony szczegółów wydarzenia:**
1. Przejdź na `/event/:id`.
2. Kliknij przycisk **„Anuluj rejestrację"** (widoczny, gdy jesteś zapisany).
3. Potwierdź anulowanie w okienku dialogowym.

**Z panelu użytkownika:**
1. Przejdź do `/panel`.
2. Znajdź wydarzenie na liście swoich rejestracji.
3. Kliknij przycisk anulowania przy danym wydarzeniu.
4. Potwierdź w okienku dialogowym.

> **Uwaga przy anulowaniu płatnych rejestracji:** Jeśli zapłaciłeś za wydarzenie przelewem (płatność manualna), po anulowaniu zostaniesz poinformowany o warunkach ewentualnego zwrotu. Zwroty są procesowane przez administratora.

### 8.4 Limit uczestników i automatyczna kolejka

Każde wydarzenie może mieć **określony limit uczestników**. Gdy limit zostanie osiągnięty:

- Przycisk rejestracji zmieni się na **„Dołącz do listy oczekujących"**.
- Po zapisaniu się na listę oczekujących, system **automatycznie** Cię awansuje, gdy ktoś anuluje rejestrację.
- Dostaniesz automatyczne potwierdzenie nowego statusu przy kolejnym otwarciu aplikacji.

---

## 9. Płatność za wydarzenie

**Adresy:** `/event/:id`, `/manual-payment/:registrationId`  
**Dostęp:** zalogowani użytkownicy z aktywną rejestracją

### 9.1 Metody płatności

Kenaz obsługuje jedną metodę płatności za zapisy na события:

- **Przelew bankowy (płatność manualna)** – większość wydarzeń wymaga dokonania przelewu na podany numer konta i potwierdzenia go w aplikacji.

### 9.2 Przebieg płatności manualnej

Gdy rejestrujesz się na płatne wydarzenie:

1. Po kliknięciu **„Zapisz się"** system tworzy Twoją rejestrację ze statusem **„Oczekuje na potwierdzenie płatności"**.
2. Aplikacja pokazuje Ci **link do strony płatności** lub możesz przejść do `/manual-payment/:registrationId`.
3. Na stronie płatności zobaczysz:
   - **Numer konta** bankowego do przelewu.
   - **Tytuł przelewu** – podaj go dokładnie, aby administrator mógł zidentyfikować Twoją płatność.
   - **Kwotę do zapłaty**.
   - **Termin płatności** – deadline, do którego musisz dokonać przelewu.
4. Wykonaj przelew w swoim banku.
5. Wróć do aplikacji i kliknij **„Potwierdzam wykonanie przelewu"**.
6. Administrator weryfikuje wpłatę i akceptuje rejestrację.

> **Ważne:** Termin płatności jest automatycznie wyliczany przez system. Jeśli nie dokonasz przelewu i nie potwierdzisz go w wyznaczonym czasie, rejestracja może zostać automatycznie anulowana.

### 9.3 Strona potwierdzenia płatności

Pod adresem `/manual-payment/:registrationId` znajdziesz stronę ze szczegółami płatności. Strona ta zawiera:

- Informację o wydarzeniu, na które jesteś zapisany.
- Dane do przelewu (numer konta, tytuł, kwotę).
- Przycisk **„Potwierdzam wykonanie przelewu"** – kliknij go po dokonaniu przelewu.
- Status Twojej płatności (oczekująca / zweryfikowana).

### 9.4 Subskrypcja a ceny

Jeśli posiadasz aktywną **subskrypcję Kenaz**, automatycznie korzystasz z niższych cen lub możesz brać udział w bezpłatnych wydarzeniach dla subskrybentów. Więcej informacji o subskrypcjach w [rozdziale 14](#14-plany-i-subskrypcje).

---

## 10. Lista oczekujących (waitlist)

### 10.1 Jak działa lista oczekujących?

Gdy liczba zapisów na wydarzenie osiągnie **limit miejsc**, kolejne osoby automatycznie trafiają na **listę oczekujących**. Lista jest prowadzona w kolejności rejestracji (FIFO – kto pierwszy, ten lepszy).

### 10.2 Automatyczne awansowanie

System automatycznie awansuje pierwszą osobę z listy oczekujących, gdy:

- ktoś **anuluje** swoją rejestrację,
- administrator **ręcznie zrezygnuje** z miejsca uczestnika.

Awansowanie jest natychmiastowe – status Twojej rejestracji zmienia się na **„Potwierdzony"** (przy bezpłatnych wydarzeniach) lub **„Oczekuje na płatność"** (przy płatnych).

### 10.3 Jak sprawdzić swoje miejsce na liście?

W panelu użytkownika (`/panel`) widzisz listę swoich rejestracji. Przy każdej z nich jest wyświetlony aktualny **status**. Jeśli jesteś na liście oczekujących, zobaczysz odpowiedni komunikat.

---

## 11. Chat i komentarze

**Adres:** `/chat` (główny chat), `/event/:id` (komentarze pod wydarzeniem)  
**Dostęp:** zalogowani i zatwierdzeni użytkownicy

### 11.1 Dwa rodzaje komunikacji

Aplikacja posiada dwa powiązane systemy komunikacji:

1. **Chat ogólny i chat przy wydarzeniach** – dostępny pod adresem `/chat`
2. **Komentarze pod wydarzeniami** – wbudowane bezpośrednio na stronie `/event/:id`

Oba systemy są oparte na **tym samym mechanizmie komentarzy**, ale Chat (`/chat`) agreguje wszystkie wątki w jednym miejscu.

### 11.2 Strona chatu (`/chat`)

Strona chatu to **centrum komunikacji** aplikacji. Składa się z dwóch widoków:

#### Widok: Lista wydarzeń z chatem

Po wejściu na `/chat` zobaczysz listę **wydarzeń, na które jesteś zapisany** (z aktywną rejestracją). Każde wydarzenie może mieć własny wątek rozmowy.

- Przy każdym wydarzeniu widoczna jest ikona z liczbą **nieprzeczytanych wiadomości** (czerwona kropka).
- Możesz też przejść do **czatu ogólnego** (Kenaz General) – globalnego kanału dla wszystkich użytkowników.

#### Widok: Rozmowa

Po wybraniu wydarzenia lub kanału ogólnego przechodzisz do **widoku rozmowy**:

- Lista wiadomości wyświetlona od najstarszej do najnowszej (scrolluj w dół, aby zobaczyć najnowsze).
- Pole do wpisywania nowej wiadomości na dole ekranu.
- Przyciski dodawania **reakcji emoji** do wiadomości (długie naciśnięcie na wiadomość lub gest na mobile).
- Możliwość **odpowiadania** na konkretną wiadomość (wątkowanie).

### 11.3 Wysyłanie wiadomości

1. Przejdź do `/chat`.
2. Wybierz wydarzenie lub kanał ogólny.
3. Wpisz wiadomość w polu na dole ekranu.
4. Naciśnij **Enter** lub przycisk wysłania.

**Limity wiadomości:**
- Maksymalna długość wiadomości: **1000 znaków**.
- Nie można wysyłać pustych wiadomości ani samych spacji.

### 11.4 Odpowiadanie na wiadomości

Aby odpowiedzieć na konkretną wiadomość:

- Na **desktop**: najedź kursorem na wiadomość → pojawi się opcja „Odpowiedz".
- Na **mobile**: przytrzymaj wiadomość → pojawi się menu z opcją „Odpowiedz".

Odpowiedź pojawi się pod oryginalną wiadomością z odwołaniem do cytowanego komentarza.

### 11.5 Reakcje emoji

Możesz reagować na wiadomości za pomocą emoji:

- Na **desktop**: najedź na wiadomość → kliknij ikonę emoji (😊).
- Na **mobile**: przytrzymaj wiadomość → wybierz emoji z paska.

Możesz dodać jedną reakcję z dostępnego zestawu. Kliknięcie ponownie tej samej reakcji **usuwa** Twoją reakcję.

### 11.6 Edycja i usuwanie wiadomości

Możesz **edytować** lub **usuwać** własne wiadomości:

- Na **desktop**: najedź na wiadomość → pojawią się opcje edycji i usunięcia.
- Na **mobile**: przytrzymaj wiadomość → wybierz z menu.

> **Uwaga:** Edycja używa mechanizmu wersjonowania. Jeśli ktoś inny edytuje tę samą wiadomość w tym samym czasie co Ty, starszy zapis zostanie odrzucony i zobaczysz komunikat błędu – wystarczy spróbować ponownie.

### 11.7 Komentarze pod wydarzeniem

Sekcja komentarzy jest dostępna na dole strony każdego wydarzenia (`/event/:id`). Działają identycznie jak chat, ale są **przypisane do konkretnego wydarzenia**.

### 11.8 Nieprzeczytane wiadomości

Ikona chatu w dolnej nawigacji (lub górnym pasku na desktop) pokazuje **czerwoną kropkę** lub **liczbę** nieprzeczytanych wiadomości. Po wejściu w dany wątek wiadomości są automatycznie oznaczane jako przeczytane.

---

---

# CZĘŚĆ III – MOJE KONTO

---

## 12. Panel – moje aktywności

**Adres:** `/panel`  
**Dostęp:** zalogowani i zatwierdzeni użytkownicy

### 12.1 Co to jest Panel?

Panel to **centrum zarządzania Twoją aktywnością** w aplikacji. Znajdziesz tu:

- **Listę Twoich rejestracji** na nadchodzące i minione wydarzenia.
- **Statusy płatności** dla płatnych wydarzeń.
- **Linki do płatności manualnej** – jeśli oczekuje na Ciebie płatność.
- Opcję **anulowania rejestracji**.

### 12.2 Lista rejestracji

Rejestracje są wyświetlane w czasie chronologicznym (najbliższe na górze). Każda rejestracja na panelu zawiera:

- **Nazwę i datę** wydarzenia.
- **Ikonę kategorii** (jeśli przypisana).
- **Status rejestracji** (potwierdzony / oczekuje na płatność / lista oczekujących).
- **Cenę** i jej status (opłacona / nieopłacona).
- **Przycisk akcji** – link do płatności lub przycisk anulowania.

### 12.3 Widok dla niezalogowanych i niezatwierdzonych

Dla użytkowników niezalogowanych lub oczekujących na akceptację strona panelu wyświetla **przykładowe, zamazane** karty wydarzeń. Jest to podgląd tego, jak będzie wyglądać panel po aktywacji konta. Żadna rzeczywista akcja nie jest możliwa.

### 12.4 Anulowanie rejestracji z Panelu

W panelu możesz anulować rejestrację na wydarzenie:

1. Znajdź wydarzenie na liście.
2. Kliknij przycisk **„Anuluj"** przy danej rejestracji.
3. Pojawi się okno potwierdzenia – przeczytaj je uważnie, szczególnie jeśli dokonałeś już płatności.
4. Potwierdź anulowanie.

---

## 13. Profil użytkownika i ustawienia konta

**Adres:** `/me`  
**Dostęp:** zalogowani użytkownicy

### 13.1 Przegląd strony konta

Strona `/me` to Twój **profil osobisty** i centrum ustawień. Podzielona jest na kilka sekcji.

### 13.2 Sekcja: Dane podstawowe

Tutaj zobaczysz:

- **Imię i nazwisko** – pobrane z Twojego konta Google (nie jest edytowalne w aplikacji).
- **Adres email** – adres powiązany z kontem Google.
- **Awatar** – zdjęcie profilowe z konta Google.
- **Typ konta / rola** – Member, Admin lub Guest.
- **Status subskrypcji** – nazwa aktywnego planu i data wygaśnięcia.

### 13.3 Sekcja: O mnie

Możesz napisać **krótkie opisanie siebie**, które będzie widoczne dla innych użytkowników na Twoim publicznym profilu.

Aby edytować:
1. Kliknij **przycisk edycji** przy sekcji „O mnie".
2. Wpisz lub zmodyfikuj tekst.
3. Kliknij **„Zapisz"** aby zachować zmiany.
4. Kliknij **„Anuluj"** aby odrzucić zmiany.

### 13.4 Sekcja: Zainteresowania

Możesz wybrać **tagi zainteresowań** ze zdefiniowanej listy. Tagi pokazują innym, jakie aktywności Cię interesują.

Aby edytować:
1. Kliknij na tagi, które Cię interesują – zaznaczone tagi są wyróżnione kolorem.
2. Kliknij ponownie, aby odznaczyć.
3. Kliknij **„Zapisz zainteresowania"** aby zachować wybór.

### 13.5 Sekcja: Ustawienia aplikacji

Tutaj znajdziesz:

- **Wybór języka** – zmień język interfejsu aplikacji.
- **Wybór miasta** – ustaw domyślne miasto dla filtrowania wydarzeń.
- **Przełącznik trybu** jasny/ciemny (alternatywnie dostępny w nawigacji).

### 13.6 Sekcja: Subskrypcja

Widoczna jest informacja o aktywnym planie:

- Nazwa planu (np. „Plan miesięczny", „Plan roczny", „Plan darmowy").
- Data wygaśnięcia subskrypcji.
- Przycisk **„Zarządzaj planem"** prowadzący do strony `/plans`.

Jeśli masz **oczekującą płatność za subskrypcję** (manualny przelew), zobaczysz baner z informacją i linkiem do strony płatności.

### 13.7 Sekcja: Wylogowanie

Na dole strony konta znajdziesz przycisk **„Wyloguj się"**. Po kliknięciu zostaniesz wylogowany i przekierowany na stronę główną.

---

## 14. Plany i subskrypcje

**Adres:** `/plans`  
**Dostęp:** zalogowani i zatwierdzeni użytkownicy

### 14.1 Co to jest subskrypcja?

Subskrypcja Kenaz to **opcjonalny plan membership**, który daje dostęp do preferencyjnych cen na wydarzeniach oraz innych benefitów.

### 14.2 Dostępne plany

Kenaz oferuje zazwyczaj trzy plany:

| Plan | Opis | Cena |
|------|------|------|
| **Darmowy** | Podstawowy dostęp do aplikacji; standardowe ceny wydarzeń | 0 zł |
| **Miesięczny** | Obniżone ceny na wydarzeniach; automatycznie wygasa po miesiącu | np. 69 zł/mies. |
| **Roczny** | Najlepsza wartość – najniższe ceny na cały rok | np. 599 zł/rok |

> Dokładne ceny planów są konfigurowane przez administratorów i mogą się różnić od podanych przykładów.

### 14.3 Jak wybrać lub zmienić plan?

1. Przejdź do `/plans`.
2. Zobaczysz karty z dostępnymi planami – kliknij, aby wybrać interesujący Cię plan.
3. W sekcji „Długość okresu" wybierz liczbę miesięcy lub lat (dla planów miesięcznych i rocznych).
4. Kliknij przycisk **„Wybierz plan"** / **„Przejdź do płatności"**.
5. Zostaniesz przekierowany do strony **płatności manualnej za subskrypcję**.

### 14.4 Płatność za subskrypcję

Płatność za subskrypcję odbywa się przez **przelew bankowy** (podobnie jak przy płatnych wydarzeniach):

**Adres:** `/subscription-purchases/:purchaseId/manual-payment`

1. Na stronie zobaczysz dane do przelewu: numer konta, kwotę i tytuł.
2. Wykonaj przelew.
3. Kliknij **„Potwierdzam wykonanie przelewu"**.
4. Administrator weryfikuje wpłatę i aktywuje Twoją subskrypcję.

### 14.5 Rezygnacja z planu

Aby przejść na darmowy plan:

1. Przejdź do `/plans`.
2. Wybierz **„Plan darmowy"**.
3. Kliknij przycisk potwierdzenia.

Zmiana jest natychmiastowa. Pamiętaj, że jeśli masz aktywną subskrypcję, możesz ją utracić przed terminem wygaśnięcia.

### 14.6 Modal powitalny (po pierwszym zatwierdzeniu konta)

Gdy administrator po raz pierwszy zaakceptuje Twoje konto, zostaniesz przekierowany do strony planów z wyświetlonym **ekranem powitalnym** (modal). Zobaczysz:

- Komunikat powitalny.
- Przycisk **„Wybierz plan"** – kieruje bezpośrednio do listy planów.
- Przycisk **„Wróć do konta"** – możesz pominąć i zdecydować później.

### 14.7 Jak subskrypcja wpływa na ceny wydarzeń?

Na stronie szczegółów każdego płatnego wydarzenia zobaczysz dwie ceny:

- **Cena dla gości** – dla użytkowników bez aktywnej subskrypcji.
- **Cena dla członków** – dla użytkowników z aktywną subskrypcją.

System automatycznie nalicza odpowiednią cenę przy rejestracji, zależnie od Twojego aktualnego statusu subskrypcji.

---

## 15. Publiczny profil użytkownika

**Adres:** `/people/:userId`  
**Dostęp:** zalogowani i zatwierdzeni użytkownicy

### 15.1 Co to jest publiczny profil?

Każdy użytkownik Kenaz ma **publiczny profil**, który mogą przeglądać inni zalogowani użytkownicy. Profil ten zawiera:

- **Imię i awatar** użytkownika.
- **Opis „O mnie"** (jeśli uzupełniony).
- **Tagi zainteresowań** (jeśli wybrane).

### 15.2 Jak wejść na profil innego użytkownika?

Przez kliknięcie w imię autora wiadomości w chacie. Bezpośredni link do profilu to `/people/:userId`, gdzie `:userId` jest numerycznym identyfikatorem użytkownika.

### 15.3 Prywatność

Na publicznym profilu **nie są wyświetlane** prywatne dane: adres email, historia płatności, lista rejestracji. Widoczne są tylko te informacje, które użytkownik sam udostępnił (opis i zainteresowania).

---

---

# CZĘŚĆ IV – POZOSTAŁE STRONY

---

## 16. Wesprzyj nas – darowizny

**Adres:** `/support`  
**Dostęp:** wszyscy (zalogowani i niezalogowani)

### 16.1 Po co ta strona?

Strona **„Wesprzyj nas"** umożliwia wsparcie finansowe organizacji Kenaz. Można ją otworzyć bezpośrednio z przycisku na stronie głównej lub z karty na stronie „O nas". Dostęp mają wszyscy – zarówno zalogowani, jak i anonimowi odwiedzający.

### 16.2 Przelew bankowy

Na stronie znajdziesz sekcję z danymi do przelewu:

- **Numer konta bankowego** – kliknij ikonę kopiowania, aby skopiować numer do schowka jednym tapnięciem.
- **Tytuł przelewu** – wpisz go dokładnie tak jak podano, aby administrator mógł zidentyfikować wpłatę.
- **Dane odbiorcy** – pełna nazwa organizacji i adres.

### 16.3 Zewnętrzne platformy wspierania

Jeśli administrator skonfigurował zewnętrzne linki (np. buycoffee.to, Patronite), zobaczysz przyciski prowadzące do tych platform.

### 16.4 Formularz darowizny (dla zalogowanych użytkowników)

Zalogowani użytkownicy mogą skorzystać z **formularza darowizny** wbudowanego w aplikację:

1. Wybierz kwotę z predefiniowanych opcji (np. 20, 50, 100 zł) lub wpisz własną kwotę w polu tekstowym.
2. Opcjonalnie dodaj krótką notatkę dla administratora.
3. Kliknij **„Wesprzyj"**.
4. System generuje potwierdzenie i zapisuje darowiznę w historii.

### 16.5 Punkty za darowiznę

**Każdy zalogowany użytkownik**, który dokonuje darowizny przez formularz, otrzymuje **punkty aktywności** dopisane do swojego profilu. Punkty są przyznawane niezależnie od posiadanego planu – zarówno subskrybenci, jak i użytkownicy bezpłatni mogą je zdobywać.

> **Uwaga:** Darowizny manualne (przelew bankowy bez użycia formularza) wymagają ręcznej weryfikacji przez administratora przed przyznaniem punktów.

---

## 17. O nas

**Adres:** `/about`  
**Dostęp:** wszyscy

### 17.1 Co zawiera strona „O nas"?

Strona **„O nas"** to miejsce, gdzie nowi odwiedzający mogą dowiedzieć się więcej o Kenaz Centrum. Zawiera:

- **Historię organizacji** – kilka rozdziałów (stories) ze zdjęciami i tekstami opisującymi początki i wartości Kenaz.
- **Statystyki** – kluczowe liczby (liczba członków, wydarzeń, lat działalności itp.).
- **Zdjęcia** – galeria zdjęć z życia organizacji.
- **Przycisk dołączenia** – zachęta dla nowych osób do zalogowania się i dołączenia do społeczności.

### 17.2 Nawigacja po stronie

Strona jest podzielona na sekcje wyświetlane w układzie tekstowo-fotograficznym – tekst po lewej, zdjęcie po prawej (lub odwrotnie, alternując). Przewijaj stronę, aby zobaczyć wszystkie rozdziały historii.

### 17.3 Karta „Wesprzyj nas"

Na **dole strony „O nas"** wyświetlana jest karta zachęcająca do wsparcia finansowego organizacji. Karta zawiera krótki opis i przycisk **„Wesprzyj nas"**, który kieruje bezpośrednio do strony darowizn (`/support`).

---

## 18. Polityka prywatności i Regulamin

**Adresy:** `/privacy`, `/terms`  
**Dostęp:** wszyscy

### 18.1 Polityka prywatności (`/privacy`)

Strona zawiera szczegółowe informacje dotyczące:

- Jakie dane osobowe zbiera aplikacja.
- W jakim celu są one przetwarzane.
- Jak długo są przechowywane.
- Jakie przysługują Ci prawa (dostęp, usunięcie, sprzeciw).
- Informacje o cookies i danych analitycznych.

### 18.2 Regulamin (`/terms`)

Strona zawiera warunki korzystania z aplikacji, w tym:

- Zasady uczestnictwa w wydarzeniach.
- Warunki subskrypcji i politykę zwrotów.
- Zasady korzystania z chatu (niedozwolone treści).
- Odpowiedzialność stron.

> Zalecamy zapoznanie się z obiema stronami przed pierwszym korzystaniem z aplikacji.

---

---

# CZĘŚĆ V – DODATKI

---

## 19. Aplikacja mobilna (PWA)

### 19.1 Co to jest PWA?

Kenaz jest dostępny jako **Progressive Web App (PWA)** – czyli aplikacja webowa, którą można zainstalować na urządzeniu mobilnym jak zwykłą aplikację. Nie wymaga pobierania ze sklepu App Store ani Google Play.

### 19.2 Jak zainstalować aplikację na telefonie?

**Na urządzeniach z systemem Android (Chrome):**

1. Otwórz aplikację Kenaz w przeglądarce Chrome.
2. Na dole ekranu pojawi się baner **„Dodaj do ekranu głównego"** – kliknij go.
3. Alternatywnie: kliknij trzy kropki w menu Chrome → **„Dodaj do ekranu głównego"**.
4. Potwierdź instalację.

**Na urządzeniach z systemem iOS (Safari):**

1. Otwórz aplikację w Safari.
2. Kliknij ikonę **udostępniania** (prostokąt ze strzałką w górę).
3. Wybierz **„Dodaj do ekranu głównego"**.
4. Nadaj skrótowi nazwę i potwierdź.

### 19.3 Funkcje w trybie PWA

Po zainstalowaniu aplikacja:

- Otwiera się **bez paska adresu przeglądarki** – wygląda jak natywna aplikacja.
- Obsługuje **dolną nawigację** z ikonami (jak aplikacja mobilna).
- Dostosowuje układ do małych ekranów.
- Obsługuje gesty dotykowe (swipe, long press).

### 19.4 Logowanie Google w trybie standalone (iOS)

Na urządzeniach iOS aplikacja zainstalowana jako PWA działa w **trybie standalone** (pełny ekran, bez paska Safari). Logowanie przez Google OAuth jest w pełni obsługiwane w tym trybie – po kliknięciu „Zaloguj się przez Google" system otworzy stronę logowania Google i po uwierzytelnieniu automatycznie powróci do aplikacji.

> **Uwaga:** Jeśli logowanie przez Google nie działa w trybie standalone, upewnij się, że otwierasz aplikację bezpośrednio z ikony na ekranie głównym (a nie przez Safari). W razie problemów spróbuj usunąć aplikację z ekranu głównego i dodać ją ponownie.

### 19.5 Nawigacja mobilna

Na urządzeniach mobilnych zamiast górnego paska nawigacyjnego pojawia się **dolna nawigacja** z przyciskami:

| Ikona | Strona | Opis |
|-------|--------|------|
| 🏠 Dom | `/` | Strona główna |
| 📅 Kalendarz | `/calendar` | Kalendarz wydarzeń |
| 💬 Chat | `/chat` | Chat i komentarze |
| 📋 Panel | `/panel` | Twoje rejestracje |
| 👤 Konto | `/me` | Profil i ustawienia |

### 19.6 Przycisk feedbacku (żarówka)

Na wszystkich stronach aplikacji – zarówno na desktopie, jak i na urządzeniach mobilnych – dostępna jest **ruchoma ikonka żarówki** w prawym dolnym rogu ekranu. Kliknięcie jej otwiera formularz feedbacku, gdzie można wpisać opinię, sugestię lub zgłoszenie błędu.

Przycisk działa poprawnie na wszystkich urządzeniach, w tym na iPhone'ach korzystających z Safari oraz w trybie standalone PWA.

---

## 20. Tryb ciemny i jasny

### 20.1 Jak zmienić tryb wyświetlania?

Kenaz obsługuje dwa motywy kolorystyczne:

- **Tryb jasny** – kremowe tło, granatowy tekst.
- **Tryb ciemny** – granatowe tło, kremowy tekst.

Możesz zmienić motyw:

- Klikając **ikonę słońca/księżyca** w górnym pasku nawigacyjnym (desktop).
- Przez stronę **Moje konto** (`/me`) w sekcji ustawień.

### 20.2 Automatyczne dopasowanie do systemu

Przy pierwszej wizycie aplikacja **automatycznie** wykrywa preferencje motywu ustawione w systemie operacyjnym (Windows, macOS, Android, iOS). Jeśli Twój system działa w trybie ciemnym, Kenaz również uruchomi się w trybie ciemnym.

### 20.3 Zapamiętywanie preferencji

Twój wybór jest zapisywany w przeglądarce (localStorage) i będzie zapamiętany przy kolejnych wizytach.

---

## 21. Powiadomienia i komunikaty systemowe

### 21.1 Rodzaje powiadomień

Aplikacja wyświetla kilka rodzajów komunikatów:

| Typ | Wygląd | Kiedy się pojawia |
|-----|--------|-------------------|
| **Sukces** (zielony) | Zielony baner u góry | Operacja zakończona pomyślnie (zapis, płatność, zapis profilu) |
| **Błąd** (czerwony) | Czerwony baner | Coś poszło nie tak (błąd sieci, nieprawidłowe dane) |
| **Informacja** (niebieski) | Niebieski baner | Ogólna informacja |
| **Potwierdzenie** | Okno modalne | Wymagane potwierdzenie akcji (anulowanie, usunięcie) |

### 21.2 Banner powiadomień globalnych

Administratorzy mogą ustawić **globalny baner informacyjny** pojawiający się u góry strony dla wszystkich użytkowników. Służy do przekazywania ważnych komunikatów (np. przerwa techniczna, zmiana terminów, nowe wydarzenie).

### 21.3 Powiadomienia o nowych wiadomościach

Jeśli masz nieprzeczytane wiadomości w chacie:

- Na ikonie chatu w nawigacji pojawia się **czerwona kropka** lub liczba wiadomości.
- Po wejściu w wątek powiadomienie znika.

---

## 22. Często zadawane pytania (FAQ)

**P: Dlaczego nie mogę zobaczyć kalendarza?**  
O: Musisz być zalogowany i mieć zatwierdzone konto przez administratora. Jeśli się dopiero zarejestrowałeś, poczekaj na akceptację (zwykle 1–2 dni robocze).

**P: Jak długo trwa zatwierdzenie konta?**  
O: Czas zależy od dostępności administratora. Zazwyczaj odbywa się to w ciągu 1–2 dni roboczych.

**P: Jak anulować subskrypcję?**  
O: Przejdź do `/plans` i wybierz plan darmowy. Zmiana następuje natychmiastowo.

**P: Zapłaciłem za wydarzenie, ale możliwość zapisu nie działa – co robię?**  
O: Sprawdź status płatności w panelu (`/panel`) lub na stronie `/manual-payment/:id`. Upewnij się, że kliknąłeś „Potwierdzam wykonanie przelewu". Jeśli problem nadal występuje, skontaktuj się z administratorem.

**P: Nie mogę się zalogować przez Google – co robię?**  
O: Sprawdź, czy Twoje połączenie internetowe działa. Spróbuj wyczyścić cache przeglądarki lub użyć trybu prywatnego. Jeśli problem nie ustępuje, skontaktuj się z administratorem.

**P: Czy mogę zmienić adres email w Kenaz?**  
O: Kenaz używa konta Google, więc adres email jest powiązany z Twoim kontem Google. Aby zmienić email, musisz użyć innego konta Google.

**P: Zapisałem się na listę oczekujących – co teraz?**  
O: Poczekaj. System automatycznie awansuje Cię, gdy ktoś zwolni miejsce. Sprawdzaj status w panelu (`/panel`).

**P: Jak kontaktować się z innymi uczestnikami?**  
O: Przez system chatu (`/chat`). Możesz pisać w czacie ogólnym lub w wątku konkretnego wydarzenia.

**P: Jak wesprzeć Kenaz finansowo?**  
O: Przejdź do `/support` (strona „Wesprzyj nas"). Możesz wykonać przelew na podany numer konta lub skorzystać z zewnętrznych platform wspierania. Zalogowani użytkownicy mogą też skorzystać z formularza darowizny w aplikacji.

**P: Czy mogę wspierać centrum bez zakładania konta?**  
O: Tak. Strona `/support` jest dostępna publicznie – możesz wykonać przelew na podany numer konta bez logowania się.

**P: Nie mogę się zalogować przez Google w trybie PWA na iPhonie – co robię?**  
O: Upewnij się, że otwierasz aplikację bezpośrednio z ikony na ekranie głównym (tryb standalone). Jeśli problem nadal występuje, spróbuj usunąć aplikację z ekranu głównego i dodać ją ponownie przez Safari → Udostępnij → Dodaj do ekranu głównego.

**P: Co oznacza „zablokowane konto"?**  
O: Konto zablokowane przez administratora automatycznie wraca do statusu oczekującego. Musisz poczekać, aż administrator ponownie je zatwierdzi.

---

## 23. Słownik pojęć

| Pojęcie | Definicja |
|---------|-----------|
| **BANNED** | Status konta zablokowanego przez administratora |
| **Chat ogólny** | Globalny kanał komunikacji dostępny dla wszystkich aktywnych użytkowników |
| **Darczyńca** | Użytkownik, który przekazał darowiznę na rzecz organizacji |
| **Feedback** | Opinia lub sugestia wysłana przez użytkownika przez ikonkę żarówki |
| **Hasło** | Kenaz nie używa haseł – logowanie wyłącznie przez Google |
| **Limit uczestników** | Maksymalna liczba osób, które mogą być zapisane na wydarzenie |
| **Lista oczekujących** | Kolejka użytkowników czekających na zwolnienie miejsca na wydarzeniu |
| **Manualna płatność** | Płatność dokonywana przelewem bankowym, weryfikowana ręcznie przez administratora |
| **Motyw** | Schemat kolorystyczny aplikacji: jasny (light) lub ciemny (dark) |
| **PENDING** | Status konta oczekującego na akceptację administratora |
| **Plan darmowy** | Podstawowy plan bez abonamentu; standardowe ceny wydarzeń |
| **Plan miesięczny** | Subskrypcja odnawialna co miesiąc; obniżone ceny wydarzeń |
| **Plan roczny** | Subskrypcja na rok; najniższe ceny wydarzeń |
| **PWA** | Progressive Web App – aplikacja webowa działająca jak natywna aplikacja mobilna |
| **Reakcja** | Emoji dodawany do wiadomości w chacie (polubienie, śmiech itd.) |
| **Rejestracja** | Zapis użytkownika na konkretne wydarzenie |
| **Rola** | Uprawnienia użytkownika: Guest (gość), Member (członek), Admin (administrator) |
| **Standalone** | Tryb działania PWA na iOS, w którym aplikacja uruchamia się bez paska adresu Safari |
| **Status konta** | Stan konta: Active (aktywny), Pending (oczekujący), Banned (zablokowany) |
| **Subskrypcja** | Płatny plan membership dający dostęp do niższych cen |
| **Tag zainteresowań** | Etykieta określająca zainteresowania użytkownika (np. yoga, karate) |
| **Waitlist** | Synonim listy oczekujących |
| **Wątek** | Zbiór odpowiedzi powiązanych z konkretną wiadomością w chacie |
| **Wesprzyj nas** | Strona `/support` umożliwiająca wsparcie finansowe centrum |

---

*Instrukcja dla użytkownika – Kenaz Centrum, wersja 2.0, luty 2026.*  
*Wszelkie pytania kieruj do administratorów platformy.*
