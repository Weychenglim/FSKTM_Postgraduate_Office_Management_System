"""The chatbot's search and replies (C2), with a fake encoder: the real model
is never downloaded here. Set FAQ_REAL_MODEL_TESTS=1 to also run one check
with the real model."""
import os
from datetime import timedelta
from io import StringIO
from unittest import skipUnless

from django.core.cache import cache
from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User

from .encoder import reset_encoder
from .fake_encoder import FakeEncoder
from .models import FaqAltQuestion, FaqCategory, FaqEntry, FaqQuestion, FaqSettings, FaqVector
from .search import NONE, POSSIBLE, STRONG, clear_index, find

Status = FaqEntry.Status
FAKE = "faq.fake_encoder.FakeEncoder"


@override_settings(FAQ_ENCODER=FAKE, FAQ_SEARCH="hybrid", FAQ_STRONG_MATCH=0.72, FAQ_POSSIBLE_MATCH=0.5)
class ChatBase(APITestCase):
    def setUp(self):
        cache.clear()
        reset_encoder()
        clear_index()
        self.addCleanup(reset_encoder)
        self.addCleanup(clear_index)
        self.student = self.user("chat.student", User.Role.STUDENT)
        self.registration = FaqCategory.objects.create(name="Course registration", position=1)
        self.fees = FaqCategory.objects.create(name="Fees", position=2)
        self.register = self.entry("How do I register courses every semester?", "Register your courses in MAYA during the registration week.")
        self.fee = self.entry("How much is the tuition fee?", "See the fee schedule at https://um.edu.my/fees.", self.fees)
        self.loan = self.entry("How do I apply for a PTPTN loan?", "Apply through the PTPTN website.", self.fees)
        self.defer = self.entry("Can I defer my offer?", "Write to the office before the registration date.")
        self.client.force_authenticate(self.student)

    @staticmethod
    def user(key, role):
        return User.objects.create_user(email=f"{key}@example.test", password="pw-chat-1", full_name=key.title(), role=role)

    def entry(self, question, answer, category=None, state=Status.PUBLISHED):
        return FaqEntry.objects.create(question=question, answer=answer, category=category or self.registration, status=state)

    def ask(self, question, **extra):
        return self.client.post("/api/faq/ask/", {"question": question, **extra}, format="json")


class RankingTests(ChatBase):
    def test_a_malay_question_finds_the_english_entry(self):
        result = find("Bagaimana nak daftar kursus?")
        self.assertEqual(result.band, STRONG)
        self.assertEqual(result.top.item.entry_id, self.register.pk)
        self.assertEqual(result.mode, "hybrid")

    def test_the_keyword_search_rescues_exact_terms_the_model_misses(self):
        result = find("ptptn")
        self.assertEqual(result.top.item.entry_id, self.loan.pk)
        self.assertIsNotNone(result.top.meaning)
        self.assertLess(result.top.meaning, 0.5)
        self.assertEqual(result.band, STRONG)

    def test_without_keywords_the_model_alone_misses_them(self):
        self.assertEqual(find("ptptn", use_keywords=False).band, NONE)

    def test_a_vague_question_offers_choices(self):
        result = find("course fee")
        self.assertEqual(result.band, POSSIBLE)
        self.assertEqual({c.item.entry_id for c in result.candidates[:2]}, {self.register.pk, self.fee.pk})

    def test_off_topic_questions_find_nothing(self):
        self.assertEqual(find("Where is the nearest cafeteria?").band, NONE)
        self.assertEqual(find("?!").band, NONE)

    def test_other_ways_of_asking_are_searched(self):
        FaqAltQuestion.objects.create(entry=self.defer, text="tangguh tawaran")
        result = find("nak tangguh tawaran")
        self.assertEqual(result.top.item.entry_id, self.defer.pk)
        self.assertEqual(result.band, STRONG)

    def test_only_published_entries_are_ever_found(self):
        for state in (Status.DRAFT, Status.NEEDS_CHECKING, Status.ARCHIVED):
            hidden = self.entry("When is convocation?", "In October.", state=state)
            with self.subTest(state=state):
                self.assertNotIn(hidden.pk, [c.item.entry_id for c in find("When is convocation?").candidates])
            hidden.delete()

    def test_the_index_follows_changes(self):
        self.assertEqual(find("When is convocation?").band, NONE)
        self.entry("When is convocation?", "In October.")
        self.assertEqual(find("When is convocation?").band, STRONG)
        FaqEntry.objects.filter(question="When is convocation?").update(status=Status.ARCHIVED)
        self.assertEqual(find("When is convocation?").band, NONE)

    def test_vectors_are_kept_and_not_worked_out_twice(self):
        find("register")
        stored = FaqVector.objects.filter(model_name="fake-test-encoder").count()
        self.assertEqual(stored, 4)
        clear_index()
        before = FakeEncoder.calls
        find("register")
        self.assertEqual(FakeEncoder.calls - before, 1)


