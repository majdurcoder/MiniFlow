"""
Audio — receives a single WAV payload and sends it to Smallest AI for transcription.
"""

from __future__ import annotations

import base64
import logging
from typing import Callable

import httpx

import config

log = logging.getLogger("audio")
_broadcaster: Callable | None = None


def set_event_broadcaster(fn: Callable):
    global _broadcaster
    _broadcaster = fn


async def _emit(event: str, payload):
    if _broadcaster:
        await _broadcaster(event, payload)


async def transcribe_audio(audio_b64: str, language: str = "en"):
    try:
        wav_bytes = base64.b64decode(audio_b64)
    except Exception as e:
        msg = f"Invalid base64 audio: {e}"
        log.error(msg)
        await _emit("transcription-error", msg)
        return {"status": "error", "error": msg}

    return await _transcribe_wav_bytes(wav_bytes, language)


async def _transcribe_wav_bytes(wav_bytes: bytes, language: str = "en"):
    try:
        key = config.get_smallest_key()
    except ValueError as e:
        await _emit("transcription-error", str(e))
        return {"status": "error", "error": str(e)}

    url = "https://waves-api.smallest.ai/api/v1/pulse/get_text"
    params = {"model": "pulse", "language": language}
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "audio/wav",
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(url, params=params, headers=headers, content=wav_bytes)

    if resp.status_code >= 400:
        msg = f"Smallest API error ({resp.status_code}): {resp.text}"
        log.error(msg)
        await _emit("transcription-error", msg)
        return {"status": "error", "error": resp.text}

    result = resp.json()
    transcript = result.get("transcription") or result.get("text")
    if transcript:
        await _emit("transcription", {"transcript": transcript, "is_final": True})

    return result
