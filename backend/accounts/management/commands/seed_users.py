"""Seed development-only demo accounts and their role profiles.

The command is idempotent, but it refuses to run unless Django debug mode and
the explicit demo-account flag are both enabled. Passwords come only from the
ignored local environment.
"""

import json
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import Permission
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounts.models import (
    Coordinator,
    Lecturer,
    OfficeStaff,
    Panel,
    Student,
    StudentRegistry,
    Supervisor,
    User,
)
from accounts.semester_rules import seed_student
from appointments.models import (
    StudentResearchProfile,
    SupervisorApplication,
    SupervisorAppointment,
    SupervisorDocumentRequirement,
)
from appointments.supervisor_documents import create_requirement
from academics.capacity_services import (
    capacity_eligible_lecturers,
    capacity_plan_content_fingerprint,
    create_capacity_plan,
    publish_capacity_plan,
    update_capacity_entry,
)
from academics.models import AcademicSemester, SemesterCapacityPlan
from academics.services import activate_semester, create_semester

DEMO_USERS = [
    {
        "email": "demo.office.admin@example.test",
        "full_name": "Demo Office Administrator",
        "role": User.Role.OFFICE_ADMIN,
        "office_staff": {
            "staff_no": "DEMO-ADMIN-001",
            "department": "Demo Postgraduate Office",
            "position": "Demo Administrative Officer",
        },
    },
    {
        "email": "demo.coordinator@example.test",
        "full_name": "Demo Programme Coordinator",
        "role": User.Role.COORDINATOR,
        "lecturer": {
            "staff_no": "DEMO-COORD-001",
            "department": "Demo Programme Coordination",
            "title": "Demo Dr.",
            "specialization": "Demo Software Engineering",
        },
        "coordinator": {
            "programme_managed": "MASTER OF CYBER SECURITY (COURSEWORK)",
        },
    },
    {
        "email": "demo.supervisor@example.test",
        "full_name": "Demo Lecturer Supervisor",
        "role": User.Role.LECTURER,
        "lecturer": {
            "staff_no": "DEMO-LECT-001",
            "department": "Demo Artificial Intelligence Department",
            "title": "Demo Prof.",
            "specialization": "Demo Artificial Intelligence",
        },
        "supervisor": {
            "max_supervisees": 5,
        },
        "panel": {
            "max_appointments": 10,
        },
    },
    {
        "email": "demo.panel@example.test",
        "full_name": "Demo Panel Lecturer",
        "role": User.Role.LECTURER,
        "lecturer": {
            "staff_no": "DEMO-PANEL-001",
            "department": "Demo Data Science Department",
            "title": "Demo Assoc. Prof.",
            "specialization": "Demo Data Science",
        },
        "panel": {
            "max_appointments": 10,
        },
    },
    {
        "email": "demo.student@example.test",
        "full_name": "Demo Student One",
        "role": User.Role.STUDENT,
        "student": {
            "matric_no": "DEMO-STUDENT-001",
            "programme": "MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)",
            "status": Student.Status.ACTIVE,
            "intake_semester": "2024/2025 Semester 1",
        },
    },
    {
        "email": "demo.letter.student@example.test",
        "full_name": "Demo Letter Student",
        "role": User.Role.STUDENT,
        "student": {
            "matric_no": "DEMO-STUDENT-002",
            "programme": "Master of Computer Science (By Coursework)",
            "status": Student.Status.ACTIVE,
            "intake_semester": "2024/2025 Semester 1",
        },
        "student_registry": {
            "ic_number": "",
            "passport_number": "DEMO-PASSPORT-NOT-VALID",
            "nationality": "Fictional Demo Nationality",
            "address": "Demo Address Only, Not a Deliverable Location",
            "programme_mode": StudentRegistry.ProgrammeMode.COURSEWORK,
            "field_of_study": "Demo Computer Science",
            "mode_of_study": StudentRegistry.StudyMode.FULL_TIME,
            "current_semester": "Semester II, 2025/2026 Session",
            "max_semester": "Semester I, 2027/2028 Session",
            "expected_completion": "Semester I, 2027/2028 Session",
            "sponsor": "Demo Sponsor",
        },
    },
    {
        "email": "demo.panel.student.one@example.test",
        "full_name": "Demo Panel Student One",
        "role": User.Role.STUDENT,
        "student": {
            "matric_no": "DEMO-STUDENT-003",
            "programme": "MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)",
            "status": Student.Status.ACTIVE,
            "intake_semester": "2025/2026 Semester 1",
        },
    },
    {
        "email": "demo.panel.student.two@example.test",
        "full_name": "Demo Panel Student Two",
        "role": User.Role.STUDENT,
        "student": {
            "matric_no": "DEMO-STUDENT-004",
            "programme": "MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)",
            "status": Student.Status.ACTIVE,
            "intake_semester": "2025/2026 Semester 1",
        },
    },
]


