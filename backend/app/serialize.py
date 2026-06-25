"""ORM -> plain dict serialization.

Model columns are named in camelCase to match the frontend's TypeScript types,
so a straight column dump produces JSON the Zustand store can consume directly.
A small denylist hides backend-only columns.
"""

from collections.abc import Iterable
from typing import Any

from sqlalchemy import inspect as sa_inspect

_GLOBAL_EXCLUDE = {"hashed_password", "sort"}


def row_to_dict(obj: Any, *, exclude: set[str] | None = None) -> dict[str, Any]:
    ex = _GLOBAL_EXCLUDE | (exclude or set())
    cols = sa_inspect(obj).mapper.column_attrs.keys()
    return {k: getattr(obj, k) for k in cols if k not in ex}


def rows_to_list(objs: Iterable[Any], *, exclude: set[str] | None = None) -> list[dict]:
    return [row_to_dict(o, exclude=exclude) for o in objs]
