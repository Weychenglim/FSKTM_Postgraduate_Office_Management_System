"""Who may see, upload and manage documents. Views never repeat these rules.

People reach a student's files through real relationships: an active
supervisor or co-supervisor appointment, an active panel appointment, or
coordinating the student's programme (acting delegations included). The office
sees everything but only changes what it uploaded; students see only what they
uploaded. A programme coordinator archives and restores files about students
in their programme. A programme that no coordinator runs is covered by every
coordinator.
"""
from dataclasses import dataclass, field

from django.db.models import Q

from accounts.authorization import coordinator_programmes, programme_coordinators
from accounts.models import Student, User
from accounts.programmes import normalise_programme
from appointments.models import (
    CoSupervisorAppointment,
    PanelAppointment,
    SupervisorAppointment,
)

from .models import Document, DocumentStudent

STAFF_ROLES = (User.Role.LECTURER, User.Role.COORDINATOR)


def is_office(user):
    return bool(user and user.is_active and user.role == User.Role.OFFICE_ADMIN)


def is_staff_member(user):
    return bool(user and user.is_active and user.role in STAFF_ROLES)


def programme_key(value):
    return normalise_programme(value) or str(value or "").strip().upper()


def covered_programmes():
    """Programmes an eligible coordinator runs today, regular or acting."""
    found = set()
    for user in User.objects.filter(is_active=True, role=User.Role.COORDINATOR):
        found.update(programme_key(value) for value in coordinator_programmes(user))
    return found


def panel_student_ids(panel_member=None, student_ids=None):
    """(student user id, panel member id) pairs for active panel appointments.

    A research profile names its student by user, or for older records only by
    matric number, the same rule as dashboard/dossiers._research_profile."""
    rows = PanelAppointment.objects.filter(status=PanelAppointment.Status.ACTIVE)
    if panel_member is not None:
        rows = rows.filter(panel_member=panel_member)
    rows = list(rows.values_list("profile__student_id", "profile__matric_no", "panel_member_id"))
    by_matric = {}
    unlinked = {matric.casefold() for student_id, matric, _ in rows if student_id is None and matric}
    if unlinked:
        for user_id, matric in Student.objects.filter(
            Q(*[Q(matric_no__iexact=value) for value in unlinked], _connector=Q.OR)
        ).values_list("user_id", "matric_no"):
            by_matric[matric.casefold()] = user_id
    pairs = []
    for student_id, matric, member_id in rows:
        resolved = student_id or by_matric.get((matric or "").casefold())
        if resolved and (student_ids is None or resolved in student_ids):
            pairs.append((resolved, member_id))
    return pairs


