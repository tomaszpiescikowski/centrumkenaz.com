# Software Requirements Specification (SRS) - System "Kenaz"
**Wersja dokumentu:** 1.0
**Status:** Draft - MVP
**Data:** 2024

---

## 1. Wstęp i Cel
Celem projektu jest stworzenie "mózgu" aplikacji webowej (bez strony lądowania/marketingowej) obsługującej społeczność offline. System ma charakter zamkniętej platformy (dostęp po weryfikacji) z modelem subskrypcyjnym, zapisami na wydarzenia i chatem.

### 1.1 Kluczowe założenia biznesowe
* **Model:** Freemium (Gość / Członek Płatny).
* **Skala:** Start do 1000 użytkowników, piki ruchu do 200 req/min.
* **Geografia:** Polska (czas serwera CET/CEST).
* **Platforma:** Web (Responsive), docelowo React Native (Mobile App).

---

## 2. Architektura i Stack Technologiczny
Zgodnie z wymaganiami, system stawia na wydajność backendu (Python) i prostotę operacyjną.

### 2.1 Backend
* **Język/Framework:** Python 3.14+ / **FastAPI**.
* **Dlaczego:** Asynchroniczność (obsługa chatu i requestów równolegle), automatyczna dokumentacja (Swagger UI), świetna integracja z AI w przyszłości.

### 2.2 Baza Danych
* **Typ:** Relacyjna (SQL).
* **Silnik:** **PostgreSQL** (Zalecany mimo obaw o "overkill". Przy obsłudze płatności, relacji chatowych i transakcji, SQLite nie obsłuży 100 użytkowników naraz ze względu na blokowanie pliku przy zapisie. PostgreSQL na AWS Lightsail/RDS jest tani i stabilny).
* **ORM:** SQLAlchemy (Async)

### 2.3 Frontend
* **Framework:** **React.js** 
* **Uzasadnienie:** Łatwa migracja logiki do **React Native** w przyszłości.
* **Stylizacja:** Tailwind CSS (szybkie stylowanie).

### 2.4 Infrastruktura i Zewn. Usługi
* **Hosting:** AWS Lightsail (kontener Docker) lub EC2 t3.micro. Koszt ~5-10 USD/mc.
* **Auth:** Google Identity Platform (OAuth 2.0).
* **Płatności:** **Tpay** (integracja via API/Webhooks).
* **Storage (Zdjęcia):** AWS S3 (lub kompatybilny, np. Cloudflare R2 - tańszy).

---

## 3. Wymagania Funkcjonalne

### 3.1 Autentykacja i Onboarding (Gatekeeper)
System nie posiada klasycznej rejestracji email/hasło. Jedyną metodą jest Google OAuth.

**Przepływ:**
1.  Użytkownik klika "Zaloguj z Google" na stronie głównej.
2.  **Scenariusz A (Nowy User):**
    * System tworzy konto ze statusem `STATUS: PENDING`.
    * Użytkownik widzi ekran: "Twoje konto oczekuje na weryfikację Administratora".
    * Brak dostępu do "wnętrza" aplikacji.
3.  **Proces Weryfikacji (Admin):**
    * Admin widzi listę nowych zgłoszeń (Imię, Nazwisko, Email z Google).
    * Admin klika "Zatwierdź" lub "Odrzuć".
4.  **Scenariusz B (User Zweryfikowany):**
    * Po ponownym logowaniu (lub odświeżeniu po akceptacji), użytkownik wchodzi do aplikacji.
    * Pierwsze logowanie wymusza uzupełnienie: Miasto, Data Urodzenia (jeśli Google tego nie zwróci).

### 3.2 Interfejs Użytkownika (UI/UX)
* **Desktop:**
    * Centralne logo + "Pajęcza Nić" (animowane połączenia SVG/Canvas) prowadzące do modułów.
    * Efekt hover (powiększenie) i click (przejście).
* **Mobile (< 768px):**
    * **Wyłączenie** pajęczej nici.
    * Widok praktyczny: Prosta lista kafelkowa lub Grid 2x3 (ikona + podpis).
    * Priorytet: Szybki dostęp kciukiem, brak skomplikowanych animacji obciążających baterię.

### 3.3 Moduł: Kalendarz i Wydarzenia
* **Widok:** Lista wydarzeń lub Kalendarz (biblioteka np. `react-big-calendar`).
* **Logika Zapisów:**
    * **Gość:** Widzi wydarzenie, przycisk "Zapisz" nieaktywny -> przekierowanie do oferty Subskrypcji.
    * **Członek (Subskrybent):**
        * Cena 0 PLN: Klik -> Zapisany -> Email potwierdzający.
        * Cena > 0 PLN: Klik -> Przekierowanie do Tpay -> Powrót (Success URL) -> Zapisany.
