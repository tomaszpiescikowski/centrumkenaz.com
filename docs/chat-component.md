# Komponent Czatu ??? Dokumentacja Techniczna

> Plik ??r??d??owy CSS: `src/components/common/CommentsSection.css`  
> Plik ??r??d??owy JSX: `src/components/common/CommentsSection.jsx`  
> Strona czatu: `src/pages/chat/ChatPage.jsx`

---

## 1. Architektura og??lna

### 1.1 Hierarchia layoutu (ChatPage)

```
<div class="cp-root">           ??? position: fixed; top/height ustawiane przez visualViewport
  <div class="cp-header">       ??? nag????wek; chowany przez .kb-open (klawiatura mobilna)
  <div class="cp-body">         ??? flex: 1; overflow: hidden
    <section class="cmt-section cmt-messenger">
      <div class="cmt-list-messenger">    ??? flex: 1; overflow-y: auto (scrollowalny)
      <form class="cmt-new-form">         ??? flex-shrink: 0 (przyklejony do do??u)
```

`cp-root` dostaje inline `style.top` i `style.height` z Viewport API gdy otwiera si?? klawiatura mobilna, dzi??ki czemu compose box jest zawsze nad klawiatur??.

### 1.2 Widoczno???? nag????wka i nawigacji na klawiaturze

```js
// ChatPage.jsx ??? useEffect
vv.addEventListener('resize', () => {
  const kbOpen = vv.height < window.innerHeight - 100
  document.documentElement.classList.toggle('kb-open', kbOpen)
  if (kbOpen) {
    el.style.top    = vv.offsetTop + 'px'
    el.style.height = vv.height + 'px'
  } else {
    el.style.top = ''; el.style.height = ''
  }
})
```

```css
.kb-open .cp-header     { display: none !important; }
.kb-open [data-kb-hide] { display: none !important; } /* MobileBottomNav <nav> */
```

---

## 2. Prop `messengerLayout`

`CommentsSection` przyjmuje prop `messengerLayout: boolean`.  
Gdy `true`, komponent renderuje si?? w trybie czatu (widok `/chat`):

| Cecha | Tryb standardowy | Tryb messenger |
|---|---|---|
| Klasa sekcji | `cmt-section` | `cmt-section cmt-messenger` |
| Odpowied?? inline | textarea pod komentarzem | baner nad compose boxem |
| Avatar przy compose | widoczny | ukryty |
| Scroll | wewn??trz sekcji | `cmt-list-messenger` (osobny scroll) |

### 2.1 Reply w trybie messenger

Stan przechowywany w `messengerReplyTo: { parentId, authorName }`.

- Klikni??cie "Odpowiedz" ??? `setMessengerReplyTo({ parentId, authorName })` + focus na g????wnej textarea
- `handleSubmit` ??? je??li `messengerReplyTo` ustawione, dodaje `payload.parentId` ??? po wys??aniu czy??ci stan
- Baner nad compose boxem renderuje si?? tylko gdy `messengerReplyTo !== null`

---

## 3. Struktura DOM w??tku

```html
<div class="cmt-group [cmt-group-expanded]">

  <!-- Komentarz rodzica -->
  <div class="cmt-swipe-wrap cmt-wrap-has-replies">   ??? position: relative
    <div class="cmt-has-replies">                      ??? position: relative; paddingLeft: 1rem
      <div class="cmt-item">
        <div class="cmt-av-wrap">
          <img class="cmt-av cmt-av-img" />            ??? 20px ?? 20px; margin-top od g??ry .cmt-item
        </div>
        ...tre????...
      </div>
    </div>
  </div>

  <!-- Toggle "N odpowiedzi" / "Ukryj odpowiedzi" -->
  <button class="cmt-replies-toggle">                  ??? position: relative; margin-left: 3.5rem
    <img class="cmt-reply-av" />                       ??? mini avatar 22px; center x = 631px (abs)
    "N odpowiedzi" lub "Ukryj odpowiedzi"
  </button>

  <!-- Lista odpowiedzi (tylko gdy rozwini??ta) -->
  <div class="cmt-replies-list">                       ??? position: relative
    <!-- per odpowied??: -->
    <div class="cmt-swipe-wrap cmt-wrap-threaded">     ??? position: relative
      <div class="cmt-item cmt-threaded">
        <div class="cmt-av-wrap">
          <img class="cmt-av cmt-av-img" />            ??? 20px ?? 20px
        </div>
        ...tre????...
      </div>
    </div>
    ...kolejne odpowiedzi...
  </div>

</div>
```

