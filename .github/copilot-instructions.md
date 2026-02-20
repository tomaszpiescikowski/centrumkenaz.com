# GitHub Copilot Instructions

## Commit Message Convention

All commit messages MUST follow the Conventional Commits specification.

### Format

```
<type>(<scope>): <summary>

<context>
```

- **`<type>`** – a valid Conventional Commit type (see Types below).
- **`<scope>`** – required, consistent with existing commits (e.g. `auth`, `nav`, `pwa`).
- **`<summary>`** – what changes at a high level, present tense, imperative mood, under 72 chars.
- **`<context>`** – a few sentences explaining **why** the change was made and what it achieves, so future readers immediately understand the motivation (e.g. "Bottom nav buttons stayed visually pressed on touch devices because hover styles persisted. Wrapped hover rules in @media (hover: hover) so they only apply on real pointer devices.").

### Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that don't affect code meaning (formatting, whitespace, etc.)
- **refactor**: Code change that neither fixes a bug nor adds a feature
- **perf**: Performance improvement
- **test**: Adding or updating tests
- **build**: Changes to build system or dependencies
- **ci**: Changes to CI configuration files and scripts
- **chore**: Other changes that don't modify src or test files
- **revert**: Reverts a previous commit

### Scope (optional)

The scope should be the name of the affected module/component:
- `auth`
- `events`
- `payments`
- `admin`
- `api`
- `db`
- `ui`
- etc.

### Examples

```bash
feat(auth): add Google OAuth integration

Users needed a way to sign in without creating a separate account.
Added Google OAuth flow so they can authenticate with their existing
Google credentials in one click.

fix(payments): correct subscription renewal logic

Subscriptions were silently expiring instead of renewing because the
renewal job compared dates in the wrong timezone. Fixed to use UTC
consistently.

fix(nav): remove sticky hover on bottom nav buttons

On mobile PWA, bottom nav buttons stayed visually "pressed" after tap
because CSS hover styles persisted on touch devices. Wrapped the global
box-shadow hover rules in @media (hover: hover) so they only fire on
real pointer devices.

docs(readme): update installation instructions

Added missing step for running database migrations after fresh clone,
which was causing confusion for new contributors.
```

### Rules

1. Use lowercase for type, scope, and description
2. No period (.) at the end of description
3. Keep description under 72 characters
4. Use imperative mood ("add" not "added" or "adds")
5. Body and footer are optional but recommended for complex changes
6. **Context body is required** – every commit must include a short paragraph after a blank line explaining *why* the change was made, not just *what* changed
7. Avoid context that merely restates code actions without motivation (e.g. don't write "Changed X to Y" – explain *why*)

### Breaking Changes

If introducing breaking changes, add `!` after type/scope and include `BREAKING CHANGE:` in footer:

```bash
feat(api)!: change authentication endpoint structure

BREAKING CHANGE: /auth/login now requires email instead of username
```

## Code Style

- Follow existing code patterns in the project
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused
- Write tests for new features and bug fixes

## Python (Backend)

- Follow PEP 8 style guide
- Use type hints
- Use async/await for database operations
- Validate inputs with Pydantic models

## JavaScript/React (Frontend)

- Use functional components with hooks
- Keep components small and reusable
- Use meaningful prop names
- Handle loading and error states
- Use Tailwind CSS for styling
