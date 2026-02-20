# Modele domeny Kenaz

Ten plik opisuje relacje miedzy modelami oraz kontekst biznesowy aplikacji Kenaz.

## Kontekst biznesowy (Kenaz)

Kenaz to aplikacja do organizacji wydarzen i zapisow uczestnikow. Uzytkownicy moga
rejestrowac sie na wydarzenia, przechodzic przez proces platnosci (online lub
manualny), a admini zarzadzaja akceptacja kont i weryfikacja platnosci manualnych.
System wspiera zasady subskrypcji (np. ceny dla czlonkow), listy rezerwowe, limity
miejsc, a takze polityke anulowania zapisow.

Kluczowe procesy:
- Rejestracja na wydarzenie z kontrola limitow miejsc.
- Platnosci za wydarzenia i subskrypcje (statusy, webhooki, refundy).
- Subskrypcje dajace uprawnienia cenowe i punkty lojalnosciowe.
- Manualna weryfikacja platnosci oraz zadania refundow.
- Akceptacja kont przez administratora.

## Relacje miedzy modelami

### Uzytkownicy i profile
- User 1:1 UserProfile
  - UserProfile przechowuje `about_me` oraz `interest_tags`.
- User 1:1 Subscription
  - Subscription trzyma `end_date` i `points` (punkty lojalnosciowe).
- User 1:1 ApprovalRequest
  - ApprovalRequest wskazuje, ze uzytkownik zlozyl wniosek o akceptacje.
- User 1:1 PaymentMethod
  - PaymentMethod przechowuje token karty/gateway, bez danych wrażliwych.

### Wydarzenia i rejestracje
- Event 1:N Registration
  - Registration reprezentuje zapis konkretnego uzytkownika na dane wystapienie
    wydarzenia (`occurrence_date`).
- User 1:N Registration
  - Jeden uzytkownik moze miec wiele zapisow na rozne wydarzenia.

### Platnosci
- User 1:N Payment
  - Payment przechowuje transakcje za wydarzenia lub subskrypcje.
- Registration -> Payment (przez `payment_id` jako zewnetrzny identyfikator)
  - Rejestracja moze byc powiazana z platnoscia w zaleznosci od trybu.

### Refundy
- Registration 1:1 RegistrationRefundTask
  - Zadanie refundu powstaje przy anulowaniu i jest recenzowane przez admina.
- User 1:N RegistrationRefundTask
  - Zapewnia audyt: kto byl uczestnikiem i kto zatwierdzil refund.

### Miasta i wydarzenia
- City 1:N Event
  - City to slownik miasta, wykorzystywany w filtrowaniu i prezentacji wydarzen.

### Produkty
- Product jest niezalezny od reszty domeny wydarzen.
  - Uzywany do katalogu ofert (np. merch) i nie jest powiazany z Registration.

## Uwagi implementacyjne

- Relacje 1:1 sa utrzymywane przez wspolny klucz `user_id` i `ondelete="CASCADE"`.
- Pola takie jak statusy platnosci i rejestracji sa definiowane jako enumy w kodzie.
- Rejestracja moze byc w statusach oczekujacych (manual payment) i zajmuje miejsce
  na wydarzeniu zgodnie z polityka w RegistrationService.
