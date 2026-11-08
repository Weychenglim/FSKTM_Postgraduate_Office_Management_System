from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.core.exceptions import ObjectDoesNotExist, ValidationError
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone


class UserManager(BaseUserManager):
    """Creates users with a hashed password, using email as the unique key."""

    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("An email address is required.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", User.TECHNICAL_ADMIN)
        extra_fields.setdefault("full_name", "Administrator")
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        if extra_fields.get("role") != User.TECHNICAL_ADMIN:
            raise ValueError("Superuser must have the Technical Administrator role.")
        return self._create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Login account (the superclass). Role-specific data lives in the profile
    tables below, linked one-to-one on this row's primary key."""

    class Role(models.TextChoices):
        OFFICE_ADMIN = "Office Staff/Admin", "Office Staff/Admin"
        COORDINATOR = "Programme Coordinator", "Programme Coordinator"
        LECTURER = "Lecturer", "Lecturer"
        STUDENT = "Student", "Student"

    # Maintenance-only account for the Django admin site. It is kept out of
    # ``Role`` because it is never a portal role.
    TECHNICAL_ADMIN = "Technical Administrator"

    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255)
    role = models.CharField(
        max_length=64,
        choices=[*Role.choices, (TECHNICAL_ADMIN, TECHNICAL_ADMIN)],
        default=Role.STUDENT,
    )
    phone = models.CharField(max_length=32, blank=True, default="")
    announcement_alerts = models.BooleanField(default=True)
    # Settings switches for notification email, deadline reminders and the
    # weekly summary email (announcements/emails.py applies them).
    email_notifications = models.BooleanField(default=True)
    deadline_reminders = models.BooleanField(default=True)
    weekly_summary = models.BooleanField(default=False)
    # Set True when an account is created with a temporary password (FR-04); the
    # login flow can then force a password change on first sign-in.
    must_change_password = models.BooleanField(default=False)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(
        default=False,
        help_text="Designates whether the user can log into the Django admin site.",
    )
    date_joined = models.DateTimeField(default=timezone.now)
    # Portal (JWT) sign-ins. Kept apart from ``last_login`` because Django's
    # reset tokens hash ``last_login``; updating it on every sign-in would
    # silently void reset links issued earlier.
    last_portal_login = models.DateTimeField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]

    class Meta:
        ordering = ["full_name"]
        constraints = [
            models.UniqueConstraint(
                Lower("email"),
                name="unique_user_email_ci",
                violation_error_message="An account with this email already exists.",
            )
        ]

    def __str__(self):
        return f"{self.full_name} <{self.email}> ({self.role})"

    @property
    def is_technical_admin(self):
        return self.role == self.TECHNICAL_ADMIN

    def _related_or_none(self, attr):
        """Return the linked profile row for ``attr`` (e.g. 'student'), or None
        if this user has no such profile."""
        try:
            return getattr(self, attr)
        except ObjectDoesNotExist:
            return None

    def to_public_dict(self):
        """Flatten this user + its role profile into the shape the React
        frontend's ``DemoUser`` expects."""
        student = self._related_or_none("student")
        office_staff = self._related_or_none("office_staff")
        lecturer = self._related_or_none("lecturer")

        if student:
            department, student_no, staff_no = student.programme, student.matric_no, None
        elif office_staff:
            department, student_no, staff_no = office_staff.department, None, office_staff.staff_no
        elif lecturer:
            department, student_no, staff_no = lecturer.department, None, lecturer.staff_no
        else:
            department, student_no, staff_no = "", None, None

        delegation_details = {}
        if self.role == self.Role.COORDINATOR:
            from .authorization import coordinator_programmes
            from .delegations import serialize_delegation
            delegation_details = {
                "effectiveProgrammes": coordinator_programmes(self),
                "coordinatorDelegations": [serialize_delegation(row, self) for row in self.coordinator_delegations.select_related("coordinator", "granted_by", "revoked_by")],
            }
        return {
            **delegation_details,
            "id": str(self.pk),
            "email": self.email,
            "role": self.role,
            "fullName": self.full_name,
            "phone": self.phone,
            "department": department,
            "studentId": student_no,
            "staffId": staff_no,
            "participantLifecycleStatus": (
                student.status.upper()
                if student
                else lecturer.lifecycle_status if lecturer else None
            ),
            "accountAccess": (
                "DISABLED"
                if not self.is_active
                else "READ_ONLY"
                if student and student.status != Student.Status.ACTIVE
                else "ACTIVE"
            ),
            "mustChangePassword": self.must_change_password,
        }


