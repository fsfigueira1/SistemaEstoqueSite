# Contributing to Laçolaria ERP

Thank you for considering contributing to Laçolaria ERP! Please read this document to understand how you can contribute effectively.

## How to Contribute

### Reporting Bugs
- Use the GitHub issue tracker
- Provide detailed steps to reproduce the bug
- Include screenshots if applicable
- Mention your environment (OS, browser, version)

### Suggesting Features
- Use the GitHub issue tracker
- Clearly describe the feature and its benefits
- Explain how it would work
- Consider any potential drawbacks

### Submitting Changes
1. Fork the repository
2. Create a new branch for your feature or fix
3. Make your changes
2. Ensure your code follows the project's coding standards
4. Add tests for new functionality
5. Commit your changes with a clear, descriptive message
6. Push to your fork
7. Submit a pull request

## Coding Standards

### TypeScript
- Use TypeScript strict mode
- Prefer interfaces over types for object shapes
- Use descriptive variable and function names
- Keep functions small and focused

### React Components
- Use functional components with hooks
- Keep components small and reusable
- Use proper accessibility attributes
- Follow shadcn/ui component patterns

### Prisma
- Keep migrations focused and reversible
- Use clear, descriptive names for models and fields
- Index frequently queried fields
- Validate data at the application level

### General
- Write clear, concise comments when necessary
- Follow existing code patterns
- Don't break existing functionality
- Add tests for new code

## Development Setup

See [README.md](README.md) for detailed setup instructions.

## Code Review Process

All pull requests will be reviewed by at least one maintainer. The review process includes:
1. Checking for adherence to coding standards
2. Verifying functionality works as expected
3. Ensuring tests pass
4. Checking for potential security issues
5. Evaluating impact on performance and maintainability

## License

By contributing to Laçolaria ERP, you agree that your contributions will be licensed under the MIT License.
