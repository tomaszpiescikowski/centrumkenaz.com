"""
Push notification translations for event-related scenarios.

Provides localised title/body strings for the 4 event push notification
scenarios.  The backend uses the recipient's ``preferred_language`` field
to pick the correct strings before sending.

Supported languages
-------------------
pl  – Polish  (default)
en  – English
zh  – Chinese (Simplified)
nl  – Dutch
it  – Italian
szl – Silesian

Scenarios
---------
new_event          – admin created a new event
registration_open  – registrations for an event were opened
reminder           – 24-hour pre-event reminder
date_changed       – event start date / time changed
"""

from __future__ import annotations

# Structure: {scenario: {lang: {"title": ..., "body": ...}}}
# Use {placeholders} for parameter substitution.
_STRINGS: dict[str, dict[str, dict[str, str]]] = {
    "new_event": {
        "pl": {
            "title": "📅 Nowe wydarzenie: {title}",
            "body": "{city} · {date}",
        },
        "en": {
            "title": "📅 New event: {title}",
            "body": "{city} · {date}",
        },
        "zh": {
            "title": "📅 新活动：{title}",
            "body": "{city} · {date}",
        },
        "nl": {
            "title": "📅 Nieuw evenement: {title}",
            "body": "{city} · {date}",
        },
        "it": {
            "title": "📅 Nuovo evento: {title}",
            "body": "{city} · {date}",
        },
        "szl": {
            "title": "📅 Nowe wydarzynie: {title}",
            "body": "{city} · {date}",
        },
    },
    "registration_open": {
        "pl": {
            "title": "🚀 Zapisy otwarte: {title}",
            "body": "Rejestracja na wydarzenie jest już dostępna!",
        },
        "en": {
            "title": "🚀 Registration open: {title}",
            "body": "You can now sign up for this event!",
        },
        "zh": {
            "title": "🚀 报名开放：{title}",
            "body": "活动报名现已开放！",
        },
        "nl": {
            "title": "🚀 Inschrijving open: {title}",
            "body": "Je kunt je nu aanmelden voor dit evenement!",
        },
        "it": {
            "title": "🚀 Iscrizioni aperte: {title}",
            "body": "Ora puoi iscriverti a questo evento!",
        },
        "szl": {
            "title": "🚀 Zapiski utwarte: {title}",
            "body": "Możesz się już zapisać na wydarzynie!",
        },
    },
    "reminder": {
        "pl": {
            "title": "⏰ Jutro: {title}",
            "body": "Wydarzenie zaczyna się {datetime} w {city}.",
        },
        "en": {
            "title": "⏰ Tomorrow: {title}",
            "body": "The event starts at {datetime} in {city}.",
        },
        "zh": {
            "title": "⏰ 明天：{title}",
            "body": "活动将于 {datetime} 在 {city} 开始。",
        },
        "nl": {
            "title": "⏰ Morgen: {title}",
            "body": "Het evenement begint op {datetime} in {city}.",
        },
        "it": {
            "title": "⏰ Domani: {title}",
            "body": "L'evento inizia alle {datetime} a {city}.",
        },
        "szl": {
            "title": "⏰ Jutro: {title}",
            "body": "Wydarzynie sie zaczynŏ {datetime} we {city}.",
        },
    },
    "date_changed": {
        "pl": {
            "title": "⏰ Zmiana terminu: {title}",
            "body": "Nowy termin: {datetime}",
        },
        "en": {
            "title": "⏰ Date changed: {title}",
            "body": "New date: {datetime}",
        },
        "zh": {
            "title": "⏰ 时间变更：{title}",
            "body": "新时间：{datetime}",
        },
        "nl": {
            "title": "⏰ Datum gewijzigd: {title}",
            "body": "Nieuwe datum: {datetime}",
        },
        "it": {
            "title": "⏰ Data modificata: {title}",
            "body": "Nuova data: {datetime}",
        },
        "szl": {
            "title": "⏰ Zmiana terminu: {title}",
            "body": "Nowy termin: {datetime}",
        },
    },
}

_FALLBACK_LANG = "pl"


def get_push_strings(
    scenario: str,
    lang: str,
    params: dict[str, str],
) -> tuple[str, str]:
    """
    Return ``(title, body)`` for *scenario* in *lang* with *params* substituted.

    Falls back to Polish when the language or scenario is not found.
    """
    scenario_map = _STRINGS.get(scenario, _STRINGS.get("new_event", {}))
    strings = scenario_map.get(lang) or scenario_map.get(_FALLBACK_LANG, {})
    title_tpl = strings.get("title", scenario)
    body_tpl = strings.get("body", "")

    def _sub(tpl: str) -> str:
        for key, value in params.items():
            tpl = tpl.replace(f"{{{key}}}", str(value))
        return tpl

    return _sub(title_tpl), _sub(body_tpl)