def reject_technical_profile(profile):
    """A Technical Administrator account never holds a portal profile."""
    try:
        user = profile.user
    except ObjectDoesNotExist:
        return
    if user is not None and user.role == User.TECHNICAL_ADMIN:
        raise ValidationError(
            "A Technical Administrator account cannot have a portal profile."
        )


# Top-level subtypes (User → Student / OfficeStaff / Lecturer)


class Student(models.Model):
    """Postgraduate student profile (FR-11)."""

    class Status(models.TextChoices):
        ACTIVE = "Active", "Active"
        GRADUATED = "Graduated", "Graduated"
        DEFERRED = "Deferred", "Deferred"
        WITHDRAWN = "Withdrawn", "Withdrawn"

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, primary_key=True, related_name="student"
    )
    matric_no = models.CharField(max_length=64, unique=True)
    programme = models.CharField(max_length=255, blank=True, default="")
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.ACTIVE
    )
    intake_semester = models.CharField(max_length=32, blank=True, default="")
    status_changed_at = models.DateTimeField(null=True, blank=True)
    status_changed_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="student_status_changes",
        null=True,
        blank=True,
    )
    status_reason = models.TextField(blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                Lower("matric_no"),
                name="unique_student_matric_ci",
                violation_error_message="This matric number is already registered.",
            )
        ]

    def __str__(self):
        return f"{self.matric_no} ({self.user.full_name})"

    def clean(self):
        super().clean()
        reject_technical_profile(self)


class StudentRegistry(models.Model):
    """Extended registry details for a Student: the data an official letter
    (e.g. the visa / confirmation-of-study letter) needs that the base Student
    profile does not hold (passport, nationality, programme mode, semesters…).

    One-to-one *specialization* of Student: it shares the student's primary key
    (``student_id`` PK = FK), exactly like Coordinator/Supervisor/Panel
    specialize Lecturer. So every registry row belongs to exactly one student and
    is reachable as ``student.registry``. Letters read their placeholder values
    from here (see the frontend ``letterDocument.ts`` placeholder set)."""

    class ProgrammeMode(models.TextChoices):
        COURSEWORK = "Coursework", "Coursework"
        RESEARCH = "Research", "Research"
        MIXED = "Mixed Mode", "Mixed Mode"

    class StudyMode(models.TextChoices):
        FULL_TIME = "Full Time", "Full Time"
        PART_TIME = "Part Time", "Part Time"

    student = models.OneToOneField(
        Student, on_delete=models.CASCADE, primary_key=True, related_name="registry"
    )
    # Identity: a local student has an IC; an international student a passport.
    ic_number = models.CharField(max_length=32, blank=True, default="")
    passport_number = models.CharField(max_length=32, blank=True, default="")
    nationality = models.CharField(max_length=64, blank=True, default="")  # {{COUNTRY}}
    address = models.TextField(blank=True, default="")
    # Programme-of-study details printed on the confirmation / visa letter.
    programme_mode = models.CharField(
        max_length=32, choices=ProgrammeMode.choices, blank=True, default=""
    )  # {{PROGRAMME_MODE}}
    field_of_study = models.CharField(max_length=255, blank=True, default="")  # {{FIELD_OF_RESEARCH}}
    mode_of_study = models.CharField(
        max_length=32, choices=StudyMode.choices, blank=True, default=""
    )  # {{MODE_OF_STUDY}}
    current_semester = models.CharField(max_length=64, blank=True, default="")  # {{CURRENT_SEMESTER}}
    max_semester = models.CharField(max_length=64, blank=True, default="")  # {{MAX_SEMESTER}}
    expected_completion = models.CharField(max_length=64, blank=True, default="")  # {{EXPECTED_COMPLETION}}
    sponsor = models.CharField(max_length=255, blank=True, default="")
    # Semesters added past the maximum on appeal to the Dean, three at most (Regulation 55).
    extension_semesters = models.PositiveSmallIntegerField(default=0)
    extension_reason = models.CharField(max_length=255, blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Student registry detail"
        verbose_name_plural = "Student registry details"

    def __str__(self):
        return f"Registry: {self.student.matric_no}"

    def to_letter_dict(self):
        """The letter-placeholder values for this student (camelCase to match the
        frontend). ``initialSemester`` reuses the base Student's intake to avoid a
        second source of truth; a passport falls back to the IC for local students."""
        return {
            "passportNumber": self.passport_number or self.ic_number,
            "country": self.nationality,
            "programmeMode": self.programme_mode,
            "fieldOfResearch": self.field_of_study,
            "modeOfStudy": self.mode_of_study,
            "initialSemester": self.student.intake_semester,
            "currentSemester": self.current_semester,
            "maxSemester": self.max_semester,
            "expectedCompletion": self.expected_completion,
        }


class OfficeStaff(models.Model):
    """Postgraduate office staff / admin profile."""

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, primary_key=True, related_name="office_staff"
    )
    staff_no = models.CharField(max_length=64, unique=True)
    department = models.CharField(max_length=255, blank=True, default="")
    position = models.CharField(max_length=128, blank=True, default="")

    class Meta:
        verbose_name = "Office staff"
        verbose_name_plural = "Office staff"

    def __str__(self):
        return f"{self.staff_no} ({self.user.full_name})"

    def clean(self):
        super().clean()
        reject_technical_profile(self)


