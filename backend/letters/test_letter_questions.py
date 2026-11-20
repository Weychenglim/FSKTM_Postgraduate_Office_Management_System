"""Each letter type's own student form: "Who is the letter for?", "Additional
information" and the office's own questions (short text, date, choose from a
list, yes or no), whose answers go on the letter in English and Malay."""
from datetime import date

from rest_framework import status

from .confirmation import english_date, malay_date
from .models import ChoiceItem, ChoiceList, GeneratedLetter, LetterTemplate
from .test_letter_requests import REQUESTS, LetterRequestTestCase, make_student

TEMPLATES = "/api/letter-templates/"


class QuestionTestCase(LetterRequestTestCase):
    def setUp(self):
        super().setUp()
        self.embassies = ChoiceList.objects.create(name="Embassies", item_noun="Embassy")
        self.japan = ChoiceItem.objects.create(choice_list=self.embassies, name="Embassy of Japan", name_ms="Kedutaan Jepun")
        ChoiceItem.objects.create(choice_list=self.embassies, name="Embassy of Korea")
        self.questions = [
            {"kind": "choice", "name": "EMBASSY", "label": "Which embassy?", "hint": "", "required": True, "listId": self.embassies.pk},
            {"kind": "date", "name": "TRAVEL_DATE", "label": "Travel date", "hint": "", "required": True},
            {"kind": "text", "name": "PASSPORT_EXPIRY", "label": "Passport expiry", "hint": "As printed", "required": False},
            {"kind": "yesno", "name": "WITH_FAMILY", "label": "Travelling with family?", "hint": "", "required": True},
        ]
        self.visa = LetterTemplate.objects.create(
            name="Visa Letter",
            status=LetterTemplate.Status.ACTIVE,
            form_questions=self.questions,
            content="To {{EMBASSY}}\n\n{{STUDENT_NAME}} travels on {{TRAVEL_DATE}}. Family: {{WITH_FAMILY}}. Passport expiry: {{PASSPORT_EXPIRY}}.",
            content_ms="Kepada {{EMBASSY}}\n\n{{STUDENT_NAME}} pada {{TRAVEL_DATE}}. Keluarga: {{WITH_FAMILY}}.",
        )

    def save(self, method="post", template=None, **data):
        self.client.force_authenticate(self.office)
        url = f"{TEMPLATES}{template.pk}/" if template else TEMPLATES
        body = data if template else {"name": "Embassy Letter", "status": "Draft", **data}
        return getattr(self.client, method)(url, body, format="json")

    def ask_visa(self, user, answers):
        self.client.force_authenticate(user)
        return self.client.post(REQUESTS, {"templateId": self.visa.pk, "answers": answers}, format="json")


