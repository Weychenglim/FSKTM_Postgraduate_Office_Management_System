"""Letter templates and letter requests for the FSKTM PG Office system.

The office authors templates (name, status, body with ``{{PLACEHOLDER}}`` tags,
and any fields the office fills in itself, such as attendance). Students only
ever see an Active template's name and description, never its wording.

A student asks for a letter by creating a ``GeneratedLetter`` request. The
office approves it, filling in what the student's record cannot, and the
server then fills the template's current wording, issues the reference number
and saves the letter; or the office rejects it with a reason. Either way the
student is told. A template with pending requests cannot be deleted.

Appointment letters (UC22) come from templates used for a supervisor or panel
appointment. They are made by themselves when a coordinator approves the
appointment (see ``appointment_letters.py``), and go to the student and the
lecturers named on them.
"""
from django.conf import settings
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower
from django.utils.timezone import localtime

from .recipients import OPTIONAL_DETAILS


class LetterPurpose(models.TextChoices):
    REQUEST = "REQUEST", "Student requests"
    SUPERVISOR_APPOINTMENT = "SUPERVISOR_APPOINTMENT", "Supervisor appointment letter"
    PANEL_APPOINTMENT = "PANEL_APPOINTMENT", "Panel appointment letter"
    CO_SUPERVISOR_APPOINTMENT = "CO_SUPERVISOR_APPOINTMENT", "Supporting supervisor appointment letter"


AUTOMATIC_PURPOSES = (
    LetterPurpose.SUPERVISOR_APPOINTMENT,
    LetterPurpose.PANEL_APPOINTMENT,
    LetterPurpose.CO_SUPERVISOR_APPOINTMENT,
)


class LetterTemplate(models.Model):
    """An official letter template managed by the postgraduate office."""

    class Status(models.TextChoices):
        ACTIVE = "Active", "Active"
        DRAFT = "Draft", "Draft"
        ARCHIVED = "Archived", "Archived"

    name = models.CharField(max_length=255)
    purpose = models.CharField(max_length=32, choices=LetterPurpose.choices, default=LetterPurpose.REQUEST)
    # Frontend calls this "type"; kept distinct from the Python builtin here.
    letter_type = models.CharField(max_length=128, default="Academic Certification")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    description = models.CharField(max_length=500, blank=True, default="")
    content = models.TextField(
        blank=True,
        default="",
        help_text="Letter body with {{PLACEHOLDER}} tags; the allowed tags are "
        "listed in letters/placeholders.py, plus this template's own fields.",
    )
    # The same letter in Malay, printed as a second page; blank for English only.
    content_ms = models.TextField(blank=True, default="")
    # Values the office types in when it approves a request, e.g.
    # [{"name": "ATTENDANCE", "label": "Attendance (%)", "hint": ""}].
    custom_fields = models.JSONField(default=list, blank=True)
    # What the student answers when asking for it, in order (see form_questions.py),
    # e.g. [{"kind": "recipient", "purposes": [], "askAddress": true}, {"kind": "extras"},
    # {"kind": "date", "name": "DATE_NEEDED", "label": "Date needed by", ...}].
    form_questions = models.JSONField(default=list, blank=True)
    # Students say who the letter is for (purpose, organisation, address); kept
    # in step with a "recipient" question in form_questions.
    asks_recipient = models.BooleanField(default=False)
    # How long an issued letter stays valid, for {{VALID_UNTIL}}; blank for no limit.
    valid_months = models.PositiveSmallIntegerField(null=True, blank=True)
    # "Usually ready in N working days", shown to students; blank to say nothing.
    ready_in_days = models.PositiveSmallIntegerField(null=True, blank=True)
    # Prefix used to build the student's reference number, e.g. "UMF/PG".
    reference_prefix = models.CharField(max_length=64, blank=True, default="UMF/PG")
    # Printed under the signature line; blank keeps the faculty default.
    signatory_name = models.CharField(max_length=120, blank=True, default="")
    signatory_title = models.CharField(max_length=120, blank=True, default="")
    # The same lines on the Malay page; blank uses the English ones, then the Malay default.
    signatory_name_ms = models.CharField(max_length=120, blank=True, default="")
    signatory_title_ms = models.CharField(max_length=120, blank=True, default="")
    modified_by = models.CharField(max_length=255, blank=True, default="Office Staff")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["purpose"],
                condition=Q(status="Active") & ~Q(purpose="REQUEST"),
                name="one_active_template_per_appointment_letter",
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.status})"

    @property
    def is_automatic(self):
        return self.purpose in AUTOMATIC_PURPOSES

    def question(self, kind):
        """The first form question of ``kind``, or None."""
        return next((q for q in self.form_questions or [] if q.get("kind") == kind), None)

    def optional_details(self):
        """The optional lines a student may tick for this letter: those whose
        tag the letter uses, when it has an "Additional information" question."""
        if not self.question("extras"):
            return []
        both = f"{self.content}\n{self.content_ms}"
        return [code for code, _, tag in OPTIONAL_DETAILS if f"{{{{{tag}}}}}" in both]

    def to_public_dict(self, *, include_wording=True):
        """Shape this template the way the React frontend's ``LetterTemplate``
        type expects. Students get it without the wording or the office fields,
        so a letter cannot be copied before the office approves it."""
        data = {
            "id": str(self.pk),
            "name": self.name,
            "type": self.letter_type,
            "purpose": self.purpose,
            "status": self.status,
            "description": self.description,
            "referencePrefix": self.reference_prefix,
            "signatoryName": self.signatory_name,
            "signatoryTitle": self.signatory_title,
            "signatoryNameMs": self.signatory_name_ms,
            "signatoryTitleMs": self.signatory_title_ms,
            "asksRecipient": self.asks_recipient,
            "optionalDetails": self.optional_details(),
            "formQuestions": list(self.form_questions or []),
            "validMonths": self.valid_months,
            "readyInDays": self.ready_in_days,
            "lastModified": localtime(self.updated_at).strftime("%b %d, %Y"),
            "modifiedBy": self.modified_by,
        }
        if include_wording:
            data["content"] = self.content
            data["contentMs"] = self.content_ms
            data["customFields"] = list(self.custom_fields or [])
        return data