class Lecturer(models.Model):
    """Academic staff profile. A lecturer may additionally act as a Coordinator,
    Supervisor, and/or Panel member (overlapping specializations below)."""

    class Lifecycle(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        RETIRING = "RETIRING", "Retiring"
        RETIRED = "RETIRED", "Retired"
        RESIGNED = "RESIGNED", "Resigned"

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, primary_key=True, related_name="lecturer"
    )
    staff_no = models.CharField(max_length=64, unique=True)
    department = models.CharField(max_length=255, blank=True, default="")
    title = models.CharField(max_length=64, blank=True, default="")
    specialization = models.CharField(max_length=255, blank=True, default="")
    lifecycle_status = models.CharField(
        max_length=16,
        choices=Lifecycle.choices,
        default=Lifecycle.ACTIVE,
        db_index=True,
    )
    lifecycle_changed_at = models.DateTimeField(null=True, blank=True)
    lifecycle_changed_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="lecturer_lifecycle_changes",
        null=True,
        blank=True,
    )
    lifecycle_reason = models.TextField(blank=True)

    def __str__(self):
        return f"{self.staff_no} ({self.user.full_name})"

    def clean(self):
        super().clean()
        reject_technical_profile(self)


# Lecturer specializations (Lecturer → Coordinator / Supervisor / Panel)