class SettingQuestionsTests(QuestionTestCase):
    def test_the_office_saves_its_own_questions(self):
        response = self.save(content="To {{EMBASSY}} on {{TRAVEL_DATE}}", formQuestions=self.questions, readyInDays=3)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual([q["name"] for q in response.data["formQuestions"]], ["EMBASSY", "TRAVEL_DATE", "PASSPORT_EXPIRY", "WITH_FAMILY"])
        self.assertFalse(response.data["formQuestions"][3]["required"], "a yes or no question is never required")
        self.assertEqual(response.data["readyInDays"], 3)
        self.assertFalse(response.data["asksRecipient"])

    def test_bad_questions_are_refused_with_a_reason(self):
        cases = {
            "a tag already built in": [{"kind": "text", "name": "STUDENT_NAME", "label": "Name"}],
            "no label": [{"kind": "text", "name": "NOTE_ONE", "label": " "}],
            "a choice without options or a list": [{"kind": "choice", "name": "EMBASSY", "label": "Embassy"}],
            "a choice with one option": [{"kind": "choice", "name": "EMBASSY", "label": "Embassy", "options": ["Japan", " japan "]}],
            "the same tag twice": [{"kind": "text", "name": "NOTE_ONE", "label": "A"}, {"kind": "date", "name": "NOTE_ONE", "label": "B"}],
            "an unknown kind": [{"kind": "file", "name": "UPLOAD", "label": "Upload"}],
            "an unknown purpose": [{"kind": "recipient", "purposes": ["SHOPPING"]}],
        }
        for case, questions in cases.items():
            with self.subTest(case=case):
                response = self.save(content="Dear Sir/Madam,", formQuestions=questions)
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
                self.assertIn("formQuestions", response.data)

    def test_a_question_tag_cannot_also_be_an_office_blank(self):
        response = self.save(
            content="On {{TRAVEL_DATE}}",
            formQuestions=[{"kind": "date", "name": "TRAVEL_DATE", "label": "Travel date"}],
            customFields=[{"name": "TRAVEL_DATE", "label": "Travel date"}],
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_appointment_letters_have_no_student_form(self):
        response = self.save(content="Dear {{STUDENT_NAME}}", purpose="PANEL_APPOINTMENT", formQuestions=self.questions[1:2])
        self.assertIn("formQuestions", response.data)

    def test_the_switch_adds_and_removes_who_the_letter_is_for(self):
        on = self.save(
            template=self.visa, method="patch", asksRecipient=True,
            content="{{RECIPIENT}}\n\nTo {{EMBASSY}}", contentMs="{{RECIPIENT}}\n\nKepada {{EMBASSY}}",
        )
        self.assertEqual(on.status_code, status.HTTP_200_OK, on.data)
        self.assertEqual([q["kind"] for q in on.data["formQuestions"]][:2], ["recipient", "extras"])
        off = self.save(template=self.visa, method="patch", asksRecipient=False, content="To {{EMBASSY}}", contentMs="Kepada {{EMBASSY}}")
        self.assertEqual([q["kind"] for q in off.data["formQuestions"]], ["choice", "date", "text", "yesno"])

    def test_a_letter_can_offer_only_some_purposes_and_skip_the_address(self):
        self.visa.form_questions = [{"kind": "recipient", "purposes": ["BANKING"], "askAddress": False}]
        self.visa.asks_recipient = True
        self.visa.content = "{{RECIPIENT}}\n\nDear Sir/Madam,"
        self.visa.content_ms = ""
        self.visa.save()
        self.client.force_authenticate(make_student("QST001"))
        form = self.client.get(f"{REQUESTS}form/{self.visa.pk}/").data
        self.assertEqual([p["code"] for p in form["questions"][0]["options"]], ["BANKING"])
        refused = self.client.post(REQUESTS, {"templateId": self.visa.pk, "details": {"purpose": "TRANSPORTATION", "organisation": "AirAsia Berhad"}}, format="json")
        self.assertIn("purpose", refused.data)
        made = self.client.post(
            REQUESTS,
            {"templateId": self.visa.pk, "details": {"purpose": "BANKING", "organisation": "CIMB Bank Berhad", "addressLine1": "Ignored"}},
            format="json",
        )
        self.assertEqual(made.status_code, status.HTTP_201_CREATED, made.data)
        self.assertEqual(made.data["requestDetails"]["addressLine1"], "")


class SampleValuesTests(QuestionTestCase):
    def test_the_office_previews_a_letter_with_a_real_student(self):
        make_student("QST020")
        self.client.force_authenticate(self.office)
        sample = self.client.get(f"{TEMPLATES}sample-values/?student=qst020").data
        self.assertEqual(sample["matricNumber"], "QST020")
        self.assertEqual(sample["values"]["STUDENT_NAME"], "Student QST020")
        self.assertEqual(sample["values"]["PASSPORT_NUMBER"], "A1234567")
        self.assertEqual(self.client.get(f"{TEMPLATES}sample-values/?student=NOPE").status_code, status.HTTP_404_NOT_FOUND)

    def test_students_cannot_look_up_other_students(self):
        self.client.force_authenticate(make_student("QST021"))
        self.assertEqual(self.client.get(f"{TEMPLATES}sample-values/?student=QST021").status_code, status.HTTP_403_FORBIDDEN)


class AnsweringTests(QuestionTestCase):
    def test_the_form_lists_the_questions_with_their_choices(self):
        self.client.force_authenticate(make_student("QST010"))
        form = self.client.get(f"{REQUESTS}form/{self.visa.pk}/").data
        embassy = form["questions"][0]
        self.assertEqual(embassy["list"]["itemNoun"], "Embassy")
        self.assertEqual([item["name"] for item in embassy["list"]["items"]], ["Embassy of Japan", "Embassy of Korea"])
        self.assertNotIn("content", form)

    def test_students_only_see_forms_of_active_letters(self):
        self.visa.status = LetterTemplate.Status.DRAFT
        self.visa.save()
        self.client.force_authenticate(make_student("QST011"))
        self.assertEqual(self.client.get(f"{REQUESTS}form/{self.visa.pk}/").status_code, status.HTTP_404_NOT_FOUND)
        self.client.force_authenticate(self.office)
        self.assertEqual(self.client.get(f"{REQUESTS}form/{self.visa.pk}/").status_code, status.HTTP_200_OK)

    def test_required_answers_and_their_formats_are_checked(self):
        refused = self.ask_visa(make_student("QST012"), {"EMBASSY": "Embassy of France", "TRAVEL_DATE": "next week"})
        self.assertEqual(refused.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(set(refused.data["answers"]), {"EMBASSY", "TRAVEL_DATE"})
        self.assertFalse(GeneratedLetter.objects.filter(template=self.visa).exists())

    def test_answers_are_saved_with_what_they_print_as(self):
        response = self.ask_visa(make_student("QST013"), {"EMBASSY": str(self.japan.pk), "TRAVEL_DATE": "2026-12-01", "WITH_FAMILY": True})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        answers = response.data["requestDetails"]["answers"]
        self.assertEqual(answers["EMBASSY"]["value"], "Embassy of Japan")
        self.assertEqual(answers["TRAVEL_DATE"]["value"], english_date(date(2026, 12, 1)))
        self.assertEqual(answers["WITH_FAMILY"]["valueMs"], "Ya")
        self.assertNotIn("PASSPORT_EXPIRY", answers)
        letter = GeneratedLetter.objects.get(pk=response.data["id"])
        self.assertEqual(list(letter.choice_items.all()), [self.japan])

    def test_the_office_sees_the_answers_and_the_letter_prints_them(self):
        request_id = self.ask_visa(make_student("QST014"), {"EMBASSY": "embassy of japan", "TRAVEL_DATE": "2026-12-01"}).data["id"]
        self.client.force_authenticate(self.office)
        review = self.client.get(f"{REQUESTS}{request_id}/").data
        fields = {field["name"]: field for field in review["fields"]}
        self.assertEqual((fields["EMBASSY"]["source"], fields["EMBASSY"]["value"]), ("student", "Embassy of Japan"))
        self.assertFalse(fields["PASSPORT_EXPIRY"]["needed"])
        self.assertEqual(review["malayValues"]["EMBASSY"], "Kedutaan Jepun")
        approved = self.approve(request_id)
        self.assertEqual(approved.status_code, status.HTTP_200_OK, approved.data)
        letter = GeneratedLetter.objects.get(pk=request_id)
        self.assertIn(f"To Embassy of Japan", letter.content)
        self.assertIn(f"travels on {english_date(date(2026, 12, 1))}. Family: No. Passport expiry: .", letter.content)
        self.assertIn(f"Kepada Kedutaan Jepun", letter.content_ms)
        self.assertIn(f"pada {malay_date(date(2026, 12, 1))}. Keluarga: Tidak.", letter.content_ms)
        self.assertNotIn("{{", letter.content + letter.content_ms)


class PassportValueTests(QuestionTestCase):
    def test_a_passport_is_never_filled_with_an_ic(self):
        from accounts.models import StudentRegistry

        user = make_student("QST030")
        StudentRegistry.objects.update_or_create(
            student=user.student, defaults={"ic_number": "950101-14-7774", "passport_number": "", "nationality": "Malaysian"}
        )
        self.client.force_authenticate(self.office)
        values = self.client.get(f"{TEMPLATES}sample-values/?student=QST030").data["values"]
        self.assertNotIn("PASSPORT_NUMBER", values)
        self.assertEqual(values["IC_OR_PASSPORT"], "950101-14-7774")


class TypedOptionsTests(QuestionTestCase):
    def setUp(self):
        super().setUp()
        self.campus = [{"kind": "choice", "name": "CAMPUS", "label": "Which campus?", "hint": "", "required": True, "options": [" Main campus ", "City campus", "main campus", ""]}]

    def test_typed_options_are_tidied_and_saved(self):
        response = self.save(content="At {{CAMPUS}}", formQuestions=self.campus)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        question = response.data["formQuestions"][0]
        self.assertEqual(question["options"], ["Main campus", "City campus"])
        self.assertNotIn("listId", question)

    def test_a_student_picks_one_of_the_typed_options(self):
        self.visa.form_questions = [{"kind": "choice", "name": "CAMPUS", "label": "Which campus?", "hint": "", "required": True, "options": ["Main campus", "City campus"]}]
        self.visa.content = "At {{CAMPUS}}"
        self.visa.content_ms = "Di {{CAMPUS}}"
        self.visa.save()
        student = make_student("QST040")
        self.client.force_authenticate(student)
        form = self.client.get(f"{REQUESTS}form/{self.visa.pk}/").data
        choice = next(q for q in form["questions"] if q.get("name") == "CAMPUS")
        self.assertEqual([item["name"] for item in choice["list"]["items"]], ["Main campus", "City campus"])
        refused = self.ask_visa(student, {"CAMPUS": "Moon campus"})
        self.assertEqual(refused.status_code, status.HTTP_400_BAD_REQUEST)
        made = self.ask_visa(student, {"CAMPUS": "city campus"})
        self.assertEqual(made.status_code, status.HTTP_201_CREATED, made.data)
        self.assertEqual(made.data["requestDetails"]["answers"]["CAMPUS"]["value"], "City campus")
