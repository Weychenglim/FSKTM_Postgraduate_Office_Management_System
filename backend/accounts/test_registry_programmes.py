"""Programme names in the office's own spreadsheets: mapped once each, or skipped (UC04)."""

import json

from django.core import mail
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase

from .models import RegistryImportBatch, RegistryProgrammeAlias, Student, User
from .programmes import APPROVED_PROGRAMMES
from .registry_programmes import similar_programme

DS, CS, AI = APPROVED_PROGRAMMES
IMPORT = "/api/registry/students/import/"
HEADER = "student_id,full_name,programme,email,phone"


def csv_file(lines, name="smoke-programmes.csv"):
    return SimpleUploadedFile(name, "\n".join(lines).encode("utf-8"), content_type="text/csv")


class ProgrammeNamesBase(APITestCase):
    def setUp(self):
        cache.clear()
        self.office = User.objects.create_user(
            email="programmes-office@example.test",
            password="pw-office-7501",
            full_name="Programmes Office",
            role=User.Role.OFFICE_ADMIN,
        )
        self.client.force_authenticate(self.office)

    def post(self, lines, options=None, dry_run=True):
        data = {"file": csv_file(lines)}
        if options is not None:
            data["options"] = json.dumps(options)
        if dry_run:
            data["dryRun"] = "true"
        return self.client.post(IMPORT, data, format="multipart")

    def statuses(self, response):
        return [row["status"] for row in response.data["rows"]]


EXTRACT = [
    HEADER,
    f"WQD290001,Approved Name,{DS},approved@example.test,",
    "WQD290002,Long Name,Master of Data Science,long.name@example.test,",
    "WQD290003,Short Name,MDS,short.name@example.test,",
    "WQD290004,Malay Name,Sarjana Sains Data,malay.name@example.test,",
    "WQD290005,Doctor One,PhD,doctor.one@example.test,",
    "WQD290006,Doctor Two,phd,doctor.two@example.test,",
    "WQD290007,Second Long,master of data science,second.long@example.test,",
]


class ProgrammeValuesTests(ProgrammeNamesBase):
    def test_names_that_are_not_approved_are_listed_once_with_their_rows(self):
        response = self.post(EXTRACT)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [(entry["value"], entry["rows"]) for entry in response.data["programmeValues"]],
            [("Master of Data Science", 2), ("MDS", 1), ("Sarjana Sains Data", 1), ("PhD", 2)],
        )
        self.assertEqual(response.data["programmeValueCount"], 4)

    def test_similar_names_are_suggested_but_never_applied_without_a_choice(self):
        response = self.post(EXTRACT)
        suggestions = {entry["value"]: (entry["suggestion"], entry["source"]) for entry in response.data["programmeValues"]}
        self.assertEqual(suggestions["Master of Data Science"], (DS, "similar"))
        self.assertEqual(suggestions["MDS"], (None, None))
        self.assertEqual(suggestions["PhD"], (None, None))
        self.assertEqual(
            self.statuses(response),
            ["Ready", "Bad Programme", "Bad Programme", "Bad Programme", "Bad Programme", "Bad Programme", "Bad Programme"],
        )

    def test_only_safe_differences_count_as_similar(self):
        cases = {
            "master of data science by coursework": DS,
            "Master of Cybersecurity": CS,
            "MASTER OF ARTIFICIAL INTELLIGENCE": AI,
            "Master of Data Science (Research)": None,
            "Master in Data Science": None,
            "Coursework": None,
        }
        for value, expected in cases.items():
            with self.subTest(value=value):
                self.assertEqual(similar_programme(value), expected)

    def test_official_malay_names_are_suggested(self):
        cases = {
            "Sarjana Keselamatan Siber": CS,
            "SARJANA SAINS DATA (KERJA KURSUS)": DS,
            "Sarjana Kecerdasan Buatan secara Kerja Kursus": AI,
            "Sarjana Sains Komputer": None,
        }
        for value, expected in cases.items():
            with self.subTest(value=value):
                self.assertEqual(similar_programme(value), expected)

    def test_a_blank_programme_is_reported_as_missing(self):
        response = self.post([HEADER, "WQD290101,No Programme,,no.programme@example.test,"])
        row = response.data["rows"][0]
        self.assertEqual((row["status"], row["issue"]), ("Missing Field", "programme is required"))
        self.assertEqual(response.data["programmeValues"], [])


