"""A scripted stand-in for the AI model, so tests never reach the internet."""
import json


def reply(text, sources=(1,), covered=True):
    return json.dumps({"covered": covered, "answer": text, "sources": list(sources)})


NOT_COVERED = json.dumps({"covered": False, "answer": "", "sources": []})


class FakeAiClient:
    script = []
    calls = []

    @classmethod
    def reset(cls, *steps):
        cls.script = list(steps)
        cls.calls = []

    def complete(self, model, messages, timeout):
        FakeAiClient.calls.append({"model": model, "messages": messages, "timeout": timeout})
        step = FakeAiClient.script.pop(0) if FakeAiClient.script else NOT_COVERED
        if isinstance(step, Exception):
            raise step
        return step