PANEL_RESEARCH_PROFILES = [
    {
        "matric_no": "DEMO-STUDENT-003",
        "student_email": "demo.panel.student.one@example.test",
        "student_name": "Demo Panel Student One",
        "programme": "MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)",
        "semester": "Sem 1 2025/2026",
        "proposed_topic": "Demo Study of Generative Models for Low-Resource Languages",
        "research_area": "Artificial Intelligence",
        "abstract": (
            "This fictional demonstration profile explores model architecture "
            "trade-offs using synthetic, non-personal research data."
        ),
        "supervisor_email": "demo.supervisor@example.test",
    },
    {
        "matric_no": "DEMO-STUDENT-004",
        "student_email": "demo.panel.student.two@example.test",
        "student_name": "Demo Panel Student Two",
        "programme": "MASTER OF ARTIFICIAL INTELLIGENCE (COURSEWORK)",
        "semester": "Sem 1 2025/2026",
        "proposed_topic": "Demo Study of Explainable Academic Prediction",
        "research_area": "Artificial Intelligence",
        "abstract": (
            "This fictional demonstration profile evaluates explainability methods "
            "with synthetic academic records and no real student information."
        ),
        "supervisor_email": "demo.supervisor@example.test",
    },
]


def _publish_demo_capacity_plan(semester, actor):
    existing_plans = SemesterCapacityPlan.objects.filter(academic_semester=semester)
    published = existing_plans.filter(
        lifecycle_status=SemesterCapacityPlan.Lifecycle.PUBLISHED
    ).first()
    if published is not None:
        return published
    if existing_plans.exists():
        raise CommandError(
            "Demo seeding will not replace or supersede an existing capacity plan."
        )

    plan = create_capacity_plan(semester=semester, actor=actor)
    for lecturer in capacity_eligible_lecturers():
        update_capacity_entry(
            plan,
            lecturer=lecturer,
            actor=actor,
            supervisor_limit=(
                lecturer.supervisor.max_supervisees
                if hasattr(lecturer, "supervisor")
                else None
            ),
            panel_limit=(
                lecturer.panel.max_appointments if hasattr(lecturer, "panel") else None
            ),
            expected_fingerprint=capacity_plan_content_fingerprint(plan),
        )
    return publish_capacity_plan(
        plan,
        actor=actor,
        reason="Publish guarded fictional development capacity policy.",
        expected_fingerprint=capacity_plan_content_fingerprint(plan),
    )