Klasa `cmt-group-expanded` jest dodawana przez JSX gdy `expandedReplies.has(comment.id)`.

---

## 4. System L-Connector??w

> **Uwaga krytyczna:** L-connector to najbardziej wra??liwy komponent CSS w aplikacji.  
> Ka??da zmiana layoutu (padding, margin, rozmiar avatara) mo??e przesun???? geometri??.  
> Przed edycj?? zawsze weryfikuj pomierzone warto??ci w DevTools.

### 4.1 Zmierzone sta??e layoutu (1rem = 16px)

| Warto???? | Piksel | Sk??d pochodzi |
|---|---|---|
| `swWrap.left` (parent, absolutny) | 564px | pozycja `.cmt-wrap-has-replies` na ekranie |
| `rl.left` (replies-list, absolutny) | 589px | = `swWrap.left + margin-left(25px)` |
| `rl.marginLeft` | 25px | = `calc(1.625rem - 1px)` = `26px - 1px` |
| `rl.paddingLeft` | 20px | = `1.25rem` |
| `firstReplySW.left` (absolutny) | 609px | = `rl.left + rl.paddingLeft` = `589 + 20` |
| **O?? X wszystkich ????cznik??w** | **587px** | = `firstReplySW.left - 22px` = `rl.left - 2px` |
| `toggle.left` (absolutny) | 620px | = `swWrap.left + 3.5rem (56px)` |
| `toggle avatar center X` (abs) | 631px | = `toggle.left + 11px` (left=622, width=22) |
| Parent avatar center Y od g??ry swWrap | 16px = 1rem | `padding-top(0.375rem)` + av-half? ??? zmierzone empirycznie |
| Reply avatar center Y od g??ry reply-swWrap | 14px = 0.875rem | `padding-top(0.25rem) + av-half(0.625rem)` |

### 4.2 Cztery segmenty ????cznika

System sk??ada si?? z **4 niezale??nych segment??w** rysowanych przez pseudo-elementy:

```
Avatar       ???
Rodzica (K)  ???  segment 1: .cmt-wrap-has-replies::after
             ???
??????????????????????????????????????????  (d???? .cmt-swipe-wrap)
             ???
Toggle btn   ???  segment 2a (collapsed): .cmt-replies-toggle::before  ??? L-kszta??t
 "N odp."   ??????     (z zaokr??glonym rogiem do avatara toggle)
???????????????????????????????????????    ??? tu linia si?? ko??czy w stanie collapsed
             ???
Toggle btn   ???  segment 2b (expanded): .cmt-replies-toggle::before   ??? prosta linia
 "Ukryj"     ???     (width: 2px, brak border-bottom)
             ???
??????????????????????????????????????????
Reply SW 1   ???  segment 3a (non-last): swipe-wrap:not(:last-child)::after  ??? pionowy background
   ?????????????????????????????????                         + swipe-wrap::before                ??? poziome L border-bottom
Reply SW 2   ???  segment 3b (last): swipe-wrap:last-child::before           ??? border-left + border-bottom
   ?????????????????????????????????  (linia ko??czy si?? tutaj, brak ::after na last-child)
```

---

### 4.3 Segment 1 ??? pionowa linia od avatara rodzica

**Element:** `.cmt-messenger .cmt-wrap-has-replies::after`  
**Pozycja relatywna do:** `.cmt-swipe-wrap` (position: relative)

```css
.cmt-messenger .cmt-wrap-has-replies::after {
  content: '';
  position: absolute;
  left: calc(1.625rem - 3px);  /* x = swWrap.left + 26px - 3px = 587px */
  top: 1rem;                   /* y startuje od centrum avatara rodzica (16px) */
  bottom: 0;                   /* ko??czy si?? na dole .cmt-swipe-wrap */
  width: 2px;
  background: rgba(26, 26, 78, 0.20);
  border-radius: 1px 1px 0 0;
  pointer-events: none;
}
```

**Uwaga:** `left: calc(1.625rem - 3px)`:
- `1.625rem` = `padding-left(1rem)` + `av-width/2(0.625rem)` = centrum avatara od lewej `.cmt-item`
- `-3px` = `-1px` (half-line) `-2px` (korekta wyr??wnania do x=587px reply rods)

