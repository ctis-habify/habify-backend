# Habify Backend Coding Standards

This document outlines the coding standards and best practices for the Habify Backend project. All contributors should follow these guidelines to ensure code quality and consistency.

## 1. General Principles
- **Keep it Simple**: Write code that is easy to read and maintain.
- **DRY (Don't Repeat Yourself)**: Avoid code duplication.
- **SOLID**: Follow SOLID principles for better architecture.

## 2. Naming Conventions
- **Files**: Use `kebab-case` (e.g., `ai.service.ts`, `user-profile.controller.ts`).
- **Folders**: Use `kebab-case`.
- **Classes**: Use `PascalCase` (e.g., `AiService`).
- **Interfaces**: Use `PascalCase` starting with `I` is **not** required, but preferred if it helps clarity (e.g., `IVerifyPayload`). *Note: Our linting rule current discourages `I` prefix to match standard NestJS boilerplates, but PascalCase is required.*
- **Variables & Functions**: Use `camelCase`.
- **Constants**: Use `UPPER_CASE` for global constants.

## 3. TypeScript Guidelines
- **Strict Mode**: `strict` mode is enabled in `tsconfig.json`.
- **Typing**: Always specify return types for public methods. Avoid `any` where possible.
- **Readonly**: Use `readonly` for class properties that don't change after construction.

## 4. NestJS Best Practices
- **Dependency Injection**: Use constructor-based injection.
- **Module Structure**: Keep modules focused and cohesive.
- **Exception Handling**: Use built-in NestJS exceptions (e.g., `BadRequestException`, `NotFoundException`).
- **Logging**: Use the standard `Logger` class for consistency.

## 5. Quality Tools
- **ESLint**: Run `npm run lint` to check for style issues.
- **Prettier**: Run `npm run format` to automatically format code.
- **Commitlint**: We follow conventional commits.

