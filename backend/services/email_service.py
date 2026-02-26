"""
Unified email service for Kenaz.

Architecture
------------
* Single entry-point: ``send_email(template, to_email, to_name, context)``
* HTML templates rendered inline (no Jinja2 dependency).
* SMTP via aiosmtplib (async, STARTTLS on port 587 by default).
* When ``settings.email_enabled`` is ``False`` (the default in development),
  every outgoing email is printed to the logger instead of actually sent.
  This means zero external dependencies in local dev and CI.

Adding new templates
--------------------
1. Add an entry to ``EmailTemplate``.
2. Add a branch in ``_render_template()`` that returns ``(subject, html_body)``.
3. Call ``send_email(EmailTemplate.NEW_TYPE, ...)`` from wherever you need it.

Planned templates
-----------------
* PASSWORD_RESET   – "forgot password" flow
* WELCOME          – after successful registration
* NEWSLETTER       – bulk campaign (call list of (email, name) pairs)
* EVENT_REMINDER   – day-before event nudge (future)
"""

import hashlib
import logging
import secrets
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from enum import Enum
from typing import Any

import aiosmtplib

from config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────────────
# Token helpers (used by password-reset; kept here so email_service is self-contained)
# ──────────────────────────────────────────────────────────────────────────────

def generate_reset_token() -> tuple[str, str]:
    """
    Generate a password-reset token pair.

    Returns
    -------
    (raw_token, hashed_token)
        ``raw_token``    — URL-safe string to embed in the reset link.
        ``hashed_token`` — SHA-256 hex digest to store in the database.
    """
    raw = secrets.token_urlsafe(32)
    hashed = hashlib.sha256(raw.encode()).hexdigest()
    return raw, hashed


def hash_reset_token(raw_token: str) -> str:
    """Hash a raw token for DB comparison."""
    return hashlib.sha256(raw_token.encode()).hexdigest()


# ──────────────────────────────────────────────────────────────────────────────
# Template enum
# ──────────────────────────────────────────────────────────────────────────────

class EmailTemplate(str, Enum):
    PASSWORD_RESET = "password_reset"
    WELCOME = "welcome"
    NEWSLETTER = "newsletter"


# ──────────────────────────────────────────────────────────────────────────────
# Shared HTML layout
# ──────────────────────────────────────────────────────────────────────────────

_BRAND_RED = "#e53935"
_BRAND_NAVY = "#0f174a"
_BRAND_CREAM = "#fffdf5"

