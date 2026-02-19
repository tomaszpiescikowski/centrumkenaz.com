# Dokumentacja API Backend - Kenaz

## Spis treści
- [Auth (Autentykacja)](#auth-autentykacja)
- [Cities (Miasta)](#cities-miasta)
- [Events (Wydarzenia)](#events-wydarzenia)
- [Registrations (Rejestracje)](#registrations-rejestracje)
- [Users (Użytkownicy)](#users-użytkownicy)
- [Payments (Płatności)](#payments-płatności)
- [Products (Produkty)](#products-produkty)
- [Uploads (Przesyłanie plików)](#uploads-przesyłanie-plików)
- [Admin (Panel administracyjny)](#admin-panel-administracyjny)

---

## Auth (Autentykacja)

### `GET /auth/google/login`
**Use case:** Inicjalizacja logowania przez Google OAuth  
**Frontend:** Używany w komponencie `AuthContext.jsx` w funkcji `login()` - kiedy użytkownik klika przycisk logowania Google, przekierowuje na ten endpoint, który z kolei przekierowuje na stronę logowania Google.

### `GET /auth/google/callback`
**Use case:** Obsługa callback z Google OAuth po zalogowaniu  
**Frontend:** Automatycznie wywoływany przez Google po pomyślnym logowaniu. Backend przetwarza kod autoryzacyjny i przekierowuje na `/auth/callback` w frontend z JWT tokenami.

### `POST /auth/password/register`
**Use case:** Rejestracja nowego użytkownika za pomocą nazwy użytkownika, email i hasła  
**Frontend:** Używany w `AuthContext.jsx` w funkcji `registerWithPassword()` - formularz rejestracji na stronie logowania.

### `POST /auth/password/login`
**Use case:** Logowanie użytkownika za pomocą nazwy użytkownika/email i hasła  
**Frontend:** Używany w `AuthContext.jsx` w funkcji `loginWithPassword()` - formularz logowania na stronie logowania.

### `POST /auth/refresh`
**Use case:** Odświeżenie access tokenu przy użyciu refresh tokenu  
**Frontend:** Używany w `AuthContext.jsx` w funkcji `refreshAccessToken()` - automatycznie wywoływany gdy access token wygaśnie, aby uzyskać nowy bez konieczności ponownego logowania użytkownika.

### `GET /auth/me`
**Use case:** Pobranie informacji o zalogowanym użytkowniku (profil, subskrypcja, punkty, zainteresowania)  
**Frontend:** Używany w `AuthContext.jsx` podczas inicjalizacji aplikacji, po zalogowaniu i przy odświeżaniu profilu - ładuje pełny profil użytkownika wraz ze statusem subskrypcji i ewentualnymi oczekującymi płatnościami manualnymi.

---

## Cities (Miasta)

### `GET /cities/`
**Use case:** Pobranie listy wszystkich miast dostępnych w systemie  
**Frontend:** Używany w `CityContext.jsx` podczas ładowania aplikacji - dostarcza listę miast do filtrowania wydarzeń na stronie głównej (kalendarz wydarzeń). Użytkownik może wybrać miasto z menu i zobaczyć tylko wydarzenia w tym mieście.

---

## Events (Wydarzenia)

### `GET /events/`
**Use case:** Pobranie listy wydarzeń z opcjonalnym filtrowaniem po dacie i mieście  
**Frontend:** Używany w `Calendar.jsx` w funkcji `fetchEventsForMonth()` - główny widok kalendarza wydarzeń na stronie głównej. Ładuje wydarzenia dla wybranego miesiąca i opcjonalnie filtruje po mieście.

**Parametry:**
- `start_from` - data początkowa (YYYY-MM-DD)
- `start_to` - data końcowa (YYYY-MM-DD)
- `month` - miesiąc (YYYY-MM)
- `city` - nazwa miasta
- `limit` - max liczba wyników

### `GET /events/{event_id}`
**Use case:** Pobranie szczegółów pojedynczego wydarzenia  
**Frontend:** Używany w `EventDetails.jsx` przy otwieraniu strony szczegółów wydarzenia - wyświetla pełne informacje o wydarzeniu, ceny, lokalizację, opis.

### `GET /events/registered`
**Use case:** Pobranie listy ID wydarzeń, na które zalogowany użytkownik jest zarejestrowany  
**Frontend:** Używany w `Calendar.jsx` - zaznacza na kalendarzu wydarzenia, na które użytkownik jest już zarejestrowany (inne kolory/ikony).

### `GET /events/{event_id}/availability`
**Use case:** Sprawdzenie dostępności miejsc na wydarzeniu  
**Frontend:** Używany w `Calendar.jsx` i `EventDetails.jsx` - wyświetla liczbę wolnych miejsc, czy wydarzenie jest pełne, czy użytkownik może się jeszcze zarejestrować.

### `GET /events/{event_id}/participants`
**Use case:** Pobranie listy uczestników wydarzenia (dla zalogowanych użytkowników i administratorów)  
**Frontend:** Używany w `EventDetails.jsx` - wyświetla listę osób zarejestrowanych na wydarzenie, ich imiona i status członkostwa.

### `GET /events/{event_id}/waitlist`
**Use case:** Pobranie listy oczekujących na wydarzenie (lista rezerwowa)  
**Frontend:** Używany w `EventDetails.jsx` - wyświetla listę osób na liście rezerwowej gdy wydarzenie jest pełne.

### `POST /events/{event_id}/register`
**Use case:** Rejestracja użytkownika na wydarzenie  
**Frontend:** Używany w `RegisterButton.jsx` - główny przycisk rejestracji na wydarzenie. Po kliknięciu:
- Sprawdza czy użytkownik jest zalogowany
- Jeśli wydarzenie jest bezpłatne - rejestruje od razu
- Jeśli płatne - zwraca URL do bramki płatności i przekierowuje użytkownika
- Obsługuje płatności manualne i listę rezerwową

**Payload:**
```json
{
  "return_url": "http://frontend.com/event/123?payment=success",
  "cancel_url": "http://frontend.com/event/123?payment=cancelled"
}
```

### `DELETE /events/{event_id}/register`
**Use case:** Anulowanie rejestracji użytkownika na wydarzenie (uproszczona wersja)  
**Frontend:** Opcjonalne - głównie używany endpoint `/registrations/{registration_id}/cancel` do bardziej zaawansowanego anulowania.

### `POST /events/` (Admin)
**Use case:** Utworzenie nowego wydarzenia (tylko administrator)  
**Frontend:** Używany w `AdminEventCreate.jsx` - strona tworzenia nowego wydarzenia w panelu administracyjnym. Ustawia wszystkie parametry wydarzenia: tytuł, opis, typ, daty, ceny, limity uczestników, politykę anulowania.

### `PUT /events/{event_id}` (Admin)
**Use case:** Edycja istniejącego wydarzenia (tylko administrator)  
**Frontend:** Używany w `AdminEventEdit.jsx` - strona edycji wydarzenia w panelu administracyjnym.

### `DELETE /events/{event_id}` (Admin)
**Use case:** Usunięcie wydarzenia (tylko administrator)  
**Frontend:** Używany w `AdminEventEdit.jsx` lub liście wydarzeń w panelu admina - przycisk usuwania wydarzenia.

---

## Registrations (Rejestracje)

### `POST /registrations/{registration_id}/cancel`
**Use case:** Anulowanie rejestracji z możliwością użycia "rescue" (awaryjne anulowanie)  
**Frontend:** Używany w `Account.jsx` na stronie "Moje rejestracje" - przycisk anulowania rejestracji. Użytkownik może:
- Anulować normalnie (w ramach terminu cutoff)
- Użyć rescue (awaryjne anulowanie poza terminem, limitowane)
- System automatycznie obsługuje zwroty płatności

**Payload:**
```json
{
  "use_rescue": false
}
```

### `GET /registrations/{registration_id}/manual-payment`
**Use case:** Pobranie szczegółów płatności manualnej (przelew bankowy)  
**Frontend:** Używany w `Account.jsx` - wyświetla:
- Numer referencyjny przelewu
- Kwotę do zapłaty
- URL z instrukcjami płatności
- Deadline na potwierdzenie
- Status płatności

### `POST /registrations/{registration_id}/manual-payment/confirm`
**Use case:** Potwierdzenie przez użytkownika wykonania płatności manualnej  
**Frontend:** Używany w `Account.jsx` - przycisk "Potwierdzam wykonanie przelewu". Użytkownik klika gdy wykonał przelew, następnie admin musi zaakceptować płatność w panelu administracyjnym.

---

## Users (Użytkownicy)

### `GET /users/me/profile`
**Use case:** Pobranie profilu zalogowanego użytkownika  
**Frontend:** Używany w `Account.jsx` na zakładce profilu - wyświetla imię, email, zdjęcie, bio, zainteresowania.

### `PUT /users/me/profile`
**Use case:** Aktualizacja profilu użytkownika (bio, zainteresowania)  
**Frontend:** Używany w `Account.jsx` - formularz edycji profilu, gdzie użytkownik może:
- Zmienić "O mnie" (do 800 znaków)
- Wybrać zainteresowania (tagi)

### `GET /users/{user_id}/profile`
**Use case:** Pobranie publicznego profilu innego użytkownika  
**Frontend:** Używany przy wyświetlaniu listy uczestników wydarzenia - można kliknąć na użytkownika i zobaczyć jego profil.

### `GET /users/me/registrations`
**Use case:** Pobranie wszystkich rejestracji zalogowanego użytkownika  
**Frontend:** Używany w `Account.jsx` na zakładce "Moje wydarzenia" - lista wszystkich wydarzeń użytkownika (przyszłe i archiwalne) z:
- Statusem rejestracji
- Możliwością anulowania
- Dostępnością rescue
- Szczegółami płatności manualnej

### `POST /users/me/join-request`
**Use case:** Wysłanie prośby o dołączenie (approval request)  
**Frontend:** Używany gdy nowy użytkownik ma status "pending" - wypełnia formularz z bio i zainteresowaniami, aby admin mógł zaakceptować konto.

---

## Payments (Płatności)

### `GET /payments/subscription/plans`
**Use case:** Pobranie listy dostępnych planów subskrypcji  
**Frontend:** Używany w `Plans.jsx` - strona z planami subskrypcji, wyświetla karty z:
- Nazwą planu (Free/Pro/Ultimate)
- Ceną
- Czasem trwania
- Korzyściami

### `POST /payments/subscription/checkout`
**Use case:** Utworzenie sesji płatności dla subskrypcji  
**Frontend:** Używany w `Plans.jsx` - po kliknięciu "Kup plan" przekierowuje do bramki płatności.

**Payload:**
```json
{
  "plan_code": "pro",
  "return_url": "http://frontend.com/plans?payment=success",
  "cancel_url": "http://frontend.com/plans?payment=cancelled"
}
```

### `POST /payments/subscription/free`
**Use case:** Zmiana na darmowy plan subskrypcji  
**Frontend:** Używany w `Plans.jsx` - przycisk downgrade do planu darmowego.

### `GET /payments/{payment_id}/status`
**Use case:** Sprawdzenie statusu płatności  
**Frontend:** Używany po powrocie z bramki płatności - weryfikuje czy płatność została zakończona pomyślnie.

### `POST /payments/webhook` (Webhook)
**Use case:** Webhook od bramki płatności informujący o zmianie statusu płatności  
**Frontend:** BRAK - to endpoint dla zewnętrznej bramki płatności, nie wywoływany z frontendu.

### Endpointy testowe (fake payment gateway)

**OSTRZEŻENIE:** Te endpointy działają tylko gdy `PAYMENT_GATEWAY_TYPE=fake` (środowisko deweloperskie)

### `GET /payments/fake/checkout`
**Use case:** Symulowana strona płatności (development)  
**Frontend:** Backend przekierowuje na tę stronę zamiast prawdziwej bramki płatności - wyświetla formularz gdzie można zatwierdzić lub anulować płatność.

### `POST /payments/fake/checkout/approve`
**Use case:** Zatwierdzenie testowej płatności  
**Frontend:** Przycisk "Zatwierdź płatność" na fake checkout page.

### `POST /payments/fake/checkout/decline`
**Use case:** Odrzucenie testowej płatności  
**Frontend:** Przycisk "Anuluj płatność" na fake checkout page.

---

## Products (Produkty)

### `GET /products`
**Use case:** Pobranie listy aktywnych produktów w katalogu  
**Frontend:** Obecnie niewykorzystywany - przygotowany pod przyszły sklep z gadżetami/produktami.

---

## Uploads (Przesyłanie plików)

### `POST /uploads/image` (Admin)
**Use case:** Upload zdjęć (tylko administrator)  
**Frontend:** Używany w `AdminEventCreate.jsx` i innych miejscach gdzie admin może dodać obrazek (np. zdjęcie wydarzenia, produktu).

**Ograniczenia:**
- Max 5MB
- Formaty: JPEG, PNG, WebP, GIF

**Response:**
```json
{
  "url": "/uploads/abc123def.jpg"
}
```

---

## Admin (Panel administracyjny)

### `GET /admin/stats/events`
**Use case:** Statystyki wydarzeń (liczba uczestników, przychody, wykorzystanie miejsc)  
**Frontend:** Używany w `AdminPayments.jsx` i dashboardzie admina - wyświetla tabelę z:
- Tytułem wydarzenia
- Liczbą potwierdzonych uczestników
- Procentem wypełnienia
- Sumą wpłat

**Parametry:**
- `month` - filtrowanie po miesiącu (YYYY-MM)

### `GET /admin/stats/users`
**Use case:** Statystyki użytkowników (aktywność, suma wpłat, punkty)  
**Frontend:** Używany w `AdminUsers.jsx` - tabela użytkowników z:
- Liczbą wydarzeń
- Sumą wpłat
- Punktami lojalnościowymi
- Statusem konta
- Ostatnią płatnością

### `GET /admin/stats/payments`
**Use case:** Statystyki płatności (agregacja według statusu i typu)  
**Frontend:** Używany w `AdminPayments.jsx` - podsumowanie:
- Płatności według statusu (pending/completed/failed)
- Płatności według typu (event/subscription)
- Łączne kwoty

**Parametry:**
- `month` - filtrowanie po miesiącu (YYYY-MM)

### `GET /admin/stats/registrations`
**Use case:** Statystyki rejestracji (według statusu, trendów)  
**Frontend:** Używany w `AdminPayments.jsx` i dashboardzie - podsumowanie:
- Rejestracje według statusu
- Trendy w czasie
- Statystyki anulowań

**Parametry:**
- `month` - filtrowanie po miesiącu (YYYY-MM)

### `GET /admin/users/pending`
**Use case:** Pobranie listy użytkowników oczekujących na akceptację  
**Frontend:** Używany w `AdminUsersApproval.jsx` - lista nowych użytkowników, którzy wysłali join request i czekają na zatwierdzenie przez admina.

### `POST /admin/users/{user_id}/approve`
**Use case:** Zatwierdzenie konta użytkownika (zmiana z pending na active)  
**Frontend:** Używany w `AdminUsersApproval.jsx` - przycisk "Zatwierdź" przy każdym użytkowniku. Po zatwierdzeniu użytkownik może w pełni korzystać z systemu.

### `GET /admin/manual-payments/pending`
**Use case:** Pobranie listy płatności manualnych oczekujących na weryfikację  
**Frontend:** Używany w `AdminManualPayments.jsx` - lista użytkowników, którzy:
- Zadeklarowali wykonanie przelewu
- Czekają na potwierdzenie przez admina
Wyświetla numer referencyjny, kwotę, wydarzenie.

### `POST /admin/manual-payments/{registration_id}/approve`
**Use case:** Zatwierdzenie płatności manualnej przez administratora  
**Frontend:** Używany w `AdminManualPayments.jsx` - przycisk "Potwierdź płatność". Po kliknięciu:
- Rejestracja zmienia status na "confirmed"
- Użytkownik otrzymuje dostęp do wydarzenia
- System aktualizuje statystyki

### `GET /admin/manual-payments/refunds`
**Use case:** Pobranie listy zadań zwrotu środków (gdy użytkownik anulował płatną rejestrację)  
**Frontend:** Używany w `AdminManualRefunds.jsx` - lista zwrotów do wykonania przez admina:
- Użytkownik anulował rejestrację
- Trzeba zwrócić pieniądze przelewem
- Pokazuje kwotę, wydarzenie, dane użytkownika

### `PATCH /admin/manual-payments/refunds/{task_id}`
**Use case:** Aktualizacja statusu zadania zwrotu  
**Frontend:** Używany w `AdminManualRefunds.jsx` - gdy admin wykonał przelew zwrotny, oznacza zadanie jako "completed".

**Payload:**
```json
{
  "status": "completed"
}
```

### `GET /admin/manual-payments/promotions`
**Use case:** Pobranie listy promocji z listy rezerwowej wymagających akcji  
**Frontend:** Używany w panelu admina - gdy zwolni się miejsce na wydarzeniu:
- Użytkownik z listy rezerwowej został awansowany
- Jeśli wydarzenie jest płatne, admin musi potwierdzić promocję
- Lista pokazuje kto czeka na potwierdzenie awansu

### `PATCH /admin/manual-payments/promotions/{registration_id}`
**Use case:** Aktualizacja statusu promocji z listy rezerwowej  
**Frontend:** Używany w panelu admina - admin może:
- Potwierdzić promocję (użytkownik dostaje miejsce)
- Odrzucić promocję (miejsce wraca do puli)

**Payload:**
```json
{
  "status": "completed"
}
```

---

## Podsumowanie przepływów użytkownika

### Rejestracja na bezpłatne wydarzenie
1. Użytkownik przegląda kalendarz: `GET /events/`
2. Klika na wydarzenie: `GET /events/{event_id}`
3. Sprawdza dostępność: `GET /events/{event_id}/availability`
4. Klika "Zarejestruj się": `POST /events/{event_id}/register`
5. System od razu potwierdza rejestrację
6. Zaaktualizowana lista rejestracji: `GET /users/me/registrations`

### Rejestracja na płatne wydarzenie (automatyczna bramka)
1. Kroki 1-4 jak wyżej
2. Backend zwraca `redirect_url` do bramki płatności
3. Frontend przekierowuje użytkownika
4. Użytkownik płaci w bramce
5. Bramka wywołuje webhook: `POST /payments/webhook`
6. Backend przetwarza płatność i potwierdza rejestrację
7. Użytkownik wraca: `return_url?payment=success`
8. Frontend sprawdza status: `GET /payments/{payment_id}/status`

### Rejestracja na płatne wydarzenie (płatność manualna)
1. Kroki 1-4 jak wyżej
2. Backend zwraca dane do przelewu manualnego
3. Frontend wyświetla instrukcje, nr referencyjny, termin
4. Użytkownik wykonuje przelew w swoim banku
5. Użytkownik wraca i klika "Potwierdzam wykonanie przelewu": `POST /registrations/{registration_id}/manual-payment/confirm`
6. Rejestracja przechodzi w stan "pending_manual_verification"
7. Admin widzi w panelu: `GET /admin/manual-payments/pending`
8. Admin sprawdza konto bankowe, widzi przelew
9. Admin zatwierdza: `POST /admin/manual-payments/{registration_id}/approve`
10. Rejestracja zmienia status na "confirmed"

### Anulowanie rejestracji
1. Użytkownik wchodzi na "Moje wydarzenia": `GET /users/me/registrations`
2. Widzi przycisk "Anuluj" przy rejestracji
3. System pokazuje czy:
   - Anulowanie normalne (w terminie)
   - Anulowanie rescue (awaryjne, poza terminem)
4. Użytkownik klika "Anuluj": `POST /registrations/{registration_id}/cancel`
5. Jeśli płatność automatyczna - backend automatycznie zwraca pieniądze przez bramkę
6. Jeśli płatność manualna:
   - Tworzy się zadanie zwrotu: widoczne w `GET /admin/manual-payments/refunds`
   - Admin wykonuje przelew zwrotny
   - Admin oznacza jako wykonane: `PATCH /admin/manual-payments/refunds/{task_id}`

### Subskrypcja
1. Użytkownik wchodzi w "Plany": `GET /payments/subscription/plans`
2. Wybiera plan i klika "Kup": `POST /payments/subscription/checkout`
3. Przekierowanie do bramki płatności
4. Płatność i webhook: `POST /payments/webhook`
5. Backend aktualizuje subskrypcję użytkownika
6. Powrót na stronę: `GET /auth/me` (odświeżenie profilu z nową datą końca subskrypcji)

### Akceptacja nowego użytkownika
1. Nowy użytkownik rejestruje się: `POST /auth/password/register`
2. Użytkownik ma status "pending"
3. Wypełnia formularz join request: `POST /users/me/join-request`
4. Admin widzi listę: `GET /admin/users/pending`
5. Admin sprawdza profil, zainteresowania
6. Admin akceptuje: `POST /admin/users/{user_id}/approve`
7. Użytkownik może teraz w pełni korzystać z platformy

---

## Bezpieczeństwo i autoryzacja

### Endpointy publiczne (bez logowania)
- `GET /cities/`
- `GET /events/` (listowanie)
- `GET /events/{event_id}` (szczegóły)
- `GET /products`
- `POST /auth/password/register`
- `POST /auth/password/login`
- `GET /auth/google/login`
- `GET /auth/google/callback`

### Endpointy wymagające logowania
- Wszystkie w `/users/me/*`
- Wszystkie w `/registrations/*`
- Wszystkie w `/payments/*` (oprócz webhook)
- `POST /events/{event_id}/register`
- `GET /events/registered`
- `GET /events/{event_id}/participants`

### Endpointy tylko dla administratora
- Wszystkie w `/admin/*`
- `POST /events/` (create)
- `PUT /events/{event_id}` (update)
- `DELETE /events/{event_id}` (delete)
- `POST /uploads/image`

### Dodatkowe sprawdzenia
- **Ownership check**: Użytkownik może anulować tylko swoje rejestracje
- **Status check**: Niektóre akcje wymagają statusu konta "active" (a nie "pending")
- **Subscription check**: Niektóre wydarzenia wymagają aktywnej subskrypcji
- **Payment verification**: Admin/właściciel dla dostępu do szczegółów płatności

---

## Rate limiting

Wszystkie endpointy publiczne mają rate limiting:
- Endpointy publiczne: limit wywołań/minutę z tego samego IP
- Endpointy autoryzowane: limit wywołań/minutę per użytkownik
- Webhook: osobny limit dla bezpieczeństwa

---

## Wskazówki deweloperskie

### Testowanie płatności
W środowisku deweloperskim (`PAYMENT_GATEWAY_TYPE=fake`):
- Bramka płatności jest symulowana
- Możesz zatwierdzać/odrzucać płatności ręcznie
- Nie są wysyłane prawdziwe żądania do Tpay/Stripe

### Debugowanie
- Sprawdź logi backendu dla szczegółów błędów
- Frontend wywołuje większość endpointów przez `authFetch()` - sprawdź konsole browser dev tools
- W razie problemów z autoryzacją - sprawdź czy token nie wygasł (`GET /auth/me`)

### Nowe funkcje
Przy dodawaniu nowych endpointów:
1. Utwórz model w `backend/models/`
2. Dodaj router w `backend/routers/`
3. Dodaj testy w `backend/tests/`
4. Dodaj funkcje API w `src/api/`
5. Użyj w komponentach React
6. Zaktualizuj ten README!