* **Zwroty (Polityka 24h):**
    * Użytkownik klika "Zrezygnuj" w profilu.
    * **Warunek:** Jeśli `czas_do_startu > 24h`:
        * System usuwa usera z listy.
        * System wysyła request do API Tpay o zwrot środków (refund) na kartę LUB (wersja MVP) wysyła email do Admina "Dokonaj zwrotu dla X" (jeśli automatyzacja Tpay jest zbyt kosztowna wdrożeniowo).
        * *Decyzja:* W MVP sugerowany zwrot automatyczny, jeśli Tpay API na to pozwala bez dodatkowych opłat, w przeciwnym razie flaga "Do zwrotu" w panelu admina.
    * **Warunek:** Jeśli `czas_do_startu < 24h`: Komunikat "Za późno na zwrot środków".

### 3.4 Moduł: Płatności i Subskrypcja
* **Provider:** Tpay.
* **Produkt:** Subskrypcja odnawialna (Recurring Payments / Płatności cykliczne kartą).
* **Logika:**
    * Frontend wywołuje metodę płatności Tpay (zapisanie karty).
    * System przechowuje `token_karty` (nie numer!).
    * **Cron Job (Skrypt Python):** Raz dziennie sprawdza, czyja subskrypcja wygasa. Jeśli tak -> wysyła request obciążenia karty przez API Tpay.
    * Failure (Brak środków): 3 próby (dzień po dniu), potem zmiana statusu na `Gość`.
* **Potwierdzenia:** Prosty email tekstowy/HTML "Płatność przyjęta". Brak generowania PDF.

### 3.5 Moduł: Chat
* **Technologia:** WebSockets (FastAPI wspiera to natywnie).
* **Struktura:**
    * Lista kanałów pobierana z bazy.
    * Kanały Eventowe (tymczasowe): Dostępne tylko dla userów z rekordem w tabeli `Registrations` dla danego Eventu.
* **Funkcje:**
    * Wysyłanie tekstu.
    * Wysyłanie zdjęć (Upload -> AWS S3 -> Link na chacie).
    * Historia: Ładowana przy wejściu (ostatnie 50 wiadomości), infinite scroll w górę.

### 3.6 Panel Administratora (Custom Dashboard)
Prosty panel napisany w tym samym React co aplikacja, dostępny dla flagi `is_admin=True`.

* **Zarządzanie Użytkownikami:**
    * Tabela "Oczekujący": Przyciski [Zatwierdź] / [Odrzuć].
    * Lista wszystkich userów z statusem subskrypcji.
* **Zarządzanie Wydarzeniami:**
    * Formularz: Tytuł, Data, Cena, Limit miejsc, Miasto.
    * Checkbox: "Wydarzenie Cykliczne" (np. powtarzaj co tydzień przez 3 miesiące). Backend generuje wtedy N osobnych instancji wydarzeń w bazie.
* **Statystyki:**
    * Liczba aktywnych subskrybentów (liczba).
    * Przychód w bieżącym miesiącu (suma z transakcji).

---

## 4. Model Danych (Uproszczony Schema SQL)

```sql
-- Użytkownicy
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    google_id VARCHAR(255) UNIQUE,
    email VARCHAR(255) UNIQUE,
    full_name VARCHAR(255),
    role VARCHAR(20) DEFAULT 'guest', -- guest, member, admin
    account_status VARCHAR(20) DEFAULT 'pending', -- pending, active, banned
    subscription_end_date TIMESTAMP NULL,
    card_token VARCHAR(255) NULL, -- Token z Tpay
    city VARCHAR(100),
    points INT DEFAULT 0
);

-- Wydarzenia
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255),
    start_date TIMESTAMP,
    city VARCHAR(100),
    price DECIMAL(10, 2),
    max_participants INT,
    is_big_event BOOLEAN DEFAULT FALSE
);

-- Zapisy (Łączy Usera z Eventem)
CREATE TABLE registrations (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    event_id INT REFERENCES events(id),
    status VARCHAR(20), -- confirmed, cancelled
    payment_id VARCHAR(255), -- ID transakcji Tpay
    created_at TIMESTAMP DEFAULT NOW()
);

-- Chat
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    channel_id VARCHAR(50), -- np. 'general', 'event_123'
    user_id INT REFERENCES users(id),
    content TEXT,
    image_url TEXT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 5. Wymagania Niefunkcjonalne (Ograniczenia)
1.  **Bezpieczeństwo:** Cała komunikacja szyfrowana SSL (HTTPS). Tokeny sesyjne (JWT) ważne krótko (np. 15 min) + Refresh Token.
2.  **Obsługa Błędów:** W przypadku awarii Tpay, system nie zapisuje na wydarzenie płatne.
3.  **Backup:** Baza danych backupowana raz dziennie (AWS RDS automated backups).

## 6. Plan Wdrożenia (Next Steps)
1.  **Setup:** Konfiguracja repozytorium (GitHub), FastAPI + Docker.
2.  **Etap 1 (Auth):** Logowanie Google i Panel Admina do zatwierdzania.
3.  **Etap 2 (Core):** Kalendarz, CRUD wydarzeń, podstawowy Profil.
4.  **Etap 3 (Płatności):** Integracja Tpay (Subskrypcje i Jednorazowe).
5.  **Etap 4 (Social):** Chat (Websockets) i Punkty.
