import uuid
from pathlib import Path

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone

PANEL_WORKLOAD_LIMIT = 10


class StudentResearchProfile(models.Model):
    """Research profile required before a supervisor can recommend a panel."""

    student = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="research_profile",
        null=True,
        blank=True,
    )
    matric_no = models.CharField(max_length=64, unique=True, db_index=True)
    student_name = models.CharField(max_length=255)
    programme = models.CharField(max_length=255)
    semester = models.CharField(max_length=128)
    proposed_topic = models.CharField(max_length=500)
    research_area = models.CharField(max_length=255, blank=True)
    abstract = models.TextField(blank=True)
    revision = models.PositiveIntegerField(default=0)
    supervisor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="supervised_research_profiles",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["student_name"]

    def __str__(self):
        return f"{self.student_name} ({self.matric_no})"


class PanelRecommendation(models.Model):
    """Supervisor recommendation and approval lifecycle for one panel member."""

    class Status(models.TextChoices):
        SUBMITTED_TO_PANEL = "SUBMITTED_TO_PANEL", "Submitted to Panel"
        REJECTED_BY_PANEL = "REJECTED_BY_PANEL", "Rejected by Panel"
        PENDING_COORDINATOR = "PENDING_COORDINATOR", "Pending Coordinator"
        REJECTED_BY_COORDINATOR = "REJECTED_BY_COORDINATOR", "Rejected by Coordinator"
        CANCELLED_BY_SUPERVISOR = (
            "CANCELLED_BY_SUPERVISOR",
            "Cancelled by Supervisor",
        )
        CANCELLED_CAPACITY_FULL = "CANCELLED_CAPACITY_FULL", "Capacity full"
        CANCELLED_BY_OFFICE = "CANCELLED_BY_OFFICE", "Cancelled by Office"
        APPROVED = "APPROVED", "Approved"

    ACTIVE_STATUSES = (
        Status.SUBMITTED_TO_PANEL,
        Status.PENDING_COORDINATOR,
        Status.APPROVED,
    )
    PENDING_STATUSES = (Status.SUBMITTED_TO_PANEL, Status.PENDING_COORDINATOR)
    WORKLOAD_RESERVED_STATUSES = (Status.PENDING_COORDINATOR,)

    profile = models.ForeignKey(
        StudentResearchProfile,
        on_delete=models.PROTECT,
        related_name="panel_recommendations",
    )
    academic_semester = models.ForeignKey(
        "academics.AcademicSemester",
        on_delete=models.PROTECT,
        related_name="panel_recommendations",
        null=True,
        blank=True,
    )
    replaces_appointment = models.ForeignKey(
        "PanelAppointment",
        on_delete=models.PROTECT,
        related_name="replacement_recommendations",
        null=True,
        blank=True,
    )
    replacement_reason = models.TextField(blank=True)
    supervisor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="submitted_panel_recommendations",
    )
    recommended_member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="panel_recommendations_to_review",
    )
    status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.SUBMITTED_TO_PANEL,
        db_index=True,
    )
    justification = models.TextField(blank=True)
    panel_rejection_reason = models.TextField(blank=True)
    coordinator_rejection_reason = models.TextField(blank=True)
    cancellation_reason = models.TextField(blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    panel_decided_at = models.DateTimeField(null=True, blank=True)
    coordinator_decided_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["profile"],
                condition=Q(
                    status__in=[
                        "SUBMITTED_TO_PANEL",
                        "PENDING_COORDINATOR",
                    ]
                ),
                name="one_active_panel_recommendation_per_student",
            )
        ]

    def submit_if_needed(self):
        if self.status == self.Status.SUBMITTED_TO_PANEL and self.submitted_at is None:
            self.submitted_at = timezone.now()

    @property
    def display_rejection_reason(self):
        return self.panel_rejection_reason or self.coordinator_rejection_reason

    def __str__(self):
        return f"{self.profile.matric_no} -> {self.recommended_member}"


