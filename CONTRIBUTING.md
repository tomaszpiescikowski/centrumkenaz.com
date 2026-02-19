# Conventional Commits

This project follows the [Conventional Commits](https://www.conventionalcommits.org/) specification.

## Quick Reference

### Format
```
<type>(<scope>): <description>
```

### Types
- `feat` - New feature
- `fix` - Bug fix  
- `docs` - Documentation
- `style` - Formatting
- `refactor` - Code restructuring
- `perf` - Performance
- `test` - Tests
- `build` - Build system
- `ci` - CI/CD
- `chore` - Maintenance
- `revert` - Revert commit

### Examples
```
feat(auth): add Google OAuth login
fix(payments): resolve subscription renewal issue
docs(api): update endpoint documentation
refactor(events): simplify registration logic
test(auth): add password validation tests
```

### Breaking Changes
```
feat(api)!: change user endpoint response format

BREAKING CHANGE: User object now includes profile nested object
```
