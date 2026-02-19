# STYLE.md

Globalne zasady stylu dla całej aplikacji frontend.

## 1. Zasady ogólne
- Styl ma być zwarty, czytelny i spójny z widokiem kalendarza.
- Preferowany wygląd: transparentne powierzchnie + wyraźne obramowanie.
- Unikamy ciężkich, pełnych wypełnień kafelków w widokach treści.

## 2. Layout i szerokość
- Każda strona treści używa kontenera `page-shell`.
- Domyślny kontener:
  - `max-w-4xl`
  - `px-3 sm:px-4`
  - `py-3 sm:py-6`
- Nie tworzymy własnych, konkurencyjnych wrapperów szerokości bez potrzeby.

## 3. Kafelki i obramowania
- Domyślna karta: `page-card`.
- Wariant ciaśniejszy: `page-card-tight`.
- Karty pomocnicze i sekcje: `rounded-2xl border border-navy/10 dark:border-cream/15 bg-transparent dark:bg-transparent`.
- Obramowanie ma być zawsze widoczne; preferowane jest tło transparentne albo półtransparentne.

## 4. Typografia
- Globalny font: `Inter` (zdefiniowany w `src/index.css`).
- Preferowane skale:
  - H1: `text-2xl sm:text-3xl` (większe tylko gdy jest realna potrzeba)
  - H2: `text-xl sm:text-2xl`
  - Treść: `text-sm` / `text-base`
- Unikać skoków typografii między widokami o tym samym poziomie ważności.

## 5. Hover i interakcje
- Globalny hover dla klikalnych elementów jest zdefiniowany w `src/index.css` dla:
  - `a`, `button`, `[role='button']`, `summary`, `[data-clickable='true']` w `.app-shell`.
- Efekt hover odpowiada wzorcowi z listy „Wydarzenia” w kalendarzu:
  - subtelny overlay tła (light/dark mode).
- Dodatkowe lokalne efekty (`scale`, mocny `shadow`) stosować oszczędnie.

## 6. Padding, marginesy, odstępy
- Sekcje stron: odstępy pionowe oparte o `gap-4`, `gap-6`, `space-y-4`, `space-y-6`.
- Karty: `p-4` lub `p-5` (rzadziej `p-6`, tylko dla dłuższych bloków treści).
- Nie rozszerzać stron ponad siatkę `page-shell`.

## 7. Przyciski i linki
- Używać globalnych klas przycisków z `src/index.css`:
  - `btn-primary` dla głównych CTA,
  - `btn-secondary` dla akcji pomocniczych,
  - `btn-nav` dla przycisków/linków nawigacyjnych.
- Główne CTA są domyślnie obramowane i transparentne (zgodnie z nową linią wizualną).
- Linki nawigacyjne i elementy list dziedziczą globalny hover.
- Stany `disabled` muszą pozostać czytelne i bez efektu aktywnej interakcji.
- W headerze aktywny endpoint ma zawsze ten sam lekki stan aktywny (`btn-nav` z subtelnie mocniejszym obramowaniem), spójny dla `Kalendarz`, `Sklep` i `Admin`.
- Dla nawigacji headera aktywność obejmuje także podstrony sekcji (np. `/admin/*`, `/shop/*`), nie tylko dokładnie jeden path.

## 8. Dark mode
- Każdy nowy komponent musi mieć równoważny styl dla dark mode.
- Obramowanie i kontrast tekstu muszą być zachowane (`border-cream/*`, `text-cream/*`).

## 9. Zasady implementacyjne
- Najpierw używaj istniejących klas globalnych (`page-shell`, `page-card`, `page-card-tight`, `btn-primary`, `btn-secondary`, `btn-nav`).
- Nowe klasy globalne dodawaj tylko gdy wzorzec realnie powtarza się w wielu widokach.
- Po zmianach stylu uruchamiaj `npm run build`.

## 10. Checklist przed mergem
- Czy widok używa `page-shell`?
- Czy karty są transparentne i mają obramowanie?
- Czy hover jest spójny z kalendarzem?
- Czy typografia i spacing pasują do reszty aplikacji?
- Czy dark mode wygląda poprawnie?

## 11. Formularze i błędy
- Walidacja formularzy ma być dwupoziomowa:
  - inline przy konkretnym polu (źródło prawdy dla użytkownika),
  - toast jako komunikat ogólny/syntetyczny.
- Każdy błąd pola musi mieć:
  - czerwone obramowanie pola (`border-red-*` + czerwony `focus` ring),
  - czerwony hint pod polem (`text-red-*`).
- Dla błędów walidacji backendowej mapowanych na konkretne pole (np. data w przeszłości) frontend ma próbować od razu pokazać ten błąd inline na odpowiednim polu.
- Toast nie zastępuje walidacji inline; toast tylko uzupełnia feedback.
- Dla akcji destrukcyjnych używamy wyłącznie systemowego custom confirm toast (`NotificationBanner`), nigdy natywnego `window.confirm`.
- Treść błędów pokazywana w toastach musi być znormalizowana do czytelnego tekstu; nie dopuszczamy `[object Object]`.

## 12. Tabele danych (compact)
- Dla widoków data-heavy (szczególnie admin) stosujemy wzorzec „compact table” jak w `/admin/payments`.
- Kontener tabeli:
  - `max-h-[32rem] overflow-auto rounded-2xl border border-navy/10 dark:border-cream/10`
- Tabela:
  - `min-w-full text-left text-xs`
- Nagłówek:
  - `bg-navy/5 dark:bg-cream/10`
  - komórki: `px-2 py-1.5 font-semibold uppercase tracking-wide`
- Wiersze i komórki:
  - każdy wiersz: `border-t border-navy/10 dark:border-cream/10 leading-tight`
  - komórki: `px-2 py-1.5`
- Dane liczbowe wyrównujemy do prawej (`text-right`).
- Priorytet czytelności i gęstości: domyślnie max 6 kolumn na tabelę.
- Jeśli tabela wspiera sortowanie:
  - nagłówki są klikalnymi `button`,
  - stan sortu jest widoczny w nagłówku,
  - dla multi-sortu pokazujemy kierunek i priorytet (np. `↑1`, `↓2`).
- Empty state pokazujemy jako pojedynczy wiersz z `colSpan` na pełną szerokość tabeli.