class PanelAppointment(models.Model):
    """Final approved panel assignment produced from an approved recommendation."""

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        ENDED = "ENDED", "Ended"
        COMPLETED = "COMPLETED", "Completed"

    class EndOutcome(models.TextChoices):
        COMPLETED = "COMPLETED", "Completed"
        REPLACED = "REPLACED", "Replaced"
        WITHDRAWN = "WITHDRAWN", "Withdrawn"
        OTHER = "OTHER", "Other"

    recommendation = models.OneToOneField(
        PanelRecommendation,
        on_delete=models.PROTECT,
        related_name="panel_appointment",
    )
    profile = models.ForeignKey(
        StudentResearchProfile,
        on_delete=models.PROTECT,
        related_name="panel_appointments",
    )
    supervisor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="supervised_panel_appointments",
    )
    panel_member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="panel_appointments",
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="approved_panel_appointments",
    )
    supersedes = models.OneToOneField(
        "self",
        on_delete=models.PROTECT,
        related_name="replacement_appointment",
        null=True,
        blank=True,
    )
    appointment_date = models.DateField(default=timezone.localdate)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.ACTIVE
    )
    end_outcome = models.CharField(
        max_length=16,
        choices=EndOutcome.choices,
        blank=True,
    )
    end_reason = models.TextField(blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    ended_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="ended_panel_appointments",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-appointment_date", "profile__student_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["profile"],
                condition=Q(status="ACTIVE"),
                name="one_active_panel_appointment_per_profile",
            )
        ]

    def __str__(self):
        return f"{self.profile.matric_no} panel: {self.panel_member}"


class SupervisorApplication(models.Model):
    """Student request for a supervisor and its two-stage decision lifecycle."""

    class Status(models.TextChoices):
        SUBMITTED_TO_SUPERVISOR = (
            "SUBMITTED_TO_SUPERVISOR",
            "Submitted to Supervisor",
        )
        REJECTED_BY_SUPERVISOR = (
            "REJECTED_BY_SUPERVISOR",
            "Rejected by Supervisor",
        )
        PENDING_COORDINATOR = "PENDING_COORDINATOR", "Pending Coordinator"
        REJECTED_BY_COORDINATOR = (
            "REJECTED_BY_COORDINATOR",
            "Rejected by Coordinator",
        )
        CANCELLED_BY_STUDENT = (
            "CANCELLED_BY_STUDENT",
            "Cancelled by Student",
        )
        CANCELLED_CAPACITY_FULL = "CANCELLED_CAPACITY_FULL", "Capacity full"
        CANCELLED_BY_OFFICE = "CANCELLED_BY_OFFICE", "Cancelled by Office"
        APPROVED = "APPROVED", "Approved"

    ACTIVE_STATUSES = (
        Status.SUBMITTED_TO_SUPERVISOR,
        Status.PENDING_COORDINATOR,
        Status.APPROVED,
    )

    student = models.ForeignKey(
        "accounts.Student",
        on_delete=models.PROTECT,
        related_name="supervisor_applications",
    )
    academic_semester = models.ForeignKey(
        "academics.AcademicSemester",
        on_delete=models.PROTECT,
        related_name="supervisor_applications",
        null=True,
        blank=True,
    )
    replaces_appointment = models.ForeignKey(
        "SupervisorAppointment",
        on_delete=models.PROTECT,
        related_name="replacement_applications",
        null=True,
        blank=True,
    )
    replacement_reason = models.TextField(blank=True)
    proposed_supervisor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="supervisor_applications_to_review",
    )
    research_title = models.CharField(max_length=500)
    project_course_codes = models.CharField(max_length=255, blank=True, default="")
    research_area = models.CharField(max_length=255, blank=True, default="")
    research_abstract = models.TextField()
    section_a = models.JSONField(null=True, blank=True, editable=False)
    research_intent = models.JSONField(null=True, blank=True, editable=False)
    status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.SUBMITTED_TO_SUPERVISOR,
        db_index=True,
    )
    supervisor_rejection_reason = models.TextField(blank=True)
    coordinator_rejection_reason = models.TextField(blank=True)
    cancellation_reason = models.TextField(blank=True)
    submitted_at = models.DateTimeField(default=timezone.now)
    supervisor_decided_at = models.DateTimeField(null=True, blank=True)
    coordinator_decided_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["student"],
                condition=Q(
                    status__in=[
                        "SUBMITTED_TO_SUPERVISOR",
                        "PENDING_COORDINATOR",
                    ]
                ),
                name="one_active_supervisor_application_per_student",
            )
        ]

    @property
    def rejection_reason(self):
        return (
            self.supervisor_rejection_reason
            or self.coordinator_rejection_reason
        )

    def __str__(self):
        return f"{self.student.matric_no} -> {self.proposed_supervisor}"