class LetterReferenceCounter(models.Model):
    """The last reference number issued for one prefix in one year."""

    prefix = models.CharField(max_length=64)
    year = models.PositiveIntegerField()
    last_number = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["prefix", "year"], name="unique_letter_reference_counter"
            )
        ]

    def __str__(self):
        return f"{self.prefix}/{self.year}: {self.last_number}"


def _day(value):
    return value.strftime("%d %B %Y") if value else ""


def _moment(value):
    return localtime(value).isoformat() if value else None


class GeneratedLetter(models.Model):
    """A student's letter request and, once approved, the letter as issued.

    Pending requests have no reference number, wording or date yet; those are
    set when the office approves. Issued letters are kept exactly as issued.

    An appointment letter is linked to its supervisor, panel or supporting
    supervisor appointment and lists its recipients, the lecturers who may open
    it besides the student.
    """

    class Status(models.TextChoices):
        PENDING = "Pending", "Pending"
        ISSUED = "Issued", "Issued"
        REJECTED = "Rejected", "Rejected"
        WITHDRAWN = "Withdrawn", "Withdrawn"
        REVOKED = "Revoked", "Revoked"

    # SET_NULL keeps the register intact if an account or template is removed;
    # the snapshots below still say who the letter was for and what it was.
    student = models.ForeignKey(
        "accounts.Student",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="generated_letters",
    )
    template = models.ForeignKey(
        LetterTemplate,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="generated_letters",
    )
    template_name = models.CharField(max_length=255)
    letter_type = models.CharField(max_length=128, blank=True, default="")
    purpose = models.CharField(max_length=32, choices=LetterPurpose.choices, default=LetterPurpose.REQUEST)
    supervisor_appointment = models.ForeignKey(
        "appointments.SupervisorAppointment",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="letters",
    )
    panel_appointment = models.ForeignKey(
        "appointments.PanelAppointment",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="letters",
    )
    co_supervisor_appointment = models.ForeignKey(
        "appointments.CoSupervisorAppointment",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="letters",
    )
    recipients = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="received_letters")
    # The list items the student chose, so the office knows which ones are in use.
    choice_items = models.ManyToManyField("ChoiceItem", blank=True, related_name="letters")
    replaced_by = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    signatory_name = models.CharField(max_length=120, blank=True, default="")
    signatory_title = models.CharField(max_length=120, blank=True, default="")
    signatory_name_ms = models.CharField(max_length=120, blank=True, default="")
    signatory_title_ms = models.CharField(max_length=120, blank=True, default="")
    # Set on approval. Several pending requests may hold no number at once.
    reference_number = models.CharField(max_length=96, unique=True, null=True, blank=True)
    content = models.TextField(
        blank=True, default="", help_text="The letter body with every placeholder filled in."
    )
    content_ms = models.TextField(blank=True, default="", help_text="The Malay page, filled in like the English one.")
    # Who a confirmation letter is for, and which optional lines the student asked for.
    request_details = models.JSONField(default=dict, blank=True)
    valid_until = models.DateField(null=True, blank=True)
    student_data = models.JSONField(
        default=dict, help_text="The student details the letter was filled from."
    )
    # What the office typed in on approval, keyed by placeholder name.
    office_values = models.JSONField(default=dict, blank=True)
    student_note = models.CharField(max_length=500, blank=True, default="")
    issued_on = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    decided_at = models.DateTimeField(null=True, blank=True)
    reject_reason = models.CharField(max_length=500, blank=True, default="")
    withdrawn_at = models.DateTimeField(null=True, blank=True)
    resend_count = models.PositiveIntegerField(default=0)
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    revoke_reason = models.CharField(max_length=500, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["status", "-created_at"])]
        constraints = [
            # One request at a time per letter: a second click, or a second
            # tab, cannot queue the same letter twice.
            models.UniqueConstraint(
                fields=["student", "template"],
                condition=Q(status="Pending", purpose="REQUEST"),
                name="one_pending_request_per_letter",
            ),
            # A retry or a second worker cannot make a second letter for the
            # same appointment; a revoked one can be replaced.
            models.UniqueConstraint(
                fields=["supervisor_appointment"],
                condition=Q(supervisor_appointment__isnull=False, status__in=["Pending", "Issued"]),
                name="one_live_letter_per_supervisor_appointment",
            ),
            models.UniqueConstraint(
                fields=["panel_appointment"],
                condition=Q(panel_appointment__isnull=False, status__in=["Pending", "Issued"]),
                name="one_live_letter_per_panel_appointment",
            ),
            models.UniqueConstraint(
                fields=["co_supervisor_appointment"],
                condition=Q(co_supervisor_appointment__isnull=False, status__in=["Pending", "Issued"]),
                name="one_live_letter_per_co_supervisor_appointment",
            ),
            models.CheckConstraint(
                condition=(
                    (Q(supervisor_appointment__isnull=True) & Q(panel_appointment__isnull=True))
                    | (Q(supervisor_appointment__isnull=True) & Q(co_supervisor_appointment__isnull=True))
                    | (Q(panel_appointment__isnull=True) & Q(co_supervisor_appointment__isnull=True))
                ),
                name="letter_links_one_appointment",
            ),
        ]

    def __str__(self):
        return f"{self.reference_number or f'Request {self.pk}'} ({self.template_name})"

    @property
    def is_automatic(self):
        return self.purpose in AUTOMATIC_PURPOSES

    @property
    def appointment(self):
        return self.supervisor_appointment or self.panel_appointment or self.co_supervisor_appointment

    def to_public_dict(self, *, include_content=True):
        snapshot = self.student_data or {}
        decider = self.decided_by
        data = {
            "id": str(self.pk),
            "referenceNumber": self.reference_number or "",
            "templateId": str(self.template_id) if self.template_id else None,
            "templateName": self.template_name,
            "letterType": self.letter_type,
            "purpose": self.purpose,
            "replacedById": str(self.replaced_by_id) if self.replaced_by_id else None,
            "signatoryName": self.signatory_name,
            "signatoryTitle": self.signatory_title,
            "signatoryNameMs": self.signatory_name_ms,
            "signatoryTitleMs": self.signatory_title_ms,
            "status": self.status,
            "date": _day(self.issued_on),
            "requestedAt": _moment(self.created_at),
            "issuedAt": _moment(self.decided_at) if self.status in (self.Status.ISSUED, self.Status.REVOKED) else None,
            "studentName": snapshot.get("studentName", ""),
            "matricNumber": snapshot.get("matricNumber", ""),
            "programName": snapshot.get("programName", ""),
            "note": self.student_note,
            "decidedAt": _moment(self.decided_at),
            "decidedBy": (getattr(decider, "full_name", "") or getattr(decider, "email", "")) if decider else "",
            "rejectReason": self.reject_reason,
            "withdrawnAt": _moment(self.withdrawn_at),
            "revokedAt": _moment(self.revoked_at),
            "revokeReason": self.revoke_reason,
            "requestDetails": dict(self.request_details or {}),
            "validUntil": self.valid_until.isoformat() if self.valid_until else None,
        }
        if include_content:
            data["content"] = self.content
            data["contentMs"] = self.content_ms
        return data