class AskTests(ChatBase):
    def test_a_clear_match_gives_the_answer_and_related_questions(self):
        response = self.ask("  How do I   register courses? ")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["outcome"], "ANSWERED")
        self.assertEqual(response.data["answer"]["id"], str(self.register.pk))
        self.assertEqual(response.data["answer"]["category"], "Course registration")
        self.assertNotIn(str(self.register.pk), [link["id"] for link in response.data["related"]])
        saved = FaqQuestion.objects.get()
        self.assertEqual((saved.text, saved.outcome, saved.entry, saved.search_mode), ("How do I register courses?", "ANSWERED", self.register, "hybrid"))

    def test_questions_are_saved_without_identity(self):
        self.ask("How do I register courses?")
        names = {field.name for field in FaqQuestion._meta.get_fields()}
        self.assertFalse(names & {"user", "student", "asked_by", "matric_no", "email"})
        self.assertNotIn("chat.student", str(list(FaqQuestion.objects.values())))

    def test_choices_then_picking_one(self):
        response = self.ask("course fee")
        self.assertEqual(response.data["outcome"], "CHOICES")
        self.assertEqual(len(response.data["choices"]), 2)
        self.assertIsNone(response.data["answer"])
        picked = self.ask("", entryId=str(self.fee.pk), questionId=response.data["questionId"], token=response.data["token"])
        self.assertEqual(picked.data["outcome"], "ANSWERED")
        self.assertEqual(picked.data["answer"]["id"], str(self.fee.pk))
        self.assertEqual(picked.data["questionId"], response.data["questionId"])
        asked = FaqQuestion.objects.get(pk=response.data["questionId"])
        self.assertEqual((asked.outcome, asked.entry), ("CHOICES", self.fee))
        self.assertEqual(FaqQuestion.objects.count(), 1)

    def test_a_related_question_click_is_kept_as_not_typed(self):
        response = self.ask("", entryId=str(self.loan.pk))
        self.assertEqual(response.data["answer"]["question"], "How do I apply for a PTPTN loan?")
        clicked = FaqQuestion.objects.get()
        self.assertFalse(clicked.typed)

    def test_hidden_entries_cannot_be_opened(self):
        draft = self.entry("Secret?", "Draft answer.", state=Status.DRAFT)
        response = self.ask("", entryId=str(draft.pk))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertNotIn("Draft answer", str(response.data))

    def test_no_match_gives_the_office_contact(self):
        chatbot = FaqSettings.load()
        chatbot.contact_text = "Email pgoffice@example.test or visit the counter, 9 am to 4 pm."
        chatbot.save()
        response = self.ask("Where is the nearest cafeteria?")
        self.assertEqual(response.data["outcome"], "NO_MATCH")
        self.assertEqual(response.data["contactText"], "Email pgoffice@example.test or visit the counter, 9 am to 4 pm.")
        self.assertIsNone(FaqQuestion.objects.get().entry)

    def test_an_empty_or_long_question(self):
        self.assertEqual(self.ask("   ").status_code, status.HTTP_400_BAD_REQUEST)
        self.ask("register courses " * 40)
        self.assertEqual(len(FaqQuestion.objects.get().text), 300)

    def test_feedback_is_kept_with_the_question(self):
        response = self.ask("How do I register courses?")
        no = self.client.post("/api/faq/feedback/", {"questionId": response.data["questionId"], "token": response.data["token"], "helpful": False}, format="json")
        self.assertEqual(no.status_code, status.HTTP_200_OK)
        self.assertEqual(no.data["contactText"], FaqSettings.load().contact_text)
        self.assertFalse(FaqQuestion.objects.get().helpful)
        yes = self.client.post("/api/faq/feedback/", {"questionId": response.data["questionId"], "token": response.data["token"], "helpful": True}, format="json")
        self.assertEqual(yes.data["contactText"], "")
        self.assertTrue(FaqQuestion.objects.get().helpful)

    def test_feedback_needs_the_token_from_the_answer(self):
        first = self.ask("How do I register courses?")
        second = self.ask("tuition fee")
        forged = self.client.post("/api/faq/feedback/", {"questionId": first.data["questionId"], "token": second.data["token"], "helpful": False}, format="json")
        self.assertEqual(forged.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIsNone(FaqQuestion.objects.get(pk=first.data["questionId"]).helpful)

    def test_the_start_screen(self):
        FaqSettings.objects.update_or_create(pk=1, defaults={"common_questions": ["how do i register   courses every semester?", " ", "Fees?"]})
        response = self.client.get("/api/faq/start/")
        self.assertEqual([group["name"] for group in response.data["categories"]], ["Course registration", "Fees"])
        self.assertEqual(response.data["categories"][0]["questions"][0]["question"], "How do I register courses every semester?")
        self.assertEqual(response.data["commonQuestions"], ["how do i register   courses every semester?"], "only questions a live answer still has")

    def test_the_start_screen_suggests_questions_when_none_are_set(self):
        response = self.client.get("/api/faq/start/")
        self.assertEqual(response.data["commonQuestions"], ["How do I register courses every semester?", "How much is the tuition fee?"])


class AccessTests(ChatBase):
    def test_who_can_ask(self):
        coordinator = self.user("chat.coord", User.Role.COORDINATOR)
        self.client.force_authenticate(coordinator)
        self.assertEqual(self.ask("register courses").status_code, status.HTTP_200_OK)
        for role in (User.Role.LECTURER, User.Role.OFFICE_ADMIN):
            self.client.force_authenticate(self.user(f"chat.{role.split()[0].lower()}", role))
            with self.subTest(role=role):
                self.assertEqual(self.ask("register courses").status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(None)
        self.assertEqual(self.ask("register courses").status_code, status.HTTP_401_UNAUTHORIZED)

    def test_try_it_is_for_the_office_and_saves_nothing(self):
        self.assertEqual(self.client.post("/api/faq/try/", {"question": "register"}, format="json").status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(self.user("chat.office", User.Role.OFFICE_ADMIN))
        response = self.client.post("/api/faq/try/", {"question": "Bagaimana nak daftar kursus?"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["match"], "Strong")
        self.assertEqual(response.data["candidates"][0]["id"], str(self.register.pk))
        self.assertIn("meaning", response.data["candidates"][0])
        self.assertFalse(FaqQuestion.objects.exists())
        self.assertEqual(self.client.get("/api/faq/start/").status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get("/api/faq/search-status/").data["mode"], "hybrid")

    @override_settings(FAQ_ASK_THROTTLE_RATE="2/minute")
    def test_too_many_questions_in_a_minute(self):
        self.assertEqual(self.ask("register").status_code, status.HTTP_200_OK)
        self.assertEqual(self.ask("fee").status_code, status.HTTP_200_OK)
        self.assertEqual(self.ask("defer").status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(FaqQuestion.objects.count(), 2)


class FallbackTests(ChatBase):
    @override_settings(FAQ_SEARCH="keywords")
    def test_keyword_mode_still_answers(self):
        response = self.ask("How do I register courses every semester?")
        self.assertEqual(response.data["outcome"], "ANSWERED")
        self.assertEqual(response.data["mode"], "keywords")
        self.assertEqual(find("Bagaimana nak daftar kursus?").band, NONE)

    @override_settings(FAQ_ENCODER="faq.fake_encoder.BrokenEncoder")
    def test_a_model_that_will_not_load_falls_back_to_keywords(self):
        with self.assertLogs("faq.encoder", level="ERROR"):
            response = self.ask("PTPTN loan")
        self.assertEqual(response.data["mode"], "keywords")
        self.assertEqual(response.data["answer"]["id"], str(self.loan.pk))
        self.client.force_authenticate(self.user("chat.office2", User.Role.OFFICE_ADMIN))
        self.assertEqual(self.client.get("/api/faq/search-status/").data["mode"], "keywords")


class RetentionTests(ChatBase):
    def test_questions_older_than_a_year_are_deleted(self):
        old = FaqQuestion.objects.create(text="old", outcome="NO_MATCH")
        FaqQuestion.objects.filter(pk=old.pk).update(asked_at=timezone.now() - timedelta(days=366))
        FaqQuestion.objects.create(text="new", outcome="NO_MATCH")
        out = StringIO()
        call_command("purge_faq_questions", stdout=out)
        self.assertEqual(list(FaqQuestion.objects.values_list("text", flat=True)), ["new"])
        self.assertIn("Deleted 1", out.getvalue())

    def test_rebuild_drops_vectors_no_longer_used(self):
        find("register")
        self.register.question = "How do I register for courses?"
        self.register.save()
        out = StringIO()
        call_command("rebuild_faq_index", stdout=out)
        self.assertIn("Dropped 1 old vectors", out.getvalue())


@skipUnless(os.getenv("FAQ_REAL_MODEL_TESTS") == "1", "Set FAQ_REAL_MODEL_TESTS=1 to run with the real model.")
@override_settings(FAQ_ENCODER="faq.encoder.FastEmbedEncoder")
class RealModelTests(ChatBase):
    def test_the_real_model_understands_malay(self):
        result = find("Macam mana nak daftar subjek setiap semester?")
        self.assertEqual(result.mode, "hybrid")
        self.assertEqual(result.top.item.entry_id, self.register.pk)
