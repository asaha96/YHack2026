from typing import Any

_sessions: dict[str, list[dict[str, Any]]] = {}


def get_session(session_id: str) -> list[dict[str, Any]]:
    if session_id not in _sessions:
        _sessions[session_id] = []
    return _sessions[session_id]


def add_to_session(session_id: str, entry: dict[str, Any]) -> None:
    if session_id not in _sessions:
        _sessions[session_id] = []
    _sessions[session_id].append(entry)


def clear_session(session_id: str) -> None:
    _sessions.pop(session_id, None)