class ChoiceList(models.Model):
    """A list the office keeps for letter questions: the recipients students
    choose from, grouped by purpose, or a simple list such as embassies."""

    class Kind(models.TextChoices):
        RECIPIENTS = "RECIPIENTS", "Recipients"
        SIMPLE = "SIMPLE", "Simple list"

    name = models.CharField(max_length=120)
    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.SIMPLE)
    description = models.CharField(max_length=300, blank=True, default="")
    # What one entry is called, e.g. "Embassy"; recipient groups name their own.
    item_noun = models.CharField(max_length=60, blank=True, default="Item")
    modified_by = models.CharField(max_length=255, blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-kind", "name"]
        constraints = [
            models.UniqueConstraint(Lower("name"), name="choice_list_name_unique"),
            models.UniqueConstraint(fields=["kind"], condition=Q(kind="RECIPIENTS"), name="one_recipients_list"),
        ]

    def __str__(self):
        return self.name


class ChoiceGroup(models.Model):
    """A purpose in the recipients list, such as Banking, with the organisations
    students choose from for it."""

    choice_list = models.ForeignKey(ChoiceList, on_delete=models.CASCADE, related_name="groups")
    # Saved on requests, so it never changes once made.
    code = models.CharField(max_length=40)
    name = models.CharField(max_length=120)
    name_ms = models.CharField(max_length=120, blank=True, default="")
    # What one organisation is called, e.g. "Bank".
    item_noun = models.CharField(max_length=60, blank=True, default="Organisation")
    # Students may type an organisation that is not listed.
    allow_other = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)
    hidden = models.BooleanField(default=False)
    modified_by = models.CharField(max_length=255, blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "id"]
        constraints = [
            models.UniqueConstraint(fields=["choice_list", "code"], name="choice_group_code_unique"),
            models.UniqueConstraint("choice_list", Lower("name"), name="choice_group_name_unique"),
        ]

    def __str__(self):
        return self.name