`.cmt-messenger .cmt-has-replies::after { display: none; }` ??? stary pseudo-element wy????czony; nie u??ywamy go w trybie messenger.

---

### 4.4 Segment 2 ??? toggle (dwa stany)

**Element:** `.cmt-replies-toggle::before` ??? rysuje ????cznik od do??u swWrap do avatara toggle (collapsed) lub przez ca???? wysoko???? przycisku (expanded).  
**Pozycja relatywna do:** `.cmt-replies-toggle` (position: relative)

#### Stan collapsed ("N odpowiedzi") ??? L-kszta??t

```css
.cmt-replies-toggle::before {
  content: '';
  position: absolute;
  left: calc(-3px - 1.875rem); /* x = toggle.left + left = 620 - 3 - 30 = 587px */
  top: -0.125rem;              /* lekko ponad przycisk ??? ????czy z do??em swWrap */
  bottom: 50%;                 /* ko??czy si?? na centrum Y avatara toggle (~631px) */
  width: calc(14px + 1.875rem);/* = 44px: od x=587 do centrum avatara toggle x=631 */
  background: none;
  border-left: 2px solid rgba(26, 26, 78, 0.2);
  border-bottom: 2px solid rgba(26, 26, 78, 0.2);
  border-bottom-left-radius: 0.5rem;
  pointer-events: none;
}
```

`width = 44px` bo: `toggle_avatar_center_x(631) - rod_x(587) = 44px = 14px + 30px = 14px + 1.875rem`

#### Stan expanded ("Ukryj odpowiedzi") ??? prosta pionowa linia

```css
.cmt-group-expanded .cmt-replies-toggle::before {
  width: 2px;
  background: rgba(26, 26, 78, 0.2);
  border-left: none;
  border-bottom: none;
  border-bottom-left-radius: 0;
  bottom: -0.125rem;           /* lekko ni??ej ??? ????czy z g??r?? replies-list */
}
```

---

### 4.5 Segment 3 ??? linie odpowiedzi (replies-list)

**Kontener:** `.cmt-replies-list`

```css
.cmt-replies-list {
  margin-left: calc(1.625rem - 1px); /* lewy edge kontenera = x=589px (abs) */
  padding-left: 1.25rem;             /* content zaczyna si?? 20px od lewej kraw??dzi */
  border-left: none;                 /* nie u??ywamy border-left kontenera */
}
```

Ka??dy reply swipe-wrap (`position: relative`) u??ywa **dw??ch pseudo-element??w**:

#### `::before` ??? poziomy L-connector (border-bottom)

Rysuje poziom?? kresk?? od osi X ????cznika do centrum avatara odpowiedzi.

```css
.cmt-replies-list > .cmt-swipe-wrap::before {
  content: '';
  position: absolute;
  left: calc(-1.25rem - 2px);      /* = -(paddingLeft + half-border) ??? x=587 */
  top: 0;
  width: calc(1.875rem + 2px);     /* od x=587 do centrum reply avatar */
  height: calc(0.25rem + 0.625rem);/* = 0.875rem = centrum Y avatara odpowiedzi */
  border-left: none;               /* brak! pionowy segment osobno */
  border-bottom: 2px solid rgba(26, 26, 78, 0.20);
  border-bottom-left-radius: 0.5rem;
  pointer-events: none;
}
```

Dla **ostatniego dziecka** (`last-child`) dodajemy `border-left`, bo nie ma ono `::after` (pionowy segment z t??a):

```css
.cmt-replies-list > .cmt-swipe-wrap:last-child::before {
  border-left: 2px solid rgba(26, 26, 78, 0.2);
}
```

#### `::after` ??? pionowy segment (background) ??? tylko non-last

Rysuje pionow?? lini?? od g??ry do do??u swipe-wrap. Nie jest rysowany na `last-child`, bo linia powinna ko??czy?? si?? przy centrum ostatniego avatara.

```css
.cmt-replies-list > .cmt-swipe-wrap:not(:last-child)::after {
  content: '';
  position: absolute;
  left: calc(-2px - 1.25rem);  /* = x=587; ta sama o?? co ::before left */
  top: 0;
  bottom: 0;
  width: 2px;
  background: rgba(26, 26, 78, 0.2);
  border-radius: 1px;
  pointer-events: none;
}
```