class SupervisorApplicationDraft(models.Model):
    """Private incomplete text and choices, with no application/workflow effects."""

    student = models.OneToOneField(
        "accounts.Student", on_delete=models.CASCADE, related_name="supervisor_application_draft",
    )
    content = models.JSONField()
    updated_at = models.DateTimeField(auto_now=True)


def supervisor_document_upload_path(instance, filename):
    extension = Path(filename).suffix.lower()
    return (
        f"supervisor-applications/{instance.application_id}/"
        f"{uuid.uuid4().hex}{extension}"
    )


class SupervisorApplicationDocument(models.Model):
    """Immutable private document supplied with a supervisor request."""

    application = models.ForeignKey(
        SupervisorApplication,
        on_delete=models.CASCADE,
        related_name="documents",
    )
    requirement = models.ForeignKey(
        "SupervisorDocumentRequirement",
        on_delete=models.PROTECT,
        related_name="application_documents",
        null=True,
        blank=True,
    )
    file = models.FileField(
        upload_to=supervisor_document_upload_path,
        max_length=500,
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=64)
    content_type = models.CharField(max_length=128, blank=True)
    size = models.PositiveBigIntegerField(default=0)
    requirement_code = models.SlugField(max_length=64, blank=True)
    requirement_label = models.CharField(max_length=255, blank=True)
    checksum_sha256 = models.CharField(max_length=64, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["uploaded_at", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["application", "requirement"],
                condition=Q(requirement__isnull=False),
                name="one_supervisor_document_per_requirement",
            )
        ]

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValidationError("Submitted supervisor application documents are immutable.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Submitted supervisor application documents are immutable.")


class SupervisorDocumentSetup(models.Model):
    """Explicit faculty-wide choice; an absent row remains unconfigured."""

    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    no_documents_required = models.BooleanField(default=False)

    class Meta:
        constraints = [models.CheckConstraint(condition=models.Q(id=1), name="supervisor_document_setup_singleton")]


class SupervisorDocumentRequirement(models.Model):
    """Office-configurable checklist item for supervisor applications."""

    code = models.SlugField(max_length=64, unique=True)
    label = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    is_required = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["display_order", "label"]

    def save(self, *args, **kwargs):
        if self.pk:
            persisted_code = type(self).objects.only("code").get(pk=self.pk).code
            if self.code != persisted_code:
                raise ValidationError("Document requirement codes are immutable.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Document requirements cannot be deleted; deactivate them instead.")


class SupervisorDocumentRequirementAudit(models.Model):
    class Action(models.TextChoices):
        CREATE = "CREATE", "Create"
        UPDATE = "UPDATE", "Update"
        SETUP = "SETUP", "Document setup"

    requirement = models.ForeignKey(
        SupervisorDocumentRequirement,
        on_delete=models.PROTECT,
        related_name="audits",
        null=True, blank=True,
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="supervisor_document_requirement_audits",
    )
    action = models.CharField(max_length=16, choices=Action.choices)
    reason = models.TextField(blank=True)
    before_values = models.JSONField(default=dict)
    after_values = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValidationError("Supervisor document requirement audits are immutable.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Supervisor document requirement audits are immutable.")