class Command(BaseCommand):
    help = "Seed/refresh development-only demo accounts and role profiles."

    password_settings = {
        User.Role.OFFICE_ADMIN: "DEMO_ADMIN_PASSWORD",
        User.Role.COORDINATOR: "DEMO_COORDINATOR_PASSWORD",
        User.Role.LECTURER: "DEMO_LECTURER_PASSWORD",
        User.Role.STUDENT: "DEMO_STUDENT_PASSWORD",
    }

    @classmethod
    def _validated_configuration(cls):
        if not settings.DEBUG:
            raise CommandError("seed_users requires DEBUG=True.")
        if not settings.ENABLE_DEMO_ACCOUNTS:
            raise CommandError("seed_users requires ENABLE_DEMO_ACCOUNTS=true.")

        passwords = {}
        for role, setting_name in cls.password_settings.items():
            password = getattr(settings, setting_name, "")
            if not password or not password.strip():
                raise CommandError(f"seed_users requires non-blank {setting_name}.")
            passwords[role] = password

        raw_mapping = settings.DEMO_LEGACY_EMAIL_MAP.strip()
        if not raw_mapping:
            return passwords, {}

        try:
            legacy_email_map = json.loads(raw_mapping)
        except json.JSONDecodeError as exc:
            raise CommandError(
                "DEMO_LEGACY_EMAIL_MAP must be a JSON object of old-to-new emails."
            ) from exc

        if not isinstance(legacy_email_map, dict) or any(
            not isinstance(old_email, str)
            or not isinstance(new_email, str)
            or not old_email.strip()
            or not new_email.strip()
            for old_email, new_email in legacy_email_map.items()
        ):
            raise CommandError(
                "DEMO_LEGACY_EMAIL_MAP must be a JSON object with non-blank "
                "string keys and values."
            )

        canonical_emails = {entry["email"] for entry in DEMO_USERS}
        destinations = [email.strip() for email in legacy_email_map.values()]
        if any(email not in canonical_emails for email in destinations):
            raise CommandError(
                "Each DEMO_LEGACY_EMAIL_MAP destination must be a canonical demo email."
            )
        if len(destinations) != len(set(destinations)):
            raise CommandError(
                "DEMO_LEGACY_EMAIL_MAP cannot map multiple users to one demo email."
            )

        return passwords, {
            old_email.strip(): new_email.strip()
            for old_email, new_email in legacy_email_map.items()
        }

    @staticmethod
    def _profile_conflict(entry):
        email = entry["email"]
        if "student" in entry:
            return (
                User.objects.filter(student__matric_no=entry["student"]["matric_no"])
                .exclude(email=email)
                .first()
            )
        if "office_staff" in entry:
            return (
                User.objects.filter(
                    office_staff__staff_no=entry["office_staff"]["staff_no"]
                )
                .exclude(email=email)
                .first()
            )
        if "lecturer" in entry:
            return (
                User.objects.filter(lecturer__staff_no=entry["lecturer"]["staff_no"])
                .exclude(email=email)
                .first()
            )
        return None

    def _adopt_profile_conflict(self, entry):
        conflicting_user = self._profile_conflict(entry)
        if conflicting_user is None:
            return

        email = entry["email"]
        target_user = User.objects.filter(email=email).first()
        if target_user is not None and target_user.pk != conflicting_user.pk:
            raise CommandError(
                f"Cannot seed {email}: its profile number belongs to "
                f"{conflicting_user.email}, and both accounts exist."
            )

        old_email = conflicting_user.email
        conflicting_user.email = email
        conflicting_user.save(update_fields=["email"])
        self.stdout.write(
            self.style.SUCCESS(f"  Migrated account email {old_email} -> {email}")
        )

    def _migrate_legacy_emails(self, legacy_email_map):
        for old_email, new_email in legacy_email_map.items():
            old_user = User.objects.filter(email=old_email).first()
            new_user = User.objects.filter(email=new_email).first()

            if old_user is None:
                continue
            if new_user is not None and new_user.pk != old_user.pk:
                raise CommandError(
                    f"Cannot migrate {old_email} to {new_email}: both accounts exist."
                )

            old_user.email = new_email
            old_user.save(update_fields=["email"])
            self.stdout.write(
                self.style.SUCCESS(
                    f"  Migrated account email {old_email} -> {new_email}"
                )
            )

    @transaction.atomic
    def handle(self, *args, **options):
        passwords, legacy_email_map = self._validated_configuration()
        self._migrate_legacy_emails(legacy_email_map)

        for entry in DEMO_USERS:
            self._adopt_profile_conflict(entry)

            data = dict(entry)
            email = data.pop("email")
            student = data.pop("student", None)
            student_registry = data.pop("student_registry", None)
            office_staff = data.pop("office_staff", None)
            lecturer = data.pop("lecturer", None)
            coordinator = data.pop("coordinator", None)
            supervisor = data.pop("supervisor", None)
            panel = data.pop("panel", None)

            data["must_change_password"] = False
            data["is_staff"] = False
            data["is_superuser"] = False

            user, created = User.objects.update_or_create(
                email=email,
                defaults=data,
            )
            user.set_password(passwords[user.role])
            user.save()

            if user.role == User.Role.OFFICE_ADMIN:
                user.user_permissions.add(
                    Permission.objects.get(content_type__app_label="marks", codename="change_markentry")
                )

            if student is not None:
                student_obj, _ = Student.objects.update_or_create(
                    user=user, defaults=student
                )
                if student_registry is not None:
                    StudentRegistry.objects.update_or_create(
                        student=student_obj, defaults=student_registry
                    )
                seed_student(student_obj)

            if office_staff is not None:
                OfficeStaff.objects.update_or_create(user=user, defaults=office_staff)

            lecturer_obj = None
            if lecturer is not None:
                lecturer_obj, _ = Lecturer.objects.update_or_create(
                    user=user, defaults=lecturer
                )
            if lecturer_obj is not None and coordinator is not None:
                Coordinator.objects.update_or_create(
                    lecturer=lecturer_obj, defaults=coordinator
                )
            if lecturer_obj is not None and supervisor is not None:
                Supervisor.objects.update_or_create(
                    lecturer=lecturer_obj, defaults=supervisor
                )
            if lecturer_obj is not None and panel is not None:
                Panel.objects.update_or_create(lecturer=lecturer_obj, defaults=panel)

            verb = "Created" if created else "Updated"
            self.stdout.write(
                self.style.SUCCESS(f"  {verb} {user.role:<22} {user.email}")
            )

        for entry in PANEL_RESEARCH_PROFILES:
            student_user = User.objects.get(email=entry["student_email"])
            supervisor_user = User.objects.get(email=entry["supervisor_email"])
            profile, created = StudentResearchProfile.objects.update_or_create(
                student=student_user,
                defaults={
                    "matric_no": entry["matric_no"],
                    "student_name": entry["student_name"],
                    "programme": entry["programme"],
                    "semester": entry["semester"],
                    "proposed_topic": entry["proposed_topic"],
                    "research_area": entry["research_area"],
                    "abstract": entry["abstract"],
                    "supervisor": supervisor_user,
                },
            )

            verb = "Created" if created else "Updated"
            self.stdout.write(
                self.style.SUCCESS(f"  {verb} panel profile {profile.matric_no}")
            )

        if not AcademicSemester.objects.exists():
            today = timezone.localdate()
            office = User.objects.get(email="demo.office.admin@example.test")
            semester = create_semester(
                actor=office,
                academic_session=f"{today.year}/{today.year + 1}",
                term=AcademicSemester.Term.SEMESTER_I,
                starts_on=today - timedelta(days=30),
                ends_on=today + timedelta(days=120),
            )
            _publish_demo_capacity_plan(semester, office)
            activate_semester(
                semester,
                actor=office,
                reason="Create guarded fictional development semester.",
            )
            self.stdout.write(
                self.style.SUCCESS("  Created fictional active academic semester")
            )

        demo_semester = (
            AcademicSemester.objects.filter(
                lifecycle_status=AcademicSemester.Lifecycle.ACTIVE
            ).first()
            or AcademicSemester.objects.order_by("-starts_on", "-pk").first()
        )
        demo_coordinator = User.objects.get(email="demo.coordinator@example.test")
        for profile in StudentResearchProfile.objects.filter(
            student__email__in=[
                item["student_email"] for item in PANEL_RESEARCH_PROFILES
            ]
        ).select_related("student", "student__student", "supervisor"):
            student = profile.student.student
            if SupervisorAppointment.objects.filter(
                student=student,
                status=SupervisorAppointment.Status.ACTIVE,
            ).exists():
                continue
            if SupervisorApplication.objects.filter(student=student).exists():
                continue
            application = SupervisorApplication.objects.create(
                student=student,
                academic_semester=demo_semester,
                proposed_supervisor=profile.supervisor,
                research_title=profile.proposed_topic,
                research_area=profile.research_area,
                research_abstract=profile.abstract,
                status=SupervisorApplication.Status.APPROVED,
                supervisor_decided_at=timezone.now(),
                coordinator_decided_at=timezone.now(),
            )
            SupervisorAppointment.objects.create(
                application=application,
                student=student,
                supervisor=profile.supervisor,
                approved_by=demo_coordinator,
            )

        if not SupervisorDocumentRequirement.objects.exists():
            office = User.objects.get(email="demo.office.admin@example.test")
            create_requirement(
                actor=office,
                values={
                    "label": "Research Proposal",
                    "description": (
                        "Upload the current demonstration research proposal."
                    ),
                    "is_required": True,
                    "is_active": True,
                    "display_order": 1,
                },
            )
            self.stdout.write(
                self.style.SUCCESS(
                    "  Created fictional supervisor document requirement"
                )
            )

        self.stdout.write(self.style.SUCCESS("\nDemo accounts + role profiles ready."))