class ChoiceItem(models.Model):
    """One entry in a list: an organisation under a purpose, with the address
    filled in for the student, or an entry of a simple list."""

    choice_list = models.ForeignKey(ChoiceList, on_delete=models.CASCADE, related_name="items")
    group = models.ForeignKey(ChoiceGroup, null=True, blank=True, on_delete=models.CASCADE, related_name="items")
    name = models.CharField(max_length=160)
    name_ms = models.CharField(max_length=160, blank=True, default="")
    address_line1 = models.CharField(max_length=120, blank=True, default="")
    address_line2 = models.CharField(max_length=120, blank=True, default="")
    postcode = models.CharField(max_length=20, blank=True, default="")
    city = models.CharField(max_length=80, blank=True, default="")
    state = models.CharField(max_length=80, blank=True, default="")
    country = models.CharField(max_length=80, blank=True, default="")
    order = models.PositiveIntegerField(default=0)
    hidden = models.BooleanField(default=False)
    modified_by = models.CharField(max_length=255, blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "id"]
        constraints = [
            models.UniqueConstraint(
                "choice_list", "group", Lower("name"), name="choice_item_name_unique", nulls_distinct=False
            ),
        ]

    def __str__(self):
        return self.name

    def address(self):
        return {
            "addressLine1": self.address_line1,
            "addressLine2": self.address_line2,
            "postcode": self.postcode,
            "city": self.city,
            "state": self.state,
            "country": self.country,
        }