class SupervisorAppointment(models.Model):
    """Final active supervisor assignment created after coordinator approval."""

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        ENDED = "ENDED", "Ended"

    class EndOutcome(models.TextChoices):
        COMPLETED = "COMPLETED", "Completed"
        REPLACED = "REPLACED", "Replaced"
        WITHDRAWN = "WITHDRAWN", "Withdrawn"
        OTHER = "OTHER", "Other"

    application = models.OneToOneField(
        SupervisorApplication,
        on_delete=models.PROTECT,
        related_name="appointment",
    )
    student = models.ForeignKey(
        "accounts.Student",
        on_delete=models.PROTECT,
        related_name="supervisor_appointments",
    )
    supervisor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="active_supervisor_appointments",
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="approved_supervisor_appointments",
    )
    supersedes = models.OneToOneField(
        "self",
        on_delete=models.PROTECT,
        related_name="replacement_appointment",
        null=True,
        blank=True,
    )
    appointment_date = models.DateField(default=timezone.localdate)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )
    end_outcome = models.CharField(
        max_length=16,
        choices=EndOutcome.choices,
        blank=True,
    )
    end_reason = models.TextField(blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    ended_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="ended_supervisor_appointments",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-appointment_date", "student__matric_no"]
        constraints = [
            models.UniqueConstraint(
                fields=["student"],
                condition=Q(status="ACTIVE"),
                name="one_active_supervisor_appointment_per_student",
            )
        ]


class CoSupervisorNomination(models.Model):
    """A supporting supervisor nomination; primary academic duties stay unchanged."""

    class Status(models.TextChoices):
        SUBMITTED_TO_CO_SUPERVISOR = (
            "SUBMITTED_TO_CO_SUPERVISOR",
            "Awaiting co-supervisor",
        )
        PENDING_COORDINATOR = "PENDING_COORDINATOR", "Awaiting coordinator"
        APPROVED = "APPROVED", "Approved"
        REJECTED_BY_CO_SUPERVISOR = (
            "REJECTED_BY_CO_SUPERVISOR",
            "Rejected by co-supervisor",
        )
        REJECTED_BY_COORDINATOR = "REJECTED_BY_COORDINATOR", "Rejected by coordinator"
        CANCELLED = "CANCELLED", "Cancelled"

    PENDING_STATUSES = (Status.SUBMITTED_TO_CO_SUPERVISOR, Status.PENDING_COORDINATOR)
    student = models.ForeignKey(
        "accounts.Student",
        on_delete=models.PROTECT,
        related_name="co_supervisor_nominations",
    )
    primary_appointment = models.ForeignKey(
        SupervisorAppointment,
        on_delete=models.PROTECT,
        related_name="co_supervisor_nominations",
    )
    nominator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="submitted_co_supervisor_nominations",
    )
    candidate = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="co_supervisor_nominations_to_review",
    )
    academic_semester = models.ForeignKey(
        "academics.AcademicSemester",
        on_delete=models.PROTECT,
        related_name="co_supervisor_nominations",
    )
    replaces_appointment = models.ForeignKey(
        "CoSupervisorAppointment",
        on_delete=models.PROTECT,
        related_name="replacement_nominations",
        null=True,
        blank=True,
    )
    justification = models.TextField()
    status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.SUBMITTED_TO_CO_SUPERVISOR,
        db_index=True,
    )
    reason = models.TextField(blank=True)
    submitted_at = models.DateTimeField(default=timezone.now)
    candidate_decided_at = models.DateTimeField(null=True, blank=True)
    coordinator_decided_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-pk"]
        constraints = [
            models.UniqueConstraint(
                fields=["student", "candidate"],
                condition=Q(
                    status__in=["SUBMITTED_TO_CO_SUPERVISOR", "PENDING_COORDINATOR"]
                ),
                name="unique_pending_co_supervisor_candidate",
            ),
            models.UniqueConstraint(
                fields=["replaces_appointment"],
                condition=Q(
                    status__in=["SUBMITTED_TO_CO_SUPERVISOR", "PENDING_COORDINATOR"]
                ),
                name="unique_pending_co_supervisor_replacement",
            ),
        ]