**Dlaczego dwa pseudo-elementy zamiast jednego?**  
Gdyby `::before` mia?? zar??wno `border-left` jak i `border-bottom`, o?? X kolidowa??aby z `::after` background, powoduj??c podw??jny alpha w tym samym miejscu X: `rgba(0.2) + rgba(0.2*(1-0.2)) = rgba(0.36)` ??? widoczny ciemniejszy punkt.  
Rozdzielenie: `::before` = tylko `border-bottom` (poziom), `::after` = tylko background (pion) eliminuje overlap.

---

### 4.6 Diagram geometrii (collapsed vs expanded)

```
                     x=587
COLLAPSED:            ???
  swWrap::after       ???  (top:1rem ??? bottom:0)
                      ???
  toggle::before      ?????????????????????????????????????????????????????????> avatar toggle (x=631)
                           L-kszta??t, border-left+border-bottom

EXPANDED:             ???
  swWrap::after       ???  (top:1rem ??? bottom:0)
                      ???
  toggle::before      ???  (top:-0.125rem ??? bottom:-0.125rem, width:2px, background)
                      ???
  reply[0]::after     ???  (top:0 ??? bottom:0)
  reply[0]::before   ?????????> reply[0] avatar center y (0.875rem)
                      ???
  reply[1]::after     ???  (top:0 ??? bottom:0)
  reply[1]::before   ?????????> reply[1] avatar center y
                      ???  ??? last-child: border-left na ::before zamiast ::after
  reply[N]::before   ?????????> reply[N] avatar center y  ??? linia ko??czy si?? tutaj
```

---

### 4.7 Kolory linii

| Tryb | Warto???? |
|---|---|
| Jasny | `rgba(26, 26, 78, 0.2)` |
| Ciemny | `rgba(255, 245, 225, 0.2)` |

Ka??da regu??a ma odpowiedni wariant `.dark ...` w pliku CSS.

---

## 5. Sta??y, kt??rych NIE wolno zmienia?? bez audytu geometrii

| W??a??ciwo???? | Warto???? | Efekt zmiany |
|---|---|---|
| `.cmt-item` `padding-left` w `.cmt-messenger` | `1rem` | przesuwa centrum avatara, psuje `left` na swWrap::after |
| `.cmt-av` `width/height` | `1.25rem` | zmienia `av-half(0.625rem)`, psuje `top:1rem` i wysoko??ci ::before |
| `.cmt-replies-list` `margin-left` | `calc(1.625rem - 1px)` | zmienia `rl.left`, psuje ca???? o?? X |
| `.cmt-replies-list` `padding-left` | `1.25rem` | zmienia start swipe-wrap, psuje `left` na ::before i ::after |
| `.cmt-replies-toggle` `margin-left` | `3.5rem` | zmienia `toggle.left`, psuje `left` na toggle::before |
| `.cmt-replies-toggle` avatar width | `22px` (1.375rem) | zmienia `toggle_avatar_center_x`, psuje `width` na toggle::before |
| `.cmt-item.cmt-threaded` `padding-top` | `0.25rem` | zmienia reply avatar center Y, psuje `height` na ::before |

---

## 6. Mentions i konwersja tekstu

```js
// CommentsSection.jsx
const mentionMapRef = useRef({})  // { display_name: user_id }
const convertMentions = (text) => {
  // zamienia "@Imi?? Nazwisko" ??? "@[user_id]" przy wysy??aniu
}
```

Przy wyborze u??ytkownika z podpowiedzi: `mentionMapRef.current[user.full_name] = user.id`.

---

## 7. Historia istotnych poprawek (commit log)

| Commit | Zmiana |
|---|---|
| `8a54233` | Flat Facebook-style messages |
| `3341d37` | Messenger reply banner, keyboard hide, nav hide |
| `4a3c8ee` | Toggle label "Ukryj odpowiedzi", avatar stack |
| `40546f5` | Zero-overlap 3-segment rod (zamiana na ::before/::after) |
| `6e9407a` | Pixel-perfect geometry (1.625rem = padding+av-half) |
| `dcc48f5` | border-left=none na replies-list, per-item ::after, ::before { display:none } |
| `befb5c1` | 3 alignment bugs: duplicate line, 10px gap, 2px x seam |
| `50cf317` | L-connector do avatara toggle (collapsed), last-child border-left |