def _wrap_layout(title: str, body_html: str) -> str:
    """Wrap rendered body in the universal Kenaz email shell."""
    return f"""<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title}</title>
</head>
<body style="margin:0;padding:0;background:{_BRAND_CREAM};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{_BRAND_CREAM};">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,74,0.10);">

          <!-- Header -->
          <tr>
            <td style="background:{_BRAND_NAVY};padding:32px 40px;text-align:center;">
              <span style="font-size:28px;font-weight:900;letter-spacing:0.08em;color:{_BRAND_CREAM};">KENAZ</span>
              <span style="font-size:13px;font-weight:600;letter-spacing:0.15em;color:rgba(255,253,245,0.55);display:block;margin-top:2px;">CENTRUM</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;color:{_BRAND_NAVY};">
              {body_html}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:{_BRAND_CREAM};border-top:1px solid rgba(15,23,74,0.08);padding:24px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:rgba(15,23,74,0.45);line-height:1.6;">
                Fundacja Centrum Kenaz · Wyżyny 16, 61-654 Poznań<br/>
                Ten email został wygenerowany automatycznie — nie odpowiadaj na niego.<br/>
                Kontakt: <a href="mailto:centrumkenaz@gmail.com" style="color:{_BRAND_NAVY};text-decoration:underline;">centrumkenaz@gmail.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _btn(url: str, label: str) -> str:
    """Render a branded call-to-action button."""
    return (
        f'<a href="{url}" style="display:inline-block;margin:24px 0;padding:14px 32px;'
        f'background:{_BRAND_RED};color:#ffffff;font-size:15px;font-weight:700;'
        f'text-decoration:none;border-radius:100px;letter-spacing:0.02em;">'
        f'{label}</a>'
    )


# ──────────────────────────────────────────────────────────────────────────────
# Template renderers
# ──────────────────────────────────────────────────────────────────────────────

def _render_password_reset(to_name: str, ctx: dict[str, Any]) -> tuple[str, str]:
    reset_url = ctx["reset_url"]
    expires_hours = ctx.get("expires_minutes", 60) // 60
    subject = "Resetowanie hasła – Kenaz Centrum"
    body = f"""
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:900;color:{_BRAND_NAVY};">Resetowanie hasła</h2>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:rgba(15,23,74,0.75);">
        Hej {to_name},<br/><br/>
        Otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta w Kenaz Centrum.
        Kliknij poniższy przycisk, żeby ustawić nowe hasło.
      </p>
      {_btn(reset_url, "Ustaw nowe hasło")}
      <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:rgba(15,23,74,0.55);">
        Link jest ważny przez <strong>{expires_hours}&nbsp;godzin</strong> i może zostać użyty tylko raz.<br/>
        Jeśli to nie Ty prosiłeś/aś o zmianę hasła — zignoruj ten email. Twoje konto jest bezpieczne.
      </p>
      <p style="margin:16px 0 0;font-size:12px;word-break:break-all;color:rgba(15,23,74,0.35);">
        Alternatywny link: {reset_url}
      </p>
    """
    return subject, _wrap_layout(subject, body)


def _render_welcome(to_name: str, ctx: dict[str, Any]) -> tuple[str, str]:
    frontend_url = ctx.get("frontend_url", settings.frontend_url or "https://kenaz.pl")
    subject = "Witamy w Kenaz Centrum!"
    body = f"""
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:900;color:{_BRAND_NAVY};">Witaj, {to_name}!</h2>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:rgba(15,23,74,0.75);">
        Twoje konto w <strong>Kenaz Centrum</strong> zostało utworzone.<br/>
        Teraz czekamy na zatwierdzenie Twojego profilu przez administratora —
        dostaniesz od nas wiadomość, gdy to nastąpi.
      </p>
      {_btn(frontend_url, "Przejdź do aplikacji")}
      <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:rgba(15,23,74,0.55);">
        Kenaz to przestrzeń między pracą a domem, w oparciu o trzy filary: ruch, relacje i rozwój w jednym miejscu.
      </p>
    """
    return subject, _wrap_layout(subject, body)


def _render_newsletter(to_name: str, ctx: dict[str, Any]) -> tuple[str, str]:
    """
    Generic newsletter template.

    Expected context keys:
      - subject (str)           — email subject line
      - headline (str)          — large heading inside the email
      - content_html (str)      — pre-rendered HTML body paragraphs
      - cta_url (str, optional) — call-to-action URL
      - cta_label (str, optional)
    """
    subject = ctx.get("subject", "Nowości z Kenaz Centrum")
    headline = ctx.get("headline", subject)
    content_html = ctx.get("content_html", "")
    cta_url = ctx.get("cta_url", "")
    cta_label = ctx.get("cta_label", "Sprawdź")
    unsubscribe_url = ctx.get("unsubscribe_url", "")

    cta_block = _btn(cta_url, cta_label) if cta_url else ""
    unsub_block = (
        f'<p style="margin:24px 0 0;font-size:11px;color:rgba(15,23,74,0.35);">'
        f'Nie chcesz otrzymywać maili? '
        f'<a href="{unsubscribe_url}" style="color:rgba(15,23,74,0.4);">Wypisz się</a></p>'
    ) if unsubscribe_url else ""

    greeting = f"<p style='margin:0 0 20px;font-size:15px;line-height:1.6;color:rgba(15,23,74,0.75);'>Hej {to_name},</p>" if to_name else ""

    body = f"""
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:900;color:{_BRAND_NAVY};">{headline}</h2>
      {greeting}
      <div style="font-size:15px;line-height:1.7;color:rgba(15,23,74,0.80);">{content_html}</div>
      {cta_block}
      {unsub_block}
    """
    return subject, _wrap_layout(subject, body)


def _render_template(
    template: EmailTemplate,
    to_name: str,
    ctx: dict[str, Any],
) -> tuple[str, str]:
    """Dispatch template and return ``(subject, html_body)``."""
    if template == EmailTemplate.PASSWORD_RESET:
        return _render_password_reset(to_name, ctx)
    if template == EmailTemplate.WELCOME:
        return _render_welcome(to_name, ctx)
    if template == EmailTemplate.NEWSLETTER:
        return _render_newsletter(to_name, ctx)
    raise ValueError(f"Unknown email template: {template}")


# ──────────────────────────────────────────────────────────────────────────────
# Send
# ──────────────────────────────────────────────────────────────────────────────

async def send_email(
    template: EmailTemplate,
    to_email: str,
    to_name: str,
    ctx: dict[str, Any] | None = None,
) -> bool:
    """
    Render and send a single transactional email.

    Parameters
    ----------
    template : EmailTemplate
        Which template to render.
    to_email : str
        Recipient email address.
    to_name : str
        Recipient display name (used inside the email body).
    ctx : dict, optional
        Template-specific context variables.

    Returns
    -------
    bool
        ``True`` if the message was accepted by the SMTP server (or logged in
        dev mode), ``False`` on delivery failure.
    """
    ctx = ctx or {}
    subject, html_body = _render_template(template, to_name, ctx)

    if not settings.email_enabled:
        logger.info(
            "[DEV EMAIL] To: %s <%s> | Subject: %s\n"
            "Set EMAIL_ENABLED=true + SMTP_* env vars to send real mail.\n"
            "--- body preview (first 500 chars) ---\n%s",
            to_name,
            to_email,
            subject,
            html_body[:500],
        )
        return True

    if not settings.smtp_user or not settings.smtp_password:
        logger.warning(
            "email_enabled=True but SMTP_USER / SMTP_PASSWORD are not set. "
            "Email to %s dropped.", to_email,
        )
        return False

    from_address = (
        f"{settings.smtp_from_name} <{settings.smtp_from_email or settings.smtp_user}>"
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_address
    msg["To"] = f"{to_name} <{to_email}>" if to_name else to_email

    # Plain-text fallback (stripped)
    plain = f"{subject}\n\nOtwórz ten email w kliencie obsługującym HTML."
    msg.attach(MIMEText(plain, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user,
            password=settings.smtp_password,
            start_tls=True,
        )
        logger.info("Email sent to %s [%s]", to_email, template.value)
        return True
    except Exception as exc:  # noqa: BLE001
        logger.error("Failed to send email to %s: %s", to_email, exc)
        return False


async def send_bulk(
    template: EmailTemplate,
    recipients: list[tuple[str, str]],
    ctx: dict[str, Any] | None = None,
    per_recipient_ctx: dict[str, dict[str, Any]] | None = None,
) -> dict[str, bool]:
    """
    Send the same template to multiple recipients.

    Suitable for newsletters. Each send is independent; failures are collected
    and returned without raising.

    Parameters
    ----------
    template : EmailTemplate
        Template to render.
    recipients : list of (email, name)
        Target addresses.
    ctx : dict, optional
        Shared context merged for every recipient.
    per_recipient_ctx : dict of {email: ctx_override}, optional
        Per-recipient context overrides (e.g. personalised unsubscribe links).

    Returns
    -------
    dict mapping email → bool (True = success)
    """
    import asyncio  # local import to keep module top-level clean

    base_ctx = dict(ctx or {})
    results: dict[str, bool] = {}

    async def _one(email: str, name: str) -> None:
        merged = {**base_ctx, **(per_recipient_ctx or {}).get(email, {})}
        results[email] = await send_email(template, email, name, merged)

    await asyncio.gather(*[_one(e, n) for e, n in recipients])
    return results
