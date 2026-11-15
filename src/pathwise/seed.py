"""Create tables and seed the immutable, source-cited 2026 UT Dallas POC rules."""
from sqlalchemy.orm import Session

from pathwise.db import builtin_catalog, engine, initialize_schema, seed_catalog


def main() -> None:
    initialize_schema()
    catalog = builtin_catalog()
    with Session(engine) as session:
        created = seed_catalog(session, catalog)
    print(f"{'Seeded' if created else 'Already exists'}: {catalog.id} "
          f"({len(catalog.courses)} verified course rules)")


if __name__ == "__main__":
    main()