class ParticipantLifecycleAudit(models.Model):
    """Append-only audit for authoritative Student/Lecturer lifecycle changes."""

    student = models.ForeignKey(
        Student,
        on_delete=models.PROTECT,
        related_name="lifecycle_audits",
        null=True,
        blank=True,
    )
    lecturer = models.ForeignKey(
        Lecturer,
        on_delete=models.PROTECT,
        related_name="lifecycle_audits",
        null=True,
        blank=True,
    )
    actor = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="participant_lifecycle_audits",
    )
    previous_status = models.CharField(max_length=32)
    new_status = models.CharField(max_length=32)
    reason = models.TextField()
    affected_records = models.JSONField(default=dict)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(student__isnull=False, lecturer__isnull=True)
                    | models.Q(student__isnull=True, lecturer__isnull=False)
                ),
                name="participant_audit_exactly_one_subject",
            )
        ]

    def save(self, *args, **kwargs):
        if self.pk:
            from django.core.exceptions import ValidationError

            raise ValidationError("Participant lifecycle audits are immutable.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        from django.core.exceptions import ValidationError

        raise ValidationError("Participant lifecycle audits are immutable.")


class Coordinator(models.Model):
    """Programme Coordinator role of a lecturer (panel approval authority,
    UC31)."""

    lecturer = models.OneToOneField(
        Lecturer, on_delete=models.CASCADE, primary_key=True, related_name="coordinator"
    )
    programme_managed = models.CharField(max_length=255, blank=True, default="")
    appointed_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"Coordinator: {self.lecturer.user.full_name}"


class Supervisor(models.Model):
    """Supervisor role of a lecturer. ``max_supervisees`` caps how many students
    this lecturer may supervise (FR-22 workload validation)."""

    lecturer = models.OneToOneField(
        Lecturer, on_delete=models.CASCADE, primary_key=True, related_name="supervisor"
    )
    max_supervisees = models.PositiveIntegerField(default=5)

    def __str__(self):
        return f"Supervisor: {self.lecturer.user.full_name}"


class Panel(models.Model):
    """Panel-member role of a lecturer. ``max_appointments`` caps panel load
    (relates to FR-29 selection-count tracking)."""

    lecturer = models.OneToOneField(
        Lecturer, on_delete=models.CASCADE, primary_key=True, related_name="panel"
    )
    max_appointments = models.PositiveIntegerField(default=10)

    class Meta:
        verbose_name = "Panel member"

    def __str__(self):
        return f"Panel: {self.lecturer.user.full_name}"


class RegistryImportBatch(models.Model):
    """One committed Student Registry bulk import (UC04)."""

    file_name = models.CharField(max_length=255)
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="registry_imports",
    )
    uploaded_by_name = models.CharField(max_length=255, blank=True, default="")
    total_rows = models.PositiveIntegerField(default=0)
    created_count = models.PositiveIntegerField(default=0)
    skipped_count = models.PositiveIntegerField(default=0)
    failed_count = models.PositiveIntegerField(default=0)
    invitations_failed = models.PositiveIntegerField(default=0)
    problems = models.JSONField(default=list, blank=True)
    # Each student this import created, as {"id": Student ID, "line": file
    # line}, so activation emails held back at import time go to exactly
    # these students later and a failed send can point at its line.
    # "emailFilled" marks an email filled from the Student ID.
    created_students = models.JSONField(default=list, blank=True)
    invitations_held = models.BooleanField(default=False)
    invitations_sent_at = models.DateTimeField(null=True, blank=True)
    # The settings for every row and the email choice used for this import.
    settings_used = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    @staticmethod
    def problem_status(problem):
        """A recorded row's status. Batches from before the status was stored
        are read from the wording of the reason."""
        if problem.get("status"):
            return problem["status"]
        issue = problem.get("issue", "")
        if issue in ("this matric number is already registered", "this email already has an account"):
            return "Already Registered"
        if issue.startswith(("same student_id as line", "same email as line")):
            return "Duplicate In File"
        return ""

    def to_public_dict(self):
        statuses = [self.problem_status(problem) for problem in self.problems or []]
        return {
            "id": self.pk,
            "fileName": self.file_name,
            "uploadedBy": self.uploaded_by_name,
            "totalRows": self.total_rows,
            "created": self.created_count,
            "skipped": self.skipped_count,
            "failed": self.failed_count,
            "alreadyRegistered": statuses.count("Already Registered"),
            "duplicateInFile": statuses.count("Duplicate In File"),
            "programmeSkipped": statuses.count("Programme Skipped"),
            "emailsFilled": sum(1 for entry in self.created_students or [] if entry.get("emailFilled")),
            "invitationsFailed": self.invitations_failed,
            "invitationsHeld": self.invitations_held,
            "invitationsSentAt": self.invitations_sent_at.isoformat() if self.invitations_sent_at else None,
            "settingsUsed": self.settings_used,
            "problems": self.problems,
            "createdAt": self.created_at.isoformat(),
        }

    def __str__(self):
        return f"{self.file_name} ({self.created_count} created)"


