"""
Audio — receives raw audio chunks from Swift and streams to Smallest AI Waves for transcription.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
from typing import Callable

import websockets

import config

log = logging.getLogger("audio")
_broadcaster: Callable | None = None
_waves_ws = None
_sample_rate = 16000


def set_event_broadcaster(fn: Callable):
    global _broadcaster
    _broadcaster = fn


async def _emit(event: str, payload):
    if _broadcaster:
        await _broadcaster(event, payload)


async def start_listening(sample_rate: int = 16000):
    global _waves_ws, _sample_rate
    _sample_rate = sample_rate
    try:
        key = config.get_smallest_key()
    except ValueError as e:
        await _emit("transcription-error", str(e))
        return

    url = (
        f"wss://api.smallest.ai/waves/v1/pulse/get_text"
        f"?encoding=linear16&sample_rate={sample_rate}&language=en&word_timestamps=false"
    )
    _waves_ws = await websockets.connect(url, extra_headers={"Authorization": f"Bearer {key}"})
    asyncio.create_task(_receive_transcripts())
    log.info(f"Waves connected (sample_rate={sample_rate})")


async def _receive_transcripts():
    try:
        async for msg in _waves_ws:
            data = json.loads(msg)
            transcript = data.get("transcript", "")
            is_final = data.get("is_final", False)
            is_last = data.get("is_last", False)
            log.info(f"Waves | is_final={is_final} is_last={is_last} | '{transcript}'")
            if transcript:
                await _emit("transcription", {
                    "transcript": transcript,
                    "is_final": is_final,
                })
    except Exception as e:
        log.error(f"Waves receive error: {e}")
        await _emit("transcription-error", str(e))


async def send_audio_chunk(chunk: str):
    if _waves_ws:
        try:
            await _waves_ws.send(base64.b64decode(chunk))
        except Exception as e:
            log.error(f"send_audio_chunk: {e}")


async def stop_listening():
    global _waves_ws
    if _waves_ws:
        try:
            # Signal Waves to flush remaining audio and send final transcript
            await _waves_ws.send(json.dumps({"type": "finalize"}))
            await asyncio.wait_for(_waves_ws.wait_closed(), timeout=2.0)
        except Exception:
            pass
        finally:
            try:
                await _waves_ws.close()
            except Exception:
                pass
            _waves_ws = None
    log.info("Audio stopped")
