# Coding Rules

## Principles

### SOLID
- **Single Responsibility**: Each function/class does one thing
- **Open/Closed**: Extend behavior without modifying existing code
- **Liskov Substitution**: Subtypes must be substitutable
- **Interface Segregation**: Many specific interfaces over one general
- **Dependency Inversion**: Depend on abstractions, not concretions

### DRY (Don't Repeat Yourself)
- Extract repeated logic after 4+ occurrences
- Create reusable functions, classes, or modules
- Use configuration over duplication

### KISS (Keep It Simple, Stupid)
- Prefer simple, readable code
- Avoid premature optimization
- Write code that explains itself

## Style Guide

### Python
- Python 3.11+ with type hints
- Use `async/await` for I/O operations
- Pydantic for data validation
- Structlog for logging

### Naming
- `snake_case` for functions and variables
- `PascalCase` for classes
- `UPPER_SNAKE_CASE` for constants
- Descriptive names over abbreviations

### Imports
```python
# Standard library
import asyncio
from typing import Optional

# Third-party
import structlog
from fastapi import APIRouter

# Local
from src.config import settings
from src.database import fetch_one
```

### Functions
```python
async def get_user(user_id: str) -> Optional[User]:
    """Fetch user by ID from database."""
    result = await fetch_one(
        "SELECT * FROM users WHERE id = $1",
        user_id,
    )
    return User(**result) if result else None
```

### Classes
```python
class UserService:
    """Handle user-related operations."""

    def __init__(self, db: Database):
        self.db = db

    async def create(self, data: UserCreate) -> User:
        """Create a new user."""
        ...
```

## Testing

### Structure
- Use pytest with async support
- Test file: `test_<module>.py`
- Test function: `test_<behavior>`
- Test class: `Test<Feature>`

### Coverage
- New features require tests
- Bug fixes require regression tests
- Target: 80%+ coverage

### Patterns
```python
async def test_create_user():
    user = await create_user(name="Test")
    assert user.name == "Test"
    assert user.id is not None

async def test_create_user_invalid_name():
    with pytest.raises(ValidationError):
        await create_user(name="")
```

## Git

### Commits
```
feat: Add user authentication
fix: Resolve database connection leak
docs: Update API documentation
refactor: Simplify user service
test: Add unit tests for user module
```

### Branches
- `main` - Production-ready code
- `develop` - Staging/preview
- `feature/*` - New features
- `fix/*` - Bug fixes

### Pull Requests
- Clear title and description
- Link to related issues
- Tests pass
- Code reviewed

## Code Review

### Checklist
- [ ] Follows style guide
- [ ] Has tests
- [ ] No security issues
- [ ] Performance acceptable
- [ ] Documentation updated

### Feedback
- Be constructive
- Suggest alternatives
- Explain reasoning
- Focus on code, not person