class CoSupervisorAppointment(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        ENDED = "ENDED", "Ended"

    EndOutcome = SupervisorAppointment.EndOutcome
    nomination = models.OneToOneField(
        CoSupervisorNomination, on_delete=models.PROTECT, related_name="appointment"
    )
    student = models.ForeignKey(
        "accounts.Student",
        on_delete=models.PROTECT,
        related_name="co_supervisor_appointments",
    )
    supervisor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="co_supervisor_appointments",
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="approved_co_supervisor_appointments",
    )
    supersedes = models.OneToOneField(
        "self",
        on_delete=models.PROTECT,
        related_name="replacement_appointment",
        null=True,
        blank=True,
    )
    appointment_date = models.DateField(default=timezone.localdate)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.ACTIVE, db_index=True
    )
    end_outcome = models.CharField(
        max_length=16, choices=EndOutcome.choices, blank=True
    )
    end_reason = models.TextField(blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    ended_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="ended_co_supervisor_appointments",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-appointment_date", "-pk"]
        constraints = [
            models.UniqueConstraint(
                fields=["student", "supervisor"],
                condition=Q(status="ACTIVE"),
                name="unique_active_co_supervisor_candidate",
            )
        ]


class AppointmentLifecycleEvent(models.Model):
    """Immutable audit for appointment activation, closure, and handover."""

    class Action(models.TextChoices):
        ACTIVATED = "ACTIVATED", "Activated"
        ENDED = "ENDED", "Ended"
        REPLACED = "REPLACED", "Replaced"

    supervisor_appointment = models.ForeignKey(
        SupervisorAppointment,
        on_delete=models.PROTECT,
        related_name="lifecycle_events",
        null=True,
        blank=True,
    )
    panel_appointment = models.ForeignKey(
        PanelAppointment,
        on_delete=models.PROTECT,
        related_name="lifecycle_events",
        null=True,
        blank=True,
    )
    co_supervisor_appointment = models.ForeignKey(
        CoSupervisorAppointment,
        on_delete=models.PROTECT,
        related_name="lifecycle_events",
        null=True,
        blank=True,
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="appointment_lifecycle_events",
    )
    actor_role = models.CharField(max_length=64)
    action = models.CharField(max_length=16, choices=Action.choices)
    previous_status = models.CharField(max_length=16, blank=True)
    new_status = models.CharField(max_length=16)
    outcome = models.CharField(max_length=16, blank=True)
    reason = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["created_at", "id"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(
                        supervisor_appointment__isnull=False,
                        panel_appointment__isnull=True,
                        co_supervisor_appointment__isnull=True,
                    )
                    | Q(
                        supervisor_appointment__isnull=True,
                        panel_appointment__isnull=False,
                        co_supervisor_appointment__isnull=True,
                    )
                    | Q(
                        supervisor_appointment__isnull=True,
                        panel_appointment__isnull=True,
                        co_supervisor_appointment__isnull=False,
                    )
                ),
                name="lifecycle_event_has_exactly_one_appointment",
            )
        ]

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValidationError("Appointment lifecycle events are immutable.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Appointment lifecycle events are immutable.")


class AppointmentWorkflowEvent(models.Model):
    """Immutable audit event shared by supervisor and panel workflows."""

    panel_recommendation = models.ForeignKey(
        PanelRecommendation,
        on_delete=models.CASCADE,
        related_name="workflow_events",
        null=True,
        blank=True,
    )
    supervisor_application = models.ForeignKey(
        SupervisorApplication,
        on_delete=models.CASCADE,
        related_name="workflow_events",
        null=True,
        blank=True,
    )
    co_supervisor_nomination = models.ForeignKey(
        CoSupervisorNomination,
        on_delete=models.PROTECT,
        related_name="workflow_events",
        null=True,
        blank=True,
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="appointment_workflow_events",
    )
    actor_role = models.CharField(max_length=64)
    action = models.CharField(max_length=64)
    previous_status = models.CharField(max_length=64, blank=True)
    new_status = models.CharField(max_length=64)
    reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(
                        panel_recommendation__isnull=False,
                        supervisor_application__isnull=True,
                        co_supervisor_nomination__isnull=True,
                    )
                    | Q(
                        panel_recommendation__isnull=True,
                        supervisor_application__isnull=False,
                        co_supervisor_nomination__isnull=True,
                    )
                    | Q(
                        panel_recommendation__isnull=True,
                        supervisor_application__isnull=True,
                        co_supervisor_nomination__isnull=False,
                    )
                ),
                name="workflow_event_has_exactly_one_record",
            )
        ]

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValidationError("Appointment workflow events are immutable.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Appointment workflow events are immutable.")


