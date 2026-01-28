# Contributing to Sparkle Validator

Thank you for your interest in contributing to Sparkle Validator! This document outlines the process for contributing to this project.

## Development Setup

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/dweekly/Sparkle-Validator.git
   cd Sparkle-Validator
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development build:
   ```bash
   npm run dev
   ```

4. Run tests:
   ```bash
   npm test
   ```

## Project Structure

- `src/core/` - Shared validation engine (parser, rules, types)
- `src/cli/` - Command-line interface
- `src/web/` - Web application
- `test/` - Test files and fixtures
- `public/` - Built web app (generated)

## Adding New Validation Rules

1. Create or modify the appropriate rule file in `src/core/rules/`
2. Add the rule ID and description to the constants if needed
3. Write tests for the new rule in `test/core/rules/`
4. Add test fixtures in `test/fixtures/` if needed

## Code Style

- We use ESLint and Prettier for consistent code formatting
- Run `npm run lint` to check for issues
- Run `npm run format` to auto-format code

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with clear, descriptive commits
3. Add or update tests as needed
4. Ensure all tests pass (`npm test`)
5. Ensure the build succeeds (`npm run build`)
6. Submit a pull request with a clear description of changes

## Reporting Issues

When reporting issues, please include:
- A clear description of the problem
- Steps to reproduce
- The appcast.xml content (or a minimal reproduction)
- Expected vs actual behavior

## Code of Conduct

Please be respectful and constructive in all interactions. We aim to maintain a welcoming and inclusive environment for all contributors.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
