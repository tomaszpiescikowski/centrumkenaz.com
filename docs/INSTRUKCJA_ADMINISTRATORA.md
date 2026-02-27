# Instrukcja Administratora – Kenaz Centrum
### Kompletny przewodnik zarządzania aplikacją

---

> **Wersja dokumentu:** 2.0  
> **Data:** luty 2026  
> **Dotyczy:** panel administracyjny aplikacji Kenaz

---

> **Wymagania wstępne:** Ten dokument zakłada pełną znajomość aplikacji od strony użytkownika. Nie opisuje funkcji dostępnych dla zwykłych użytkowników (kalendarza, chatu, rejestracji, subskrypcji itd.). Szczegółowy opis funkcji użytkownika znajdziesz w osobnym dokumencie: **INSTRUKCJA_UZYTKOWNIKA.md**.

---

## Spis treści

1. [Dashboard administratora](#1-dashboard-administratora)
2. [Tworzenie i edycja wydarzeń](#2-tworzenie-i-edycja-wydarzeń)
3. [Zatwierdzanie nowych użytkowników](#3-zatwierdzanie-nowych-użytkowników)
4. [Lista wszystkich użytkowników](#4-lista-wszystkich-użytkowników)
5. [Płatności online](#5-płatności-online)
6. [Płatności manualne](#6-płatności-manualne)
7. [Bilans finansowy](#7-bilans-finansowy)
8. [Darowizny](#8-darowizny)
9. [Opinie i feedback](#9-opinie-i-feedback)
10. [Zarządzanie ikonkami wydarzeń](#10-zarządzanie-ikonkami-wydarzeń)
11. [Nadawanie uprawnień administratora](#11-nadawanie-uprawnień-administratora)
12. [Logi audytowe](#12-logi-audytowe)

**Dodatki**

- [Często zadawane pytania (FAQ – Administrator)](#faq-dla-administratorów)
- [Słownik pojęć administratora](#słownik-pojęć-administratora)

---

---

# 1. Dashboard administratora

**Adres:** `/admin`  
**Dostęp:** wyłącznie użytkownicy z rolą Admin

### 1.1 Ogólne informacje

Dashboard to **centralna strona panelu administracyjnego**. Jest to pierwszy ekran, który zobaczysz po wejściu pod adres `/admin`. Na dashboardzie wyświetlona jest **siatka kafelków**, z których każdy prowadzi do konkretnej sekcji zarządzania.

### 1.2 Siatka kafelków

Każdy kafelek zawiera ikonę, tytuł i skrócony opis funkcji. Kliknięcie kafelka przenosi do odpowiedniej podstrony. Dostępne kafelki:

| Kafelek | Adres | Opis |
|---------|-------|------|
| **Utwórz wydarzenie** | `/admin/create-event` | Formularz tworzenia nowego wydarzenia |
| **Zatwierdź użytkowników** | `/admin/users` | Oczekujące konta do akceptacji |
| **Wszyscy użytkownicy** | `/admin/all-users` | Lista i zarządzanie wszystkimi kontami |
| **Płatności online** | `/admin/payments` | Przegląd transakcji TPay |
| **Płatności manualne** | `/admin/manual-payments` | Weryfikacja przelewów bankowych |
| **Bilans** | `/admin/balance` | Przegląd finansowy organizacji |
| **Darowizny** | `/admin/donations` | Lista darowizn i konfiguracja |
| **Feedback** | `/admin/feedback` | Opinie nadesłane przez użytkowników |
| **Ikonki** | `/admin/icons` | Zarządzanie ikonkami kategorii |
| **Nadaj admina** | `/admin/promote` | Przyznawanie uprawnień administratora |

### 1.3 Widoczność dashboardu

Dashboard i wszystkie podstrony `/admin/*` są dostępne **wyłącznie** dla zalogowanych użytkowników z przypisaną rolą `Admin`. Próba wejścia na te adresy przez zwykłego użytkownika skutkuje przekierowaniem do kalendarza lub wyświetleniem komunikatu o braku uprawnień.

---

# 2. Tworzenie i edycja wydarzeń

**Adresy:** `/admin/create-event`, `/admin/edit-event/:id`  
**Dostęp:** wyłącznie Admin

### 2.1 Jak utworzyć nowe wydarzenie?

1. Przejdź do dashboardu (`/admin`) i kliknij kafelek **„Utwórz wydarzenie"**, lub bezpośrednio wejdź pod adres `/admin/create-event`.
2. Wypełnij formularz (wszystkie wymagane pola oznaczone gwiazdką `*`).
3. Kliknij przycisk **„Utwórz wydarzenie"**.
4. Wydarzenie od razu pojawia się w kalendarzu.

### 2.2 Pola formularza tworzenia wydarzenia

| Pole | Wymagane | Opis i uwagi |
|------|----------|--------------|
| **Tytuł** | ✅ | Nazwa wyświetlana w kalendarzu i na stronie szczegółów |
| **Data** | ✅ | Data i godzina rozpoczęcia; picker kalendarza |
| **Godzina zakończenia** | ✗ | Opcjonalna; wyświetlana na stronie szczegółów |
| **Miasto** | ✅ | Wybór z listy dostępnych miast; decyduje o filtrowaniu w kalendarzu |
| **Lokalizacja** | ✅ | Adres lub nazwa miejsca; wyświetlana z linkiem do Google Maps |
| **Opis** | ✅ | Pełny opis aktywności; wspiera formatowanie tekstowe |
| **Cena (goście)** | ✅ | Cena dla użytkowników bez subskrypcji; wpisz `0` dla bezpłatnych |
| **Cena (członkowie)** | ✅ | Cena dla subskrybentów; wpisz `0` dla bezpłatnych |
| **Limit uczestników** | ✗ | Maksymalna liczba miejsc; zostaw puste dla wydarzenia bez limitu |
| **Ikona kategorii** | ✗ | Wybór ikony z zarządzanych typów (np. karate, morsowanie) |
| **Ogłoszenie** | ✗ | Opcjonalny anons powiązany z wydarzeniem |

### 2.3 Limit wydarzeń dziennie

System nakłada ograniczenie: **maksymalnie 4 wydarzenia w jednym dniu w tym samym mieście**. Próba przekroczenia limitu wyświetla komunikat błędu i uniemożliwia zapisanie.

### 2.4 Edycja istniejącego wydarzenia

Aby edytować wydarzenie:

1. Wejdź na stronę szczegółów danego wydarzenia (`/event/:id`).
2. Kliknij przycisk **„Edytuj"** (widoczny tylko dla administratorów).
3. Zostaniesz przekierowany do formularza edycji pod adresem `/admin/edit-event/:id`.
4. Zmień wybrane pola i kliknij **„Zapisz zmiany"**.

Edycja jest natychmiastowa – zmiany są widoczne dla wszystkich użytkowników od razu po zapisaniu.

### 2.5 Usuwanie wydarzenia

Na stronie edycji wydarzenia (`/admin/edit-event/:id`) dostępny jest przycisk **„Usuń wydarzenie"**. Usunięcie jest **nieodwracalne** i wiąże się z anulowaniem wszystkich rejestracji na to wydarzenie.

> **Ważne:** Przed usunięciem przejrzyj listę uczestników. Jeśli wydarzenie ma zarejestrowanych uczestników, którzy zapłacili, rozważ poinformowanie ich przed usunięciem.

---

# 3. Zatwierdzanie nowych użytkowników

**Adres:** `/admin/users`  
**Dostęp:** wyłącznie Admin

### 3.1 Co widać na tej stronie?

Na stronie `/admin/users` wyświetlana jest **lista kont oczekujących na zatwierdzenie**. Każda karta użytkownika zawiera:

- **Imię i nazwisko** (z konta Google).
- **Adres email**.
- **Awatar** (jeśli dostępny z Google).
- **Data rejestracji** – kiedy użytkownik zalogował się po raz pierwszy.
- **Przycisk „Zatwierdź"** i **przycisk „Odrzuć"** (jeśli jest skonfigurowany).

### 3.2 Jak zatwierdzić konto?

1. Przejdź do `/admin/users`.
2. Znajdź kartę użytkownika, którego chcesz zatwierdzić.
3. Kliknij przycisk **„Zatwierdź"**.
4. Status konta zmienia się z `PENDING` na `ACTIVE`.
5. Użytkownik przy kolejnym wejściu w aplikację zobaczy ekran powitalny i wybór planu subskrypcji.

> **Wskazówka:** Rozważ weryfikację tożsamości użytkownika przed zatwierdzeniem (jeśli masz takie procedury). Po zatwierdzeniu użytkownik uzyskuje pełny dostęp do wszystkich funkcji.

### 3.3 Co się dzieje po zatwierdzeniu?

- Konto zmienia status na `ACTIVE`.
- Użytkownik zostaje przekierowany do ekranu powitalnego z wyborem planu subskrypcji przy kolejnym logowaniu.
- Zostaje zalogowany zdarzenie w systemie logów audytowych.

### 3.4 Jeśli lista jest pusta

Gdy nie ma oczekujących kont, strona wyświetla komunikat informujący, że nie ma nic do zatwierdzenia. Jest to normalna sytuacja – wróć tu, gdy pojawią się nowi użytkownicy.

---

# 4. Lista wszystkich użytkowników

**Adres:** `/admin/all-users`  
**Dostęp:** wyłącznie Admin

### 4.1 Ogólny opis

Strona `/admin/all-users` to **kompletna lista wszystkich kont** w systemie Kenaz, bez względu na status. Służy do zarządzania aktywnymi, oczekującymi i zablokowanymi użytkownikami.

### 4.2 Paginacja

Użytkownicy są wyświetlani stronicowo. Na dole listy znajdziesz przyciski nawigacji **„Następna strona"** / **„Poprzednia strona"** oraz informację o aktualnej stronie i całkowitej liczbie użytkowników.

### 4.3 Filtry

Dostępne są filtry ułatwiające wyszukiwanie:

| Filtr | Opis |
|-------|------|
| **Filtr statusu** | Pokaż wszystkich / tylko aktywnych / tylko oczekujących / tylko zablokowanych |
| **Filtr subskrybentów** | Pokaż wszystkich / tylko subskrybentów (aktywna subskrypcja płatna) |
| **Wyszukiwarka** | Wyszukaj po imieniu lub adresie email |

### 4.4 Klikalne wiersze

Każdy wiersz tabeli użytkowników jest **klikalny**. Kliknięcie otwiera **kafelek admina** – rozszerzony panel informacyjny z pełnymi danymi o danym koncie.

### 4.5 Kafelek admina – zawartość

Kafelek admina jest powiększoną kartą informacyjną podzieloną na cztery sekcje:

#### Sekcja 1: Konto

| Pole | Opis |
|------|------|
| **Imię i email** | Dane identyfikacyjne |
| **Awatar** | Zdjęcie z Google |
| **Rola** | Guest, Member lub Admin |
| **Status konta** | Active, Pending lub Banned |
| **Data rejestracji** | Kiedy użytkownik zalogował się po raz pierwszy |
| **Miasto** | Wybrane miasto użytkownika |

#### Sekcja 2: Aktywność

| Pole | Opis |
|------|------|
| **Liczba rejestracji** | Ile razy użytkownik zapisał się na wydarzenia |
| **Ostatnia aktywność** | Data ostatniego logowania lub akcji |
| **Aktywny subskrybent** | Tak/Nie; nazwa planu i data wygaśnięcia |

#### Sekcja 3: Finanse

| Pole | Opis |
|------|------|
| **Suma wpłat** | Łączna kwota zapłacona za wydarzenia |
| **Suma subskrypcji** | Łączna kwota zapłacona za subskrypcje |
| **Darowizny** | Łączna kwota darowizn |
| **Historia transakcji** | Lista ostatnich płatności |

#### Sekcja 4: Oczekujące akcje

| Pole | Opis |
|------|------|
| **Oczekujące płatności** | Rejestracje, za które użytkownik jeszcze nie zapłacił |
| **Oczekujące rejestracje** | Rejestracje do potwierdzenia |

### 4.6 Blokowanie i odblokowanie konta

Z poziomu kafelka admina (po kliknięciu w użytkownika) możesz:

**Zablokować konto (ACTIVE → BANNED):**
1. W kafelku admina kliknij **„Zablokuj konto"**.
2. Pojawi się okno potwierdzenia – kliknij **„Potwierdź"**.
3. Konto zmienia status na `BANNED`. Użytkownik traci dostęp do pełnych funkcji.

**Odblokować konto (BANNED → PENDING / ACTIVE):**
1. W kafelku admina przy zablokowanym koncie kliknij **„Odblokuj"**.
2. Konto wraca do statusu `PENDING` (wymaga ponownej akceptacji) lub `ACTIVE` (bezpośrednie odblokowanie), zależnie od konfiguracji.

> **Uwaga:** Zablokowany użytkownik widzi kalendarzu i panel zamazane, identyczne jak przy statusie PENDING. Jego rejestracje i historia pozostają w systemie.

---

# 5. Płatności online

**Adres:** `/admin/payments`  
**Dostęp:** wyłącznie Admin

### 5.1 Co widać na tej stronie?

Strona `/admin/payments` wyświetla **listę transakcji przetwarzanych przez bramkę płatności online** (np. TPay). Każda pozycja na liście zawiera:

- **ID transakcji** – unikalny identyfikator z systemu płatności.
- **Użytkownik** – imię i email płacącego.
- **Kwota** – wartość transakcji.
- **Status transakcji** – np. Opłacona, Oczekująca, Anulowana, Zwrócona.
- **Data i godzina** transakcji.
- **Typ płatności** – za wydarzenie, za subskrypcję.

### 5.2 Ręczna zmiana statusu transakcji

W uzasadnionych przypadkach (np. bramka nie zaktualizowała statusu automatycznie) możesz **ręcznie zmienić status transakcji**:

1. Kliknij w wybraną transakcję na liście.
2. Wybierz nowy status z listy dostępnych opcji.
3. Kliknij **„Zapisz"**.

> **Ważne:** Ręczna zmiana statusu powinna być stosowana wyłącznie w wyjątkowych sytuacjach – np. gdy bramka płatności zgłasza błąd, ale wpłata faktycznie dotarła. Każda zmiana jest odnotowywana w logach audytowych i widoczna przez system.

---

# 6. Płatności manualne

**Adres:** `/admin/manual-payments`  
**Dostęp:** wyłącznie Admin

### 6.1 Co to są płatności manualne?

Płatności manualne to **przelewy bankowe** dokonywane przez użytkowników za rejestracje na płatne wydarzenia lub zakup subskrypcji. Administrator musi ręcznie zweryfikować każdą płatność i ją zatwierdzić lub odrzucić.

### 6.2 Główna lista – oczekujące płatności

Na górze strony wyświetlona jest lista **oczekujących płatności do weryfikacji**. Każda pozycja zawiera:

- **Imię i email** użytkownika.
- **Typ płatności** – za wydarzenie (nazwa) lub za subskrypcję (nazwa planu).
- **Kwota** do weryfikacji.
- **Data** złożenia prośby o potwierdzenie przez użytkownika.
- **Przycisk „Zweryfikuj"** i **przycisk „Odrzuć"**.

### 6.3 Jak zweryfikować płatność?

1. Znajdź w banku przelew od danego użytkownika. Zweryfikuj kwotę i tytuł przelewu.
2. Na stronie `/admin/manual-payments` kliknij **„Zweryfikuj"** przy odpowiedniej pozycji.
3. Pojawi się okno potwierdzenia.
4. Kliknij **„Potwierdź"** – rejestracja lub subskrypcja zostaje aktywowana.

### 6.4 Jak odrzucić płatność?

Jeśli przelew nie dotarł, ma nieprawidłową kwotę lub jest niepoprawny z innego powodu:

1. Kliknij **„Odrzuć"** przy wybranej pozycji.
2. Wpisz opcjonalnie powód odrzucenia (wyświetlany użytkownikowi).
3. Kliknij **„Potwierdź odrzucenie"**.
4. Rejestracja wraca do statusu **„Oczekuje na płatność"** – użytkownik musi wykonać przelew ponownie.

### 6.5 Filtry

Dostępne filtry ułatwiają przeglądanie:

| Filtr | Opis |
|-------|------|
| **Typ** | Tylko płatności za wydarzenia / tylko za subskrypcje / wszystkie |
| **Status** | Oczekujące / Rozpatrzone / Wszystkie |
| **Zakres dat** | Filtruj płatności z wybranego okresu |

### 6.6 Sekcja „Rozpatrzone"

Pod sekcją oczekujących płatności dostępna jest **historia rozpatrzonych płatności**. Zawiera zarówno zatwierdzone, jak i odrzucone transakcje. Służy do audytu i ewentualnego odwołania się do historii decyzji.

---

# 7. Bilans finansowy

**Adres:** `/admin/balance`  
**Dostęp:** wyłącznie Admin

### 7.1 Ogólny przegląd

Strona `/admin/balance` to **centrum analizy finansowej** organizacji. Dostarcza zbiorczych informacji o przychodach z różnych źródeł.

### 7.2 Sekcje raportu finansowego

Bilans jest podzielony na sekcje według źródła przychodów:

| Sekcja | Opis |
|--------|------|
| **Subskrypcje** | Łączny przychód ze sprzedanych planów (miesięcznych i rocznych) |
| **Rejestracje na wydarzenia** | Łączny przychód z płatnych wydarzeń |
| **Darowizny** | Łączna kwota wpłaconych darowizn |
| **Suma całkowita** | Łączny przychód ze wszystkich źródeł |

Każda sekcja wyświetla kwotę za bieżący miesiąc, bieżący rok oraz łącznie od początku działania systemu.

### 7.3 Eksport danych

Na stronie dostępny jest przycisk **„Eksportuj"** umożliwiający pobranie danych finansowych. Dane są eksportowane w formacie CSV lub podobnym, co umożliwia dalszą analizę w arkuszu kalkulacyjnym.

### 7.4 Ręczne korekty bilansu

W sekcji **„Korekty manualne"** administrator może dodać ręczną pozycję finansową (np. koszt zewnętrzny, zwrot środków spoza systemu):

1. Kliknij **„Dodaj korektę"**.
2. Wpisz:
   - **Tytuł korekty** – opis (np. „Zwrot za wydarzenie X").
   - **Kwotę** – dodatnią (przychód) lub ujemną (koszt).
   - **Datę** korekty.
3. Kliknij **„Zapisz"**.
4. Korekta pojawia się w historii i wpływa na łączne saldo.

> **Ważne:** Korekty manualne są wyłącznie zapisem ewidencyjnym – nie generują faktycznych transakcji bankowych.

---

# 8. Darowizny

**Adres:** `/admin/donations`  
**Dostęp:** wyłącznie Admin

### 8.1 Lista darowizn

Strona `/admin/donations` wyświetla **listę wszystkich darowizn** zarówno tych złożonych przez formularz w aplikacji, jak i zweryfikowanych manualnych przelewów. Każda pozycja zawiera:

- **Imię i email** darczyńcy.
- **Kwotę** darowizny.
- **Datę** wpłaty.
- **Status** – Zweryfikowana / Oczekuje na weryfikację.
- **Notatkę** od darczyńcy (jeśli podana).

### 8.2 Konfiguracja konta bankowego

W sekcji **„Konfiguracja"** możesz ustawić dane konta bankowego wyświetlane użytkownikom na stronie `/support` oraz na stronach płatności:

1. Kliknij **„Edytuj dane bankowe"**.
2. Wpisz lub zaktualizuj:
   - **Numer konta** (IBAN).
   - **Nazwę odbiorcy** (pełna nazwa organizacji).
   - **Tytuł przelewu** – wzorzec tytułu, jaki mają podawać darczyńcy.
3. Kliknij **„Zapisz"**.

Zmiany są natychmiastowe – nowe dane pojawią się na stronie `/support` przy kolejnym załadowaniu.

### 8.3 Konfiguracja zewnętrznych linków

W tej samej sekcji możesz zarządzać **przyciskami do zewnętrznych platform** (np. buycoffee.to, Patronite):

1. Kliknij **„Dodaj link zewnętrzny"** lub edytuj istniejący.
2. Wpisz **nazwę platformy** i **URL** (pełny adres strony profilowej Kenaz).
3. Kliknij **„Zapisz"**.

Linki te pojawią się jako przyciski na stronie `/support`.

---

# 9. Opinie i feedback

**Adres:** `/admin/feedback`  
**Dostęp:** wyłącznie Admin

### 9.1 Skąd pochodzi feedback?

Użytkownicy mogą wysyłać opinie i zgłoszenia przez **ikonkę żarówki** dostępną w prawym dolnym rogu wszystkich stron aplikacji. Każdy feedback trafia do panelu `/admin/feedback`.

### 9.2 Zawartość wpisu feedback

Każda opinia wyświetla:

- **Treść wiadomości** – pełna treść przesłana przez użytkownika.
- **Data i godzina** wysłania.
- **Email użytkownika** (jeśli był zalogowany podczas wysyłania).
- **URL strony** – z jakiej strony aplikacji wysłano feedback.

### 9.3 Zarządzanie feedbackiem

Dla każdej pozycji dostępne są akcje:

| Akcja | Opis |
|-------|------|
| **Oznacz jako przeczytane** | Ukrywa powiadomienie; feedback pozostaje w historii |
| **Archiwizuj** | Przenosi do archiwum (dostępne przez filtr) |
| **Usuń** | Trwale usuwa feedback z systemu |

### 9.4 Filtry

Dostępne filtry:

| Filtr | Opis |
|-------|------|
| **Status** | Nowe / Przeczytane / Zarchiwizowane / Wszystkie |
| **Zakres dat** | Filtruj po dacie wysłania |

---

# 10. Zarządzanie ikonkami wydarzeń

**Adres:** `/admin/icons`  
**Dostęp:** wyłącznie Admin

### 10.1 Do czego służą ikonki?

Ikonki to **kategorie wizualne** przypisywane do wydarzeń. Ułatwiają użytkownikom szybkie rozpoznanie rodzaju aktywności na kalendarzu i stronie szczegółów.

### 10.2 Wbudowane typy ikonek

System posiada 10 wbudowanych typów ikonek:

| Nazwa | Emoji | Kolor |
|-------|-------|-------|
| Karate | 🥋 | Czerwony |
| Morsowanie | 🧊 | Niebieski |
| Basen | 🏊 | Niebieski |
| Board game | 🎲 | Zielony |
| Yoga | 🧘 | Fioletowy |
| Nordic Walking | 🚶 | Zielony |
| Wycieczka | 🥾 | Brązowy |
| Siłownia | 💪 | Szary |
| Gotowanie | 🍳 | Pomarańczowy |
| Inne | ⭐ | Szary |

### 10.3 Niestandardowe typy ikonek

Oprócz wbudowanych typów możesz tworzyć **własne typy ikonek** przechowywane w bazie danych. Ikonki te mogą być przypisywane do wydarzeń identycznie jak wbudowane.

### 10.4 Formularz tworzenia ikonki

Aby dodać nową ikonkę:

1. Na stronie `/admin/icons` znajdź formularz **„Dodaj nową ikonkę"**.
2. Wypełnij:
   - **Nazwa** – tekst wyświetlany przy ikonce (np. „Taniec", „Boks").
   - **Emoji** – wybierz lub wpisz dowolne emoji (np. 💃, 🥊).
   - **Kolor** – wybierz kolor z palety lub wpisz wartość HEX.
3. Obserwuj **podgląd na żywo** – na bieżąco pokazuje, jak ikona będzie wyglądać.
4. Kliknij **„Dodaj ikonkę"**.

### 10.5 Edycja i usuwanie ikonek

Przy każdej niestandardowej ikonki dostępne są przyciski:

- **Edytuj** – otwiera formularz edycji z aktualnymi danymi.
- **Usuń** – trwale usuwa ikonkę. Jeśli ikonka jest przypisana do wydarzeń, zostaje z nich usunięta.

> **Uwaga:** Wbudowanych 10 ikonek nie można usunąć – można je tylko wyłączyć (jeśli taka opcja jest dostępna).

---

# 11. Nadawanie uprawnień administratora

**Adres:** `/admin/promote`  
**Dostęp:** wyłącznie Admin

### 11.1 Jak nadać uprawnienia administratora?

Dodanie nowego administratora to **operacja krytyczna** wymagająca potwierdzenia kodem.

**Krok 1: Wpisz email użytkownika**

1. Przejdź do `/admin/promote`.
2. Wpisz **adres email** użytkownika, któremu chcesz nadać uprawnienia administratora.
3. Upewnij się, że użytkownik ma aktywne konto w systemie.

**Krok 2: Przeczytaj ostrzeżenie**

System wyświetli **ostrzeżenie** informujące o konsekwencjach nadania uprawnień:

- Administrator ma pełny dostęp do panelu.
- Administrator może zatwierdzać użytkowników, edytować i usuwać wydarzenia, przeglądać dane finansowe.
- Administrator może nadawać uprawnienia administratora innym użytkownikom.

**Krok 3: Wpisz kod potwierdzający**

Aby potwierdzić operację, wpisz w wyznaczone pole **kod potwierdzający** wyświetlony na ekranie. Kod jest generowany losowo przy każdej próbie nadania uprawnień i służy jako zabezpieczenie przed przypadkowym kliknięciem.

**Krok 4: Potwierdź**

Kliknij przycisk **„Nadaj uprawnienia"**. Jeśli kod jest poprawny, uprawnienia zostaną przyznane.

### 11.2 Efekty nadania uprawnień

Po pomyślnym nadaniu uprawnień:

- Użytkownik zmienia rolę z `Member` na `Admin`.
- Zmiana jest natychmiastowa – przy kolejnym zalogowaniu użytkownik zobaczy panel administracyjny.
- Zdarzenie zostaje zalogowane w systemie logów audytowych.

### 11.3 Odejmowanie uprawnień administratora

Odebranie uprawnień administratora **nie jest dostępne przez interfejs graficzny**. W razie potrzeby należy dokonać zmiany bezpośrednio w bazie danych lub przez terminal SSH na serwerze.

> **Ważne:** Zachowaj ostrożność przy nadawaniu uprawnień administratora. Każda osoba z tą rolą ma pełny dostęp do danych użytkowników, historii płatności i konfiguracji systemu.

---

# 12. Logi audytowe

**Dostęp:** przez SSH na serwer

### 12.1 Czym są logi audytowe?

System logowania automatycznie zapisuje **kluczowe zdarzenia** w aplikacji – logowania, rejestracje, płatności, akcje administratorów i błędy. Logi służą do audytu bezpieczeństwa, debugowania i śledzenia aktywności.

### 12.2 Lokalizacja logów na serwerze

Logi są przechowywane na serwerze AWS EC2 w katalogu:

```
/opt/kenaz/logs/
```

Struktura katalogów:

```
logs/
└── DD-MM-YYYY/
    ├── user@example.com.log
    ├── admin@kenaz.pl.log
    └── system.log
```

Każdy dzień ma **własny podkatalog** z datą (format `DD-MM-YYYY`). W katalogu danego dnia znajdują się pliki logów podzielone według adresu email użytkownika.

### 12.3 Format logów

Każda linia logu ma format:

```
[HH:MM:SS] POZIOM - treść komunikatu
```

Przykład:

```
[14:23:05] INFO - User jan.kowalski@gmail.com logged in
[14:25:10] INFO - Registration created: user=jan.kowalski@gmail.com event_id=42
[14:26:00] WARNING - Payment verification failed: registration_id=123
[15:00:00] ERROR - Database connection timeout
```

### 12.4 Poziomy logowania

| Poziom | Kolor | Kiedy używany |
|--------|-------|---------------|
| `INFO` | Biały | Normalne zdarzenia (logowanie, rejestracja) |
| `WARNING` | Żółty | Podejrzane zdarzenia lub nieudane operacje |
| `ERROR` | Czerwony | Krytyczne błędy wymagające uwagi |
| `DEBUG` | Szary | Szczegółowe informacje techniczne (tylko w trybie dev) |

### 12.5 Rejestrowane zdarzenia

Poniżej lista kluczowych zdarzeń zapisywanych w logach:

| Zdarzenie | Poziom | Opis wpisu |
|-----------|--------|------------|
| Logowanie użytkownika | INFO | Email + timestamp |
| Wylogowanie | INFO | Email + timestamp |
| Rejestracja na wydarzenie | INFO | Email + ID wydarzenia |
| Anulowanie rejestracji | INFO | Email + ID rejestracji |
| Potwierdzenie płatności (przez użytkownika) | INFO | Email + kwota + ID rejestracji |
| Weryfikacja płatności (przez admina) | INFO | Email admina + email użytkownika + ID |
| Odrzucenie płatności (przez admina) | WARNING | Email admina + powód |
| Zablokowanie konta | WARNING | Email admina + email użytkownika |
| Nadanie uprawnień admina | WARNING | Email admina + email promowanego |
| Nieudane logowanie | WARNING | IP + email |
| Błąd systemu płatności | ERROR | Szczegóły błędu |
| Błąd bazy danych | ERROR | Treść błędu SQL |
| Nieautoryzowany dostęp do panelu | WARNING | IP + URL |

### 12.6 Jak przeglądać logi – polecenia SSH

Połącz się z serwerem przez SSH:

```bash
ssh -i .secrets/KenazKeySSH.pem ec2-user@35.157.165.112
```

**Logi z bieżącego dnia:**

```bash
ls /opt/kenaz/logs/$(date +%d-%m-%Y)/
```

**Logi konkretnego użytkownika (bieżący dzień):**

```bash
cat /opt/kenaz/logs/$(date +%d-%m-%Y)/jan.kowalski@gmail.com.log
```

**Logi systemowe z konkretnej daty:**

```bash
cat /opt/kenaz/logs/15-01-2026/system.log
```

**Filtrowanie błędów ze wszystkich plików z bieżącego dnia:**

```bash
grep "ERROR" /opt/kenaz/logs/$(date +%d-%m-%Y)/*.log
```

**Podgląd logów w czasie rzeczywistym:**

```bash
tail -f /opt/kenaz/logs/$(date +%d-%m-%Y)/system.log
```

**Wyszukiwanie po emailu przez wiele dni:**

```bash
grep "jan.kowalski@gmail.com" /opt/kenaz/logs/**/*.log
```

### 12.7 Retencja logów

Logi są przechowywane bezterminowo, dopóki nie zostaną ręcznie usunięte lub nie skończy się miejsce na dysku. Zalecamy **cykliczne archiwizowanie** starszych logów (np. starszych niż 90 dni).

### 12.8 Uprawnienia do logów

Pliki logów są własnością użytkownika systemowego `ec2-user`. Dostęp do logów mają wyłącznie osoby posiadające klucz SSH. Logów **nie można** przeglądać przez interfejs webowy aplikacji.

---

---

# FAQ dla administratorów

**P: Użytkownik twierdzi, że zapłacił, ale płatność nie widnieje w systemie – co robię?**  
O: Sprawdź panel płatności manualnych (`/admin/manual-payments`). Upewnij się, że użytkownik kliknął „Potwierdzam wykonanie przelewu" w aplikacji. Jeśli nie, poinstruuj go, by to zrobił na stronie `/manual-payment/:registrationId`. Następnie sprawdź konto bankowe – jeśli wpłata dotarła, zatwierdź manualnie.

**P: Jak cofnąć zatwierdzenie konta użytkownika?**  
O: Możesz **zablokować** konto użytkownika z poziomu `/admin/all-users` (kliknij w użytkownika → „Zablokuj konto"). Konto wraca do statusu BANNED i wymaga ponownej akceptacji.

**P: Admin kliknął „Usuń wydarzenie" przez pomyłkę – czy można cofnąć?**  
O: Usunięcie wydarzeń jest **nieodwracalne** przez interfejs graficzny. W nagłym przypadku możesz przywrócić wydarzenie bezpośrednio z bazy danych przez SSH, o ile nie minęło zbyt wiele czasu (brak miękkiego kasowania). Skontaktuj się z dev teamem.

**P: Chcę dodać nowe miasto do listy dostępnych miast – jak to zrobię?**  
O: Dodawanie nowych miast wymaga interwencji na poziomie bazy danych lub konfiguracji backendu. Skontaktuj się z developerem aplikacji.

**P: Użytkownik prosi o usunięcie jego konta – jest takie RODO żądanie – co robię?**  
O: Usunięcie konta użytkownika wymaga interwencji bezpośrednio w bazie danych. Skontaktuj się z developerem. Przed usunięciem upewnij się, że użytkownik nie ma aktywnych rejestracji ani otwartych płatności.

**P: Jak zmienić cenę wydarzenia po tym, jak użytkownicy się już zapisali?**  
O: Edytuj wydarzenie przez `/admin/edit-event/:id` i zmień cenę. Istniejące rejestracje zachowują cenę, która obowiązywała w momencie ich rejestracji. Nowe rejestracje będą po nowej cenie.

**P: Jak wyeksportować listę uczestników danego wydarzenia?**  
O: Eksport listy uczestników na poziomie interfejsu nie jest dostępny w obecnej wersji. Możesz pobrać dane bezpośrednio z bazy danych przez SSH. Skontaktuj się z developerem.

**P: Ile miejsca zajmują logi na serwerze?**  
O: Zależy od aktywności aplikacji. Sprawdź: `du -sh /opt/kenaz/logs/` po zalogowaniu przez SSH. Jeśli katalog przekracza kilkaset MB, rozważ archiwizację starszych logów.

**P: Czy użytkownicy są informowani o weryfikacji lub odrzuceniu płatności?**  
O: Status płatności jest widoczny dla użytkownika w aplikacji – po zalogowaniu widzi aktualny status rejestracji i płatności na stronie panelu (`/panel`) i na stronie płatności (`/manual-payment/:id`). System nie wysyła automatycznych emaili – jeśli chcesz poinformować użytkownika, zrób to ręcznie.

---

---

# Słownik pojęć administratora

| Pojęcie | Definicja |
|---------|-----------|
| **BANNED** | Status konta zablokowanego przez administratora; użytkownik traci dostęp do płatnych funkcji |
| **Kafelek admina** | Rozszerzony panel informacyjny widoczny po kliknięciu użytkownika na liście `/admin/all-users`; zawiera dane o koncie, aktywności, finansach i oczekujących akcjach |
| **Korekta manualna** | Ręczny wpis bilansu finansowego dodany przez administratora poza normalnym systemem transakcji |
| **Log audytowy** | Plik tekstowy zapisujący zdarzenia systemowe z datą, godziną, poziomem i treścią komunikatu |
| **Manualna płatność** | Przelew bankowy wykonany przez użytkownika, wymagający ręcznej weryfikacji przez administratora |
| **PENDING** | Status konta oczekującego na akceptację administratora |
| **Podgląd na żywo** | Funkcja formularza tworzenia ikonek – prezentuje wygląd tworzonej ikony w czasie rzeczywistym, przed zapisaniem |
| **Promote** | Operacja nadania użytkownikowi uprawnień administratora, dostępna pod adresem `/admin/promote` |
| **Rola** | Poziom uprawnień użytkownika: Guest (gość), Member (członek), Admin (pełny dostęp do panelu) |
| **Standalone** | Tryb działania PWA na iOS, w którym aplikacja działa bez paska adresu Safari; istotne przy testowaniu logowania OAuth na urządzeniach Apple |
| **Status konta** | Stan konta użytkownika: Active (aktywny), Pending (oczekujący na akceptację), Banned (zablokowany) |
| **Weryfikacja płatności** | Proces ręcznego potwierdzenia przez administratora, że przelew bankowy od użytkownika dotarł i zgadza się z oczekiwaną kwotą |

---

*Instrukcja administratora – Kenaz Centrum, wersja 2.0, luty 2026.*  
*Dokument przeznaczony wyłącznie dla administratorów systemu. Nie udostępniaj go użytkownikom.*