class AmendmentHistoryQuerySet(models.QuerySet):
    def update(self, **kwargs):
        raise ValidationError("Amendment history is immutable; use audited services.")

    def delete(self):
        raise ValidationError("Amendment history cannot be deleted.")

    def bulk_create(self, objs, **kwargs):
        if kwargs.get("update_conflicts"):
            raise ValidationError("Amendment history cannot be overwritten.")
        return super().bulk_create(objs, **kwargs)


class ImmutableAmendmentRecord(models.Model):
    objects = AmendmentHistoryQuerySet.as_manager()

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if not self._state.adding or (self.pk and type(self).objects.filter(pk=self.pk).exists()):
            raise ValidationError("Amendment history is immutable; use audited services.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Amendment history cannot be deleted.")


class CapacityReassessmentEvent(ImmutableAmendmentRecord):
    """Append-only grant, replacement, revocation and policy consumption ledger."""
    supervisor_application = models.ForeignKey(SupervisorApplication, null=True, blank=True, on_delete=models.PROTECT, related_name="capacity_reassessments")
    co_supervisor_nomination = models.ForeignKey(CoSupervisorNomination, null=True, blank=True, on_delete=models.PROTECT, related_name="capacity_reassessments")
    panel_recommendation = models.ForeignKey(PanelRecommendation, null=True, blank=True, on_delete=models.PROTECT, related_name="capacity_reassessments")
    authorization = models.ForeignKey("self", null=True, blank=True, on_delete=models.PROTECT, related_name="authorization_events")
    target_semester = models.ForeignKey("academics.AcademicSemester", on_delete=models.PROTECT)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    actor_role = models.CharField(max_length=64)
    actor_name = models.CharField(max_length=255)
    action = models.CharField(max_length=16, choices=[(v, v) for v in ("GRANTED", "REPLACED", "REVOKED", "CONSUMED")])
    reason = models.TextField(blank=True)
    request_status = models.CharField(max_length=40)
    policy = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "pk"]
        constraints = [models.CheckConstraint(condition=(
            Q(supervisor_application__isnull=False, co_supervisor_nomination__isnull=True, panel_recommendation__isnull=True)
            | Q(supervisor_application__isnull=True, co_supervisor_nomination__isnull=False, panel_recommendation__isnull=True)
            | Q(supervisor_application__isnull=True, co_supervisor_nomination__isnull=True, panel_recommendation__isnull=False)
        ), name="capacity_reassessment_one_request")]


class ResearchAmendment(ImmutableAmendmentRecord):
    class Kind(models.TextChoices):
        RESEARCH = "RESEARCH", "Research amendment"
        TRANSFER = "TRANSFER", "Programme transfer"

    class Status(models.TextChoices):
        PENDING_SUPERVISOR = "PENDING_SUPERVISOR", "Awaiting primary supervisor"
        PENDING_COORDINATOR = "PENDING_COORDINATOR", "Awaiting programme coordinator"
        PENDING_SOURCE_COORDINATOR = "PENDING_SOURCE_COORDINATOR", "Awaiting source coordinator"
        PENDING_DESTINATION_COORDINATOR = "PENDING_DESTINATION_COORDINATOR", "Awaiting destination coordinator"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        CANCELLED = "CANCELLED", "Cancelled"

    PENDING_STATUSES = (Status.PENDING_SUPERVISOR, Status.PENDING_COORDINATOR,
                        Status.PENDING_SOURCE_COORDINATOR, Status.PENDING_DESTINATION_COORDINATOR)
    student = models.ForeignKey("accounts.Student", on_delete=models.PROTECT, related_name="research_amendments")
    profile = models.ForeignKey(StudentResearchProfile, on_delete=models.PROTECT, related_name="amendments")
    initiated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="initiated_research_amendments")
    kind = models.CharField(max_length=16, choices=Kind.choices)
    status = models.CharField(max_length=40, choices=Status.choices, db_index=True)
    source_programme = models.CharField(max_length=255)
    destination_programme = models.CharField(max_length=255, blank=True)
    before_values = models.JSONField()
    after_values = models.JSONField()
    baseline_revision = models.PositiveIntegerField()
    team_snapshot = models.JSONField(default=dict)
    semester_snapshot = models.JSONField(default=dict)
    academic_semester = models.ForeignKey("academics.AcademicSemester", on_delete=models.PROTECT, null=True, blank=True)
    reason = models.TextField()
    student_name = models.CharField(max_length=255)
    matric_no = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-pk"]
        constraints = [models.UniqueConstraint(fields=["student"], condition=Q(status__in=["PENDING_SUPERVISOR", "PENDING_COORDINATOR", "PENDING_SOURCE_COORDINATOR", "PENDING_DESTINATION_COORDINATOR"]), name="one_pending_research_amendment_per_student")]


