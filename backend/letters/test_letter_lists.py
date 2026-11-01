"""The lists the office keeps for letter questions: purposes and organisations,
with saved addresses, that students choose from. The office adds, renames,
orders and hides entries; an entry letters used can only be hidden."""
from rest_framework import status

from .models import ChoiceGroup, ChoiceItem, ChoiceList, GeneratedLetter, LetterTemplate
from .test_letter_requests import REQUESTS, LetterRequestTestCase, User, make_student, make_user

LISTS = "/api/letters/lists/"
ADDRESS = {"addressLine1": "Jalan Universiti", "postcode": "50603", "city": "Kuala Lumpur", "state": "Wilayah Persekutuan Kuala Lumpur", "country": "Malaysia"}


class ListTestCase(LetterRequestTestCase):
    def setUp(self):
        super().setUp()
        self.recipients = ChoiceList.objects.get(kind=ChoiceList.Kind.RECIPIENTS)
        self.transport = self.recipients.groups.get(code="TRANSPORTATION")
        self.letter = LetterTemplate.objects.create(
            name="Student Confirmation Letter",
            status=LetterTemplate.Status.ACTIVE,
            asks_recipient=True,
            form_questions=[{"kind": "recipient", "purposes": [], "askAddress": True}],
            content="{{RECIPIENT}}\n\nThis is to confirm that {{STUDENT_NAME}} is registered.",
        )

    def as_office(self):
        self.client.force_authenticate(self.office)
        return self.client

    def add_item(self, group, **data):
        response = self.as_office().post(f"{LISTS}{self.recipients.pk}/items/", {"groupId": group.pk, **data}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return ChoiceItem.objects.get(pk=response.data["created"][0]["id"])

    def ask(self, user, details, template=None):
        self.client.force_authenticate(user)
        return self.client.post(REQUESTS, {"templateId": (template or self.letter).pk, "details": {**ADDRESS, **details}}, format="json")


class ManagingListsTests(ListTestCase):
    def test_only_office_staff_manage_lists(self):
        for user in (make_student("LST001"), make_user("coord.lists@example.test", User.Role.COORDINATOR)):
            with self.subTest(role=user.role):
                self.client.force_authenticate(user)
                self.assertEqual(self.client.get(LISTS).status_code, status.HTTP_403_FORBIDDEN)
                refused = self.client.post(f"{LISTS}{self.recipients.pk}/items/", {"groupId": self.transport.pk, "name": "Grab"}, format="json")
                self.assertEqual(refused.status_code, status.HTTP_403_FORBIDDEN)

    def test_the_recipients_list_starts_with_the_maya_purposes(self):
        listed = {row["name"]: row for row in self.as_office().get(LISTS).data}
        self.assertEqual(listed["Recipients"]["groupCount"], 6)
        self.assertEqual(listed["Recipients"]["itemCount"], 101)
        detail = self.as_office().get(f"{LISTS}{self.recipients.pk}/").data
        self.assertEqual([group["name"] for group in detail["groups"]][-1], "Transportation")
        self.assertEqual(next(g for g in detail["groups"] if g["code"] == "BANKING")["nameMs"], "Perbankan")

    def test_the_office_adds_renames_and_orders_purposes(self):
        added = self.as_office().post(f"{LISTS}{self.recipients.pk}/groups/", {"name": "Insurance", "itemNoun": "Insurer", "allowOther": False}, format="json")
        self.assertEqual(added.status_code, status.HTTP_201_CREATED, added.data)
        self.assertEqual(added.data["code"], "INSURANCE")
        twice = self.as_office().post(f"{LISTS}{self.recipients.pk}/groups/", {"name": "insurance"}, format="json")
        self.assertEqual(twice.status_code, status.HTTP_400_BAD_REQUEST)
        renamed = self.as_office().patch(f"/api/letters/list-groups/{added.data['id']}/", {"name": "Insurance companies", "nameMs": "Syarikat insurans"}, format="json")
        self.assertEqual(renamed.data["code"], "INSURANCE", "the code saved on requests never changes")
        ids = [str(group.pk) for group in self.recipients.groups.order_by("-order")]
        ordered = self.as_office().post(f"{LISTS}{self.recipients.pk}/order/", {"groupIds": ids}, format="json")
        self.assertEqual([group["id"] for group in ordered.data["groups"]], ids)
        self.assertEqual(ordered.data["groups"][0]["name"], "Insurance companies")

    def test_entries_with_saved_addresses_reach_the_student_form(self):
        self.add_item(self.transport, name="Grab Malaysia", addressLine1="Level 35, Menara MAX", city="Kuala Lumpur", postcode="50250")
        self.client.force_authenticate(make_student("LST002"))
        form = self.client.get(f"{REQUESTS}form/{self.letter.pk}/").data
        transport = next(p for p in form["questions"][0]["options"] if p["code"] == "TRANSPORTATION")
        grab = next(o for o in transport["organisations"] if o["name"] == "Grab Malaysia")
        self.assertEqual((grab["addressLine1"], grab["postcode"], grab["city"]), ("Level 35, Menara MAX", "50250", "Kuala Lumpur"))

    def test_a_saved_state_and_country_come_from_the_lists(self):
        url = f"{LISTS}{self.recipients.pk}/items/"
        typed = self.as_office().post(url, {"groupId": self.transport.pk, "name": "Rapid KL", "state": "KL"}, format="json")
        self.assertEqual(typed.status_code, status.HTTP_400_BAD_REQUEST)
        abroad = self.as_office().post(
            url, {"groupId": self.transport.pk, "name": "SBS Transit", "state": "Selangor", "country": "Singapore"}, format="json"
        )
        self.assertEqual(abroad.status_code, status.HTTP_201_CREATED, abroad.data)
        item = ChoiceItem.objects.get(name="SBS Transit")
        self.assertEqual((item.state, item.country), ("", "Singapore"))

    def test_names_are_unique_within_a_purpose_and_many_can_be_pasted(self):
        duplicate = self.as_office().post(
            f"{LISTS}{self.recipients.pk}/items/", {"groupId": self.transport.pk, "name": "airasia berhad"}, format="json"
        )
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)
        pasted = self.as_office().post(
            f"{LISTS}{self.recipients.pk}/items/",
            {"groupId": self.transport.pk, "names": "Grab Malaysia\n  AirAsia Berhad \n\nRapid Penang\nGrab Malaysia"},
            format="json",
        )
        self.assertEqual(pasted.status_code, status.HTTP_201_CREATED, pasted.data)
        self.assertEqual([row["name"] for row in pasted.data["created"]], ["Grab Malaysia", "Rapid Penang"])
        self.assertEqual(pasted.data["skipped"], ["AirAsia Berhad"])
        self.assertEqual(self.transport.items.last().name, "Rapid Penang", "pasted names go to the end")

    def test_an_entry_letters_used_can_only_be_hidden(self):
        ktmb = self.transport.items.get(name="Keretapi Tanah Melayu Berhad (KTMB)")
        student = make_student("LST003")
        self.assertEqual(self.ask(student, {"purpose": "TRANSPORTATION", "organisationId": ktmb.pk}).status_code, status.HTTP_201_CREATED)
        detail = self.as_office().get(f"{LISTS}{self.recipients.pk}/").data
        self.assertEqual(next(i for i in detail["items"] if i["id"] == str(ktmb.pk))["usedCount"], 1)
        refused = self.as_office().delete(f"/api/letters/list-items/{ktmb.pk}/")
        self.assertEqual(refused.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Hide it instead", refused.data["detail"])
        hidden = self.as_office().patch(f"/api/letters/list-items/{ktmb.pk}/", {"hidden": True}, format="json")
        self.assertTrue(hidden.data["hidden"])
        self.client.force_authenticate(make_student("LST004"))
        form = self.client.get(f"{REQUESTS}form/{self.letter.pk}/").data
        transport = next(p for p in form["questions"][0]["options"] if p["code"] == "TRANSPORTATION")
        self.assertNotIn("Keretapi Tanah Melayu Berhad (KTMB)", [o["name"] for o in transport["organisations"]])
        unused = self.transport.items.get(name="MASwings Sdn Bhd")
        self.assertEqual(self.as_office().delete(f"/api/letters/list-items/{unused.pk}/").status_code, status.HTTP_204_NO_CONTENT)

    def test_renaming_an_entry_never_changes_a_request_already_made(self):
        ktmb = self.transport.items.get(name="Keretapi Tanah Melayu Berhad (KTMB)")
        request_id = self.ask(make_student("LST005"), {"purpose": "TRANSPORTATION", "organisationId": ktmb.pk}).data["id"]
        self.as_office().patch(f"/api/letters/list-items/{ktmb.pk}/", {"name": "KTM Berhad"}, format="json")
        letter = GeneratedLetter.objects.get(pk=request_id)
        self.assertEqual(letter.request_details["organisation"], "Keretapi Tanah Melayu Berhad (KTMB)")
        self.assertEqual(letter.request_details["purposeLabel"], "Transportation")

    def test_a_purpose_can_keep_students_to_its_list(self):
        self.as_office().patch(f"/api/letters/list-groups/{self.transport.pk}/", {"allowOther": False}, format="json")
        student = make_student("LST006")
        typed = self.ask(student, {"purpose": "TRANSPORTATION", "organisation": "Grab Malaysia"})
        self.assertEqual(typed.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("from the list", typed.data["organisation"])
        listed = self.ask(student, {"purpose": "TRANSPORTATION", "organisation": "airasia berhad"})
        self.assertEqual(listed.status_code, status.HTTP_201_CREATED, listed.data)
        self.assertEqual(listed.data["requestDetails"]["organisation"], "AirAsia Berhad")
        self.assertFalse(listed.data["requestDetails"]["typedIn"])

    def test_hidden_purposes_are_not_offered(self):
        self.as_office().patch(f"/api/letters/list-groups/{self.transport.pk}/", {"hidden": True}, format="json")
        refused = self.ask(make_student("LST007"), {"purpose": "TRANSPORTATION", "organisation": "AirAsia Berhad"})
        self.assertEqual(set(refused.data), {"purpose"})

    def test_a_purpose_with_entries_or_letters_cannot_be_deleted(self):
        refused = self.as_office().delete(f"/api/letters/list-groups/{self.transport.pk}/")
        self.assertEqual(refused.status_code, status.HTTP_400_BAD_REQUEST)
        empty = ChoiceGroup.objects.get(code="MOBILITY")
        self.assertEqual(self.as_office().delete(f"/api/letters/list-groups/{empty.pk}/").status_code, status.HTTP_204_NO_CONTENT)

    def test_the_recipients_list_cannot_be_deleted(self):
        refused = self.as_office().delete(f"{LISTS}{self.recipients.pk}/")
        self.assertEqual(refused.status_code, status.HTTP_400_BAD_REQUEST)

    def test_simple_lists_for_choice_questions(self):
        made = self.as_office().post(LISTS, {"name": "Embassies", "itemNoun": "Embassy"}, format="json")
        self.assertEqual(made.status_code, status.HTTP_201_CREATED, made.data)
        embassies = ChoiceList.objects.get(pk=made.data["id"])
        pasted = self.as_office().post(f"{LISTS}{embassies.pk}/items/", {"names": ["Embassy of Japan", "Embassy of Korea"]}, format="json")
        self.assertEqual(len(pasted.data["created"]), 2)
        self.assertEqual(self.as_office().post(LISTS, {"name": "embassies"}, format="json").status_code, status.HTTP_400_BAD_REQUEST)
        LetterTemplate.objects.create(
            name="Visa Letter",
            form_questions=[{"kind": "choice", "name": "EMBASSY", "label": "Embassy", "hint": "", "required": True, "listId": embassies.pk}],
            content="To {{EMBASSY}}",
        )
        refused = self.as_office().delete(f"{LISTS}{embassies.pk}/")
        self.assertEqual(refused.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Visa Letter", refused.data["detail"])
        listed = {row["name"]: row for row in self.as_office().get(LISTS).data}
        self.assertEqual(listed["Embassies"]["usedBy"], ["Visa Letter"])