@dataclass
class Scope:
    user: User
    office: bool = False
    supervised: set = field(default_factory=set)
    co_supervised: set = field(default_factory=set)
    panel: set = field(default_factory=set)
    coordinated: list = field(default_factory=list)
    covered: set = field(default_factory=set)
    lecturer_programmes: set = field(default_factory=set)

    @classmethod
    def for_user(cls, user):
        scope = cls(user=user, office=is_office(user))
        if scope.office or not is_staff_member(user):
            return scope
        scope.supervised = set(
            SupervisorAppointment.objects.filter(
                supervisor=user, status=SupervisorAppointment.Status.ACTIVE
            ).values_list("student_id", flat=True)
        )
        scope.co_supervised = set(
            CoSupervisorAppointment.objects.filter(
                supervisor=user, status=CoSupervisorAppointment.Status.ACTIVE
            ).values_list("student_id", flat=True)
        )
        scope.panel = {student_id for student_id, _ in panel_student_ids(panel_member=user)}
        scope.coordinated = [programme_key(value) for value in coordinator_programmes(user)]
        if scope.coordinated:
            scope.covered = covered_programmes()
        related = scope.supervisees | scope.panel
        if related:
            scope.lecturer_programmes = {
                programme_key(value)
                for value in Student.objects.filter(user_id__in=related).values_list("programme", flat=True)
                if value
            }
        return scope

    @property
    def supervisees(self):
        return self.supervised | self.co_supervised

    @property
    def programmes(self):
        return set(self.coordinated) | self.lecturer_programmes

    def relationships(self, student):
        """The upload roles this person holds for ``student``."""
        found = set()
        if student.user_id in self.supervisees:
            found.add("SUPERVISOR")
        if student.user_id in self.panel:
            found.add("PANEL")
        if self.coordinated and programme_key(student.programme) in self.coordinated:
            found.add("COORDINATOR")
        return found

    def covers(self, student):
        """Whether this coordinator looks after ``student``: their own programme,
        or a programme no coordinator runs."""
        if not self.coordinated:
            return False
        programme = programme_key(student.programme)
        return programme in self.coordinated or programme not in self.covered

    def coordinates(self, document):
        """Whether this person archives and restores this file."""
        if document.is_staff_file:
            return False
        return any(self.covers(link.student) for link in document.student_links.all())

    def covered_q(self, prefix=""):
        """A filter for the students this coordinator looks after."""
        if not self.coordinated:
            return Q(pk__in=[])

        def any_of(programmes):
            return Q(*[Q(**{f"{prefix}programme__trim__iexact": programme}) for programme in programmes], _connector=Q.OR)

        return any_of(self.coordinated) | ~any_of(self.covered)

    def covered_files(self):
        """Files about a student this coordinator looks after."""
        return Q(is_staff_file=False, pk__in=DocumentStudent.objects.filter(self.covered_q("student__")).values("document_id"))

    def programme_files(self):
        """Files about a student in a programme this person coordinates."""
        programme_q = Q(pk__in=[])
        for programme in self.coordinated:
            programme_q |= Q(student__programme__trim__iexact=programme)
        return Q(is_staff_file=False, pk__in=DocumentStudent.objects.filter(programme_q).values("document_id"))

    def relation_label(self, student):
        if student.user_id in self.supervised:
            return "Your supervisee"
        if student.user_id in self.co_supervised:
            return "Your co-supervisee"
        if student.user_id in self.panel:
            return "Your panel student"
        if self.coordinated and programme_key(student.programme) in self.coordinated:
            return "In your programme"
        return ""


def taggable_students(user, scope=None):
    scope = scope or Scope.for_user(user)
    students = Student.objects.select_related("user")
    if scope.office:
        return students
    if not is_staff_member(user):
        return students.none()
    condition = Q(user_id__in=scope.supervisees | scope.panel)
    for programme in scope.coordinated:
        condition |= Q(programme__trim__iexact=programme)
    return students.filter(condition)


def _staff_file_condition(scope):
    user = scope.user
    if user.role not in STAFF_ROLES:
        return Q(pk__in=[])
    condition = Q(staff_audience=Document.Audience.ACADEMIC, staff_programmes=[])
    for programme in scope.programmes:
        condition |= Q(staff_audience=Document.Audience.ACADEMIC, staff_programmes__contains=[programme])
    if scope.coordinated:
        condition |= Q(staff_audience=Document.Audience.COORDINATORS, staff_programmes=[])
        for programme in scope.coordinated:
            condition |= Q(staff_audience=Document.Audience.COORDINATORS, staff_programmes__contains=[programme])
    return Q(is_staff_file=True) & condition


def visible_documents(user, scope=None):
    scope = scope or Scope.for_user(user)
    documents = Document.objects.all()
    if scope.office:
        return documents
    current = documents.filter(archived_at__isnull=True)
    if user.is_active and user.role == User.Role.STUDENT:
        return current.filter(uploaded_by=user)
    if not is_staff_member(user):
        return documents.none()

    def about(students_q):
        return Q(pk__in=DocumentStudent.objects.filter(students_q).values("document_id"))

    condition = Q(uploaded_by=user) | _staff_file_condition(scope)
    if scope.supervisees:
        condition |= Q(is_staff_file=False, doc_type__share_supervisors=True) & about(Q(student_id__in=scope.supervisees))
    if scope.panel:
        condition |= Q(is_staff_file=False, doc_type__share_panel=True) & about(Q(student_id__in=scope.panel))
    if not scope.coordinated:
        return current.filter(condition)
    condition |= scope.programme_files() & Q(doc_type__share_coordinator=True)
    return documents.filter(Q(archived_at__isnull=True) & condition | Q(archived_at__isnull=False) & condition & scope.covered_files())