class ResearchAmendmentEvent(ImmutableAmendmentRecord):
    request = models.ForeignKey(ResearchAmendment, on_delete=models.PROTECT, related_name="events")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    actor_role = models.CharField(max_length=64)
    actor_name = models.CharField(max_length=255)
    action = models.CharField(max_length=32)
    previous_status = models.CharField(max_length=40, blank=True)
    new_status = models.CharField(max_length=40)
    reason = models.TextField(blank=True)
    retain_team = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "pk"]


class ResearchProfileRevision(ImmutableAmendmentRecord):
    profile = models.ForeignKey(StudentResearchProfile, on_delete=models.PROTECT, related_name="revisions")
    revision = models.PositiveIntegerField()
    kind = models.CharField(max_length=16)
    request = models.OneToOneField(ResearchAmendment, on_delete=models.PROTECT, null=True, blank=True, related_name="applied_revision")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True)
    before_values = models.JSONField(default=dict)
    after_values = models.JSONField(default=dict)
    reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["profile_id", "revision"]
        constraints = [models.UniqueConstraint(fields=["profile", "revision"], name="unique_research_profile_revision")]


def count_supervisor_workload(supervisor):
    return (
        SupervisorAppointment.objects.filter(
            supervisor=supervisor,
            status=SupervisorAppointment.Status.ACTIVE,
        ).count()
        + CoSupervisorAppointment.objects.filter(
            supervisor=supervisor, status=CoSupervisorAppointment.Status.ACTIVE
        ).count()
    )


def _capacity_user(subject):
    if hasattr(subject, "is_active") and hasattr(subject, "role"):
        return subject
    lecturer = getattr(subject, "lecturer", None)
    if lecturer is not None:
        return lecturer.user
    return getattr(subject, "user", subject)


def supervisor_workload_limit(supervisor, semester=None):
    if semester is not None:
        from academics.capacity import (
            CapacityRole,
            CapacityState,
            resolve_lecturer_capacity,
        )

        result = resolve_lecturer_capacity(
            user=_capacity_user(supervisor),
            semester=semester,
            role=CapacityRole.SUPERVISOR,
        )
        if result.state in {
            CapacityState.NOT_CONFIGURED,
            CapacityState.INELIGIBLE,
        }:
            return 0
        return result.limit

    try:
        return supervisor.lecturer.supervisor.max_supervisees
    except (AttributeError, models.ObjectDoesNotExist):
        return 5


def count_panel_workload(panel_member):
    """Count confirmed panel seats plus submitted nominations reserving capacity."""

    active_appointments = PanelAppointment.objects.filter(
        panel_member=panel_member,
        status=PanelAppointment.Status.ACTIVE,
    ).count()
    pending_nominations = PanelRecommendation.objects.filter(
        recommended_member=panel_member,
        status__in=PanelRecommendation.WORKLOAD_RESERVED_STATUSES,
    ).count()
    return active_appointments + pending_nominations


def panel_workload_limit(panel_member, semester=None):
    """Return the configured limit for a panel lecturer, with a safe default."""

    if semester is not None:
        from academics.capacity import (
            CapacityRole,
            CapacityState,
            resolve_lecturer_capacity,
        )

        result = resolve_lecturer_capacity(
            user=_capacity_user(panel_member),
            semester=semester,
            role=CapacityRole.PANEL,
        )
        if result.state in {
            CapacityState.NOT_CONFIGURED,
            CapacityState.INELIGIBLE,
        }:
            return 0
        return result.limit

    try:
        return panel_member.lecturer.panel.max_appointments
    except (AttributeError, models.ObjectDoesNotExist):
        return PANEL_WORKLOAD_LIMIT