class ProgrammeChoiceTests(ProgrammeNamesBase):
    CHOICES = {
        "Master of Data Science": DS,
        "MDS": DS,
        "Sarjana Sains Data": DS,
        "PhD": "__skip__",
    }

    def test_one_choice_maps_every_row_with_that_name(self):
        response = self.post(EXTRACT, {"programmeMap": self.CHOICES})
        rows = response.data["rows"]
        self.assertEqual(
            self.statuses(response),
            ["Ready", "Ready", "Ready", "Ready", "Programme Skipped", "Programme Skipped", "Ready"],
        )
        self.assertEqual({row["programme"] for row in rows if row["status"] == "Ready"}, {DS})
        self.assertEqual(rows[2]["programmeInFile"], "MDS")
        self.assertNotIn("programmeInFile", rows[0])
        self.assertEqual(rows[4]["issue"], 'you chose to skip the programme "PhD"')

    def test_skipped_rows_are_listed_and_not_created(self):
        response = self.post(EXTRACT, {"programmeMap": self.CHOICES}, dry_run=False)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(Student.objects.filter(matric_no__in=["WQD290005", "WQD290006"]).exists())
        self.assertEqual(Student.objects.filter(programme=DS).count(), 5)
        skipped = [row for row in response.data["rows"] if row["status"] == "Programme Skipped"]
        self.assertEqual([row["result"] for row in skipped], ["skipped", "skipped"])
        batch = response.data["batch"]
        self.assertEqual((batch["skipped"], batch["programmeSkipped"], batch["failed"]), (2, 2, 0))
        self.assertEqual(
            [(problem["id"], problem["status"]) for problem in batch["problems"]],
            [("WQD290005", "Programme Skipped"), ("WQD290006", "Programme Skipped")],
        )
        self.assertEqual(len(mail.outbox), 5)

    def test_a_skipped_row_is_never_the_first_copy_of_a_student(self):
        response = self.post(
            [
                HEADER,
                "WQD290201,Doctor Row,PhD,doctor.row@example.test,",
                f"WQD290201,Master Row,{DS},doctor.row@example.test,",
            ],
            {"programmeMap": {"PhD": "__skip__"}},
        )
        self.assertEqual(self.statuses(response), ["Programme Skipped", "Ready"])

    def test_choices_are_remembered_on_import_and_never_on_preview(self):
        self.post(EXTRACT, {"programmeMap": {**self.CHOICES, "Not In This File": CS}})
        self.assertFalse(RegistryProgrammeAlias.objects.exists())

        self.post(EXTRACT, {"programmeMap": {**self.CHOICES, "Not In This File": CS}}, dry_run=False)
        saved = {alias.value_key: alias.programme for alias in RegistryProgrammeAlias.objects.all()}
        self.assertEqual(
            saved,
            {"masterofdatascience": DS, "mds": DS, "sarjanasainsdata": DS, "phd": ""},
        )
        self.assertEqual({alias.updated_by for alias in RegistryProgrammeAlias.objects.all()}, {self.office})

        later = self.post(
            [HEADER, "WQD290301,Next Intake,M.D.S,next.intake@example.test,", "WQD290302,Next Doctor,PHD,next.doctor@example.test,"]
        )
        self.assertEqual(
            [(entry["value"], entry["suggestion"], entry["source"]) for entry in later.data["programmeValues"]],
            [("M.D.S", DS, "saved"), ("PHD", "__skip__", "saved")],
        )

    def test_a_saved_choice_of_a_programme_no_longer_approved_is_not_suggested(self):
        RegistryProgrammeAlias.objects.create(value_key="mds", programme="MASTER OF SOMETHING OLD")
        response = self.post([HEADER, "WQD290401,Old Choice,MDS,old.choice@example.test,"])
        entry = response.data["programmeValues"][0]
        self.assertEqual((entry["suggestion"], entry["source"]), (None, None))

    def test_a_choice_outside_the_approved_list_is_refused(self):
        response = self.post(EXTRACT, {"programmeMap": {"MDS": "Master of Something"}})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["programmeMap"], ['"Master of Something" is not an approved programme.'])
        for bad in (["MDS"], {"MDS": 3}):
            with self.subTest(bad=bad):
                refused = self.post(EXTRACT, {"programmeMap": bad})
                self.assertEqual(refused.data["programmeMap"], ["The programme choices could not be read."])

    def test_the_choices_are_kept_with_the_import(self):
        self.post(EXTRACT, {"programmeMap": self.CHOICES}, dry_run=False)
        self.assertEqual(
            RegistryImportBatch.objects.get().settings_used["programmeMap"],
            {"masterofdatascience": DS, "mds": DS, "sarjanasainsdata": DS, "phd": ""},
        )