class RegistryProgrammeAlias(models.Model):
    """How the office reads a programme name from its own spreadsheets (UC04):
    an approved programme, or blank to skip those rows. Saved on a real import,
    suggested on the next one, and shared by the whole office."""

    # The name without letter case, punctuation or spaces.
    value_key = models.CharField(max_length=255, unique=True)
    programme = models.CharField(max_length=255, blank=True)
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="registry_programme_aliases",
    )
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.value_key}: {self.programme or 'skip'}"


class RegistryImportProfile(models.Model):
    """The column matches the office confirmed for one spreadsheet layout
    (UC04). Saved on a real import, applied to the next file with the same
    column names, and shared by the whole office."""

    # A SHA-256 of the file's normalised column names, in order. The names
    # themselves are not kept: a mistaken header row could hold student data.
    signature = models.CharField(max_length=64, unique=True)
    mapping = models.JSONField(default=dict)
    sheet_name = models.CharField(max_length=255, blank=True)
    header_row = models.PositiveIntegerField(default=1)
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="registry_import_profiles",
    )
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Import layout {self.signature[:12]}"


class CoordinatorDelegationQuerySet(models.QuerySet):
    def bulk_create(self, objs, batch_size=None, ignore_conflicts=False,
                    update_conflicts=False, update_fields=None, unique_fields=None):
        from django.core.exceptions import ValidationError
        if update_conflicts:
            raise ValidationError('Delegation records cannot be overwritten by an upsert.')
        return super().bulk_create(
            objs, batch_size=batch_size, ignore_conflicts=ignore_conflicts,
            update_conflicts=False, update_fields=update_fields,
            unique_fields=unique_fields,
        )

    def update(self, **kwargs):
        from django.core.exceptions import ValidationError
        raise ValidationError('Delegation records are immutable; use the revocation service.')

    def delete(self):
        from django.core.exceptions import ValidationError
        raise ValidationError('Delegation records cannot be deleted.')


class CoordinatorDelegation(models.Model):
    coordinator = models.ForeignKey(User, on_delete=models.PROTECT, related_name='coordinator_delegations')
    programme = models.CharField(max_length=255)
    starts_on = models.DateField()
    ends_on = models.DateField()
    justification = models.TextField()
    granted_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name='granted_coordinator_delegations')
    created_at = models.DateTimeField(default=timezone.now)
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoked_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name='revoked_coordinator_delegations', null=True, blank=True)
    revocation_reason = models.TextField(blank=True)
    objects = CoordinatorDelegationQuerySet.as_manager()

    class Meta:
        ordering = ['-created_at', '-id']
        constraints = [
            models.CheckConstraint(condition=models.Q(ends_on__gte=models.F('starts_on')), name='delegation_valid_dates'),
            models.CheckConstraint(condition=(models.Q(revoked_at__isnull=True, revoked_by__isnull=True, revocation_reason='') | (models.Q(revoked_at__isnull=False, revoked_by__isnull=False) & ~models.Q(revocation_reason=''))), name='delegation_revocation_complete'),
        ]

    def save(self, *args, **kwargs):
        from django.core.exceptions import ValidationError
        if not self._state.adding or (self.pk and type(self).objects.filter(pk=self.pk).exists()):
            raise ValidationError('Delegation records are immutable; use the revocation service.')
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        from django.core.exceptions import ValidationError
        raise ValidationError('Delegation records cannot be deleted.')


class AccountChangeQuerySet(models.QuerySet):
    def update(self, **kwargs):
        raise ValidationError("Account history cannot be changed.")

    def delete(self):
        raise ValidationError("Account history cannot be deleted.")


