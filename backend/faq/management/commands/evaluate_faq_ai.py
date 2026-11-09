import json
import re
import time
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from faq import ai
from faq.evaluation import evaluation_path, load_items
from faq.models import FaqEntry, FaqQuestion
from faq.search import find

AiStatus = FaqQuestion.AiStatus
RIGHT, MISSED, CAUGHT, WRONG, NOT_RUN = "right", "too careful", "caught by a check", "wrong", "not run"
SEARCH_ONLY = "left to the search"
STOP_REASONS = ("the daily limit was reached", ai.PROBLEM_WORDS[ai.RATE_LIMITED], ai.PROBLEM_WORDS[ai.BAD_KEY])


def judge(item, outcome, entries_used):
    """How one reply did. A wrong reply is one a student should not have seen."""
    if outcome is None:
        return SEARCH_ONLY if item["covered"] is True else RIGHT
    if outcome.status == AiStatus.NOT_COVERED:
        return MISSED if item["covered"] is True else RIGHT
    if outcome.status == AiStatus.REJECTED:
        return CAUGHT
    if outcome.status == AiStatus.UNAVAILABLE:
        return NOT_RUN
    if item["covered"] is False:
        return WRONG
    if any(re.search(pattern, outcome.text, re.I) for pattern in item["never"]):
        return WRONG
    if not all(re.search(pattern, outcome.text, re.I) for pattern in item["must"]):
        return WRONG
    if item["answers"] and not set(item["answers"]) & set(entries_used):
        return WRONG
    return RIGHT


class Command(BaseCommand):
    help = "Measure the AI replies with real model calls. Saves after each question, so it can carry on another day."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=40, help="Most model calls to make in this run.")
        parser.add_argument("--traps", default=None, help="The trap questions (default docs/faq/ai-test-questions.json).")
        parser.add_argument("--out", default=None, help="The results file (default docs/faq/evaluation-ai-results.json).")
        parser.add_argument("--delay", type=float, default=3.5, help="Seconds between model calls.")

    def items(self, traps_path):
        live = {entry.pk: entry.question for entry in FaqEntry.objects.published()}
        found = []
        for item in json.loads(Path(traps_path).read_text(encoding="utf-8"))["items"]:
            found.append({
                "id": item["id"], "question": item["question"], "history": item.get("history", []),
                "covered": item.get("covered"), "answers": item.get("answers", []),
                "must": item.get("must", []), "never": item.get("never", []),
            })
        for number, item in enumerate(load_items()[0], 1):
            found.append({
                "id": f"set-{number}", "question": item["question"], "history": [],
                "covered": bool(item["expected"]), "answers": [live[pk] for pk in item["expected"]],
                "must": [], "never": [],
            })
        # The questions the FAQ does not cover go first, so a day's free calls
        # are spent on keeping the chat to the FAQ.
        return sorted(found, key=lambda item: item["covered"] is True)

    def handle(self, *args, **options):
        if not ai.configured():
            raise CommandError("Put OPENROUTER_API_KEY in backend/.env first.")
        base = evaluation_path().parent
        out = Path(options["out"] or base / "evaluation-ai-results.json")
        results = json.loads(out.read_text(encoding="utf-8")) if out.exists() else {}
        calls = 0
        stopped = ""
        for item in self.items(options["traps"] or base / "ai-test-questions.json"):
            if results.get(item["id"], {}).get("result", NOT_RUN) != NOT_RUN:
                continue
            if calls >= options["limit"]:
                stopped = "the limit for this run was reached"
                break
            result = find(item["question"])
            entries, follows = ai.choose_entries(item["question"], result, [turn[0] for turn in item["history"]])
            outcome, used = None, []
            if entries:
                question = ai._as_data(item["question"])
                turns = [(ai._as_data(asked), answered) for asked, answered in item["history"]] if follows else []
                outcome = ai.ask_models(ai.build_messages(entries, question, turns), entries, question)
                used = [source.question for source in outcome.sources]
                calls += 1
                time.sleep(options["delay"])
            verdict = judge(item, outcome, used)
            results[item["id"]] = {
                "question": item["question"], "result": verdict, "searchBand": result.band,
                "status": outcome.status if outcome else "NOT_CALLED",
                "reply": outcome.text if outcome else "", "used": used,
                "model": outcome.model if outcome else "", "reason": outcome.reason if outcome else "",
            }
            out.write_text(json.dumps(results, indent=1, ensure_ascii=False), encoding="utf-8")
            if outcome is not None and outcome.status == AiStatus.UNAVAILABLE and outcome.reason in STOP_REASONS:
                stopped = outcome.reason
                break
        total = len(self.items(options["traps"] or base / "ai-test-questions.json"))
        counts = {name: sum(1 for row in results.values() if row["result"] == name) for name in (RIGHT, MISSED, SEARCH_ONLY, CAUGHT, WRONG, NOT_RUN)}
        done = total - counts[NOT_RUN] - max(0, total - len(results))
        self.stdout.write(f"Done {done} of {total}: " + ", ".join(f"{count} {name}" for name, count in counts.items() if name != NOT_RUN))
        for key, row in results.items():
            if row["result"] == WRONG:
                self.stdout.write(self.style.WARNING(f"WRONG {key}: {row['question']} -> {row['reply'][:160]}"))
        if stopped:
            self.stdout.write(f"Stopped: {stopped}. Run it again to carry on.")