def can_see(user, document, scope=None):
    return visible_documents(user, scope).filter(pk=document.pk).exists()


def permissions(user, document, scope):
    uploader = document.uploaded_by_id == user.pk
    archived = document.archived_at is not None
    coordinator = scope.coordinates(document)
    sent_for_submission = user.role == User.Role.STUDENT and getattr(document, "in_submission", False)
    return {
        "canDownload": True,
        "canDelete": uploader and not sent_for_submission,
        "canUploadVersion": uploader and not archived,
        "canEdit": uploader and not archived,
        "canChangeSharing": uploader and document.is_staff_file and not archived,
        "canArchive": coordinator and not archived,
        "canRestore": coordinator and archived,
    }


# Who a file reaches. Used for notices and for "Shared with" on the file page.


def supervisors_of(student_ids):
    pairs = list(
        SupervisorAppointment.objects.filter(
            student_id__in=student_ids, status=SupervisorAppointment.Status.ACTIVE
        ).values_list("student_id", "supervisor_id")
    )
    pairs += list(
        CoSupervisorAppointment.objects.filter(
            student_id__in=student_ids, status=CoSupervisorAppointment.Status.ACTIVE
        ).values_list("student_id", "supervisor_id")
    )
    return pairs


def people_reached(document, students=None):
    """[(user, role label)] who see ``document`` through its sharing, not
    counting the office or the uploader. Staff files with a wide audience
    return the users; callers decide whether to list them by name."""
    reached = {}

    def add(user, label):
        if user.is_active and user.pk != document.uploaded_by_id and user.pk not in reached:
            reached[user.pk] = (user, label)

    if document.is_staff_file:
        audience = document.staff_audience
        if audience == Document.Audience.OFFICE:
            return []
        programmes = list(document.staff_programmes or [])
        if audience == Document.Audience.COORDINATORS or programmes:
            coordinator_sets = [programme_coordinators(p) for p in programmes] if programmes else [
                User.objects.filter(role=User.Role.COORDINATOR, is_active=True, lecturer__coordinator__isnull=False)
            ]
            for users in coordinator_sets:
                for user in users:
                    add(user, "programme coordinator")
        if audience == Document.Audience.ACADEMIC:
            if programmes:
                students = Student.objects.filter(
                    Q(*[Q(programme__trim__iexact=p) for p in programmes], _connector=Q.OR)
                ).values_list("user_id", flat=True)
                student_ids = set(students)
                ids = {lecturer for _, lecturer in supervisors_of(student_ids)}
                ids |= {member for _, member in panel_student_ids(student_ids=student_ids)}
                for user in User.objects.filter(pk__in=ids):
                    add(user, "lecturer")
            else:
                for user in User.objects.filter(role__in=STAFF_ROLES, is_active=True):
                    add(user, "lecturer" if user.role == User.Role.LECTURER else "programme coordinator")
        return list(reached.values())

    students = students if students is not None else list(document.students.select_related("user"))
    ids = {student.user_id for student in students}
    if document.doc_type.share_supervisors:
        primary = set(
            SupervisorAppointment.objects.filter(
                student_id__in=ids, status=SupervisorAppointment.Status.ACTIVE
            ).values_list("supervisor_id", flat=True)
        )
        users = User.objects.in_bulk({lecturer for _, lecturer in supervisors_of(ids)})
        for user_id, user in users.items():
            add(user, "supervisor" if user_id in primary else "co-supervisor")
    if document.doc_type.share_panel:
        users = User.objects.in_bulk({member for _, member in panel_student_ids(student_ids=ids)})
        for user in users.values():
            add(user, "panel member")
    if document.doc_type.share_coordinator:
        for programme in {programme_key(student.programme) for student in students}:
            for user in programme_coordinators(programme) if programme else []:
                add(user, "programme coordinator")
    return list(reached.values())