class AccountChange(models.Model):
    """One change to an office staff, lecturer or coordinator account (UC03).

    Rows are never edited or deleted. Each keeps the account's name and email
    as text, so the history still reads after the account itself is deleted.
    """

    class Action(models.TextChoices):
        CREATED = "CREATED", "Account created"
        DETAILS_EDITED = "DETAILS_EDITED", "Details edited"
        EMAIL_CHANGED = "EMAIL_CHANGED", "Email changed"
        DUTIES_CHANGED = "DUTIES_CHANGED", "Duties changed"
        PROGRAMME_CHANGED = "PROGRAMME_CHANGED", "Programme changed"
        SIGN_IN_OFF = "SIGN_IN_OFF", "Sign-in turned off"
        SIGN_IN_ON = "SIGN_IN_ON", "Sign-in turned back on"
        LINK_SENT = "LINK_SENT", "Link sent"
        LINK_COPIED = "LINK_COPIED", "Activation link copied"
        DELETED = "DELETED", "Account deleted"

    account = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="account_changes",
    )
    account_name = models.CharField(max_length=255)
    account_email = models.CharField(max_length=254)
    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="account_changes_made",
    )
    actor_name = models.CharField(max_length=255, blank=True)
    action = models.CharField(max_length=32, choices=Action.choices)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    objects = AccountChangeQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.get_action_display()}: {self.account_name}"

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValidationError("Account history cannot be changed.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Account history cannot be deleted.")


class ProgrammeRule(models.Model):
    """How long a programme takes, in semesters. Filled in from the faculty's
    handbook; the office can change it. A rule with no starting intake covers every
    intake until a later rule for the same programme takes over."""

    programme = models.CharField(max_length=255)
    from_session = models.CharField(max_length=9, blank=True, default="")
    from_term = models.CharField(max_length=16, blank=True, default="")
    min_semesters = models.PositiveSmallIntegerField()
    # UM counts a Special Semester when the programme's offer states it (Regulation 20(2)).
    special_counts = models.BooleanField(default=True)
    max_semesters = models.PositiveSmallIntegerField()
    source = models.CharField(max_length=255, blank=True)
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="programme_rules_changed",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["programme", "from_session", "from_term"]
        constraints = [
            models.UniqueConstraint(
                fields=["programme", "from_session", "from_term"],
                name="accounts_programme_rule_one_per_intake",
            ),
        ]

    def __str__(self):
        return f"{self.programme}: {self.min_semesters} to {self.max_semesters} semesters"


class ProgrammeRuleChange(models.Model):
    """One edit of a programme rule, kept because it changes who can graduate."""

    rule = models.ForeignKey(ProgrammeRule, on_delete=models.SET_NULL, null=True, blank=True, related_name="changes")
    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="programme_rule_changes",
    )
    actor_name = models.CharField(max_length=255, blank=True)
    before_values = models.JSONField(default=dict)
    after_values = models.JSONField(default=dict)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at", "-id"]


class StudentSemester(models.Model):
    """One semester of one student's studies. Moving a student forward adds a row,
    so running it twice cannot count a semester twice."""

    class Term(models.TextChoices):
        SEMESTER_I = "SEMESTER_I", "Semester I"
        SEMESTER_II = "SEMESTER_II", "Semester II"
        SPECIAL = "SPECIAL", "Special Semester"

    class Outcome(models.TextChoices):
        STUDIED = "STUDIED", "Studied"
        LEAVE = "LEAVE", "On leave"
        # Medical and mobility leave do not use up the maximum (Regulation 8(11)).
        LEAVE_EXEMPT = "LEAVE_EXEMPT", "On medical or mobility leave"

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="semesters")
    session = models.CharField(max_length=9)
    term = models.CharField(max_length=16, choices=Term.choices)
    outcome = models.CharField(max_length=16, choices=Outcome.choices, default=Outcome.STUDIED)
    note = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="student_semesters_added",
    )
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # Terms sort as they run through a session.
        ordering = ["session", "term"]
        constraints = [
            models.UniqueConstraint(
                fields=["student", "session", "term"], name="unique_student_semester"
            )
        ]

    def __str__(self):
        return f"{self.student_id}: {self.session} {self.term}"


class StudentSemesterMove(models.Model):
    """The office moved students into a semester. Once done, the Students tab stops
    asking, even if some students were left out on purpose."""

    session = models.CharField(max_length=9)
    term = models.CharField(max_length=16, choices=StudentSemester.Term.choices)
    moved_count = models.PositiveIntegerField(default=0)
    left_out_count = models.PositiveIntegerField(default=0)
    moved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="student_semester_moves",
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at", "-id"]
