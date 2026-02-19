# GitHub Copilot Instructions

## Commit Message Convention

All commit messages MUST follow the Conventional Commits specification.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

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
fix(payments): correct subscription renewal logic
docs(readme): update installation instructions
refactor(events): simplify registration service
test(auth): add password validation tests
chore(deps): update FastAPI to v0.109.0
```

### Rules

1. Use lowercase for type, scope, and description
2. No period (.) at the end of description
3. Keep description under 72 characters
4. Use imperative mood ("add" not "added" or "adds")
5. Body and footer are optional but recommended for complex changes

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
