"""Announcement + Notification API.

Mounted under ``/api/`` by the project URLconf:

    GET  /api/announcements/                  list (senders: all, students: their feed)
    POST /api/announcements/                  publish/draft (senders only, multipart)
    GET  /api/announcements/<id>/             retrieve one
    PATCH/DELETE /api/announcements/<id>/      edit / remove (senders only)
    GET  /api/announcements/<id>/attachment/  download the file (recipients + senders)
    GET  /api/announcements/audience-options/ programmes and intakes to target (senders)
    GET  /api/announcements/recipient-count/  how many people a draft would reach (senders)

    GET  /api/notifications/                  the caller's own in-app feed
    POST /api/notifications/<id>/read/        mark one read/unread
    POST /api/notifications/mark-all-read/    mark every unread one read

There is no background worker: scheduled announcements are released and
finished ones expired at the start of the two list endpoints, and by the
``release_announcements`` command run from Task Scheduler or cron.
"""
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Min, Q
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.authorization import coordinator_programmes
from accounts.models import Student
from accounts.programmes import APPROVED_PROGRAMMES, normalise_programme
from appointments.models import CoSupervisorAppointment, SupervisorAppointment

from .emails import ANNOUNCEMENT, SIGN_OFF, email_users, portal_link
from .models import Announcement, Notification
from .serializers import AnnouncementSerializer
from .upload_security import validate_attachment

User = get_user_model()

# Roles allowed to publish announcements. Students are receive-only.
SENDER_ROLES = {"Office Staff/Admin", "Programme Coordinator", "Lecturer"}

# Announcement priority -> notification priority used in the bell feed.
PRIORITY_TO_NOTIFICATION = {
    Announcement.Priority.URGENT: Notification.Priority.HIGH,
    Announcement.Priority.INFO: Notification.Priority.MEDIUM,
    Announcement.Priority.GENERAL: Notification.Priority.NORMAL,
}

# The bell and the notifications page show the newest notifications only.
NOTIFICATION_FEED_LIMIT = 200

# Announcement audience -> the User.role that should receive it.
AUDIENCE_TO_ROLE = {
    Announcement.Audience.STUDENTS: User.Role.STUDENT,
    Announcement.Audience.LECTURERS: User.Role.LECTURER,
    Announcement.Audience.STAFF: User.Role.OFFICE_ADMIN,
    Announcement.Audience.COORDINATORS: User.Role.COORDINATOR,
}

# Students who have left no longer get announcements.
GONE = (Student.Status.GRADUATED, Student.Status.WITHDRAWN)


# Helpers


def _is_sender(user):
    # Keyed on the role, not on ``is_staff`` or superuser status. Those only
    # concern Django admin, and treating them as a sender let a Student with the
    # flag set publish announcements and read other audiences' broadcasts.
    return getattr(user, "role", None) in SENDER_ROLES


def _require_sender(request):
    """Raise 403 unless the caller may publish/manage announcements."""
    if not _is_sender(request.user):
        raise PermissionDenied("You do not have permission to send announcements.")


def _is_office_admin(user):
    """Office Staff/Admin may moderate anyone's announcement; other senders own only theirs."""
    return getattr(user, "role", None) == User.Role.OFFICE_ADMIN


def _require_can_manage(request, announcement):
    """Raise 403 unless the caller owns this announcement or is Office Staff/Admin."""
    _require_sender(request)
    if _is_office_admin(request.user):
        return
    if announcement.created_by_id != request.user.pk:
        raise PermissionDenied("You can only modify announcements you created.")


def _supervisee_ids(user):
    return list(
        Student.objects.filter(
            Q(
                supervisor_appointments__supervisor=user,
                supervisor_appointments__status=SupervisorAppointment.Status.ACTIVE,
            )
            | Q(
                co_supervisor_appointments__supervisor=user,
                co_supervisor_appointments__status=CoSupervisorAppointment.Status.ACTIVE,
            )
        )
        .exclude(status__in=GONE)
        .values_list("user_id", flat=True)
        .distinct()
    )


def _my_programmes(user):
    return list(dict.fromkeys(normalise_programme(p) or p for p in coordinator_programmes(user)))


def _sender_scope(user):
    """None for the office. Coordinators reach the students of the programmes
    they coordinate, lecturers the students they supervise."""
    role = getattr(user, "role", None)
    if role == User.Role.COORDINATOR:
        return {"programmes": _my_programmes(user)}
    if role == User.Role.LECTURER:
        return {"students": _supervisee_ids(user)}
    return None


def _apply_sender_scope(announcement, author):
    """Hold a coordinator's or lecturer's notice to their own students.
    Returns an error dict, or None."""
    scope = _sender_scope(author)
    if scope is None:
        announcement.target_students = []
        return None
    if announcement.audiences != [Announcement.Audience.STUDENTS]:
        return {"audiences": "You can only send announcements to your own students."}
    if "programmes" in scope:
        mine = scope["programmes"]
        if not mine:
            return {"audiences": "You don't coordinate a programme right now."}
        if any(programme not in mine for programme in announcement.target_programmes):
            return {"targetProgrammes": "You can only send to the programmes you coordinate."}
        if not announcement.target_programmes:
            announcement.target_programmes = mine
        announcement.target_students = []
        return None
    if announcement.target_programmes or announcement.target_intakes:
        return {"target": "Your announcements go to the students you supervise."}
    if not scope["students"]:
        return {"audiences": "You don't supervise any students right now."}
    announcement.target_students = scope["students"]
    return None


def _audiences_for(user):
    """The audiences a user belongs to: everyone, plus their own role's audience."""
    role = getattr(user, "role", None)
    return [Announcement.Audience.ALL] + [
        audience for audience, audience_role in AUDIENCE_TO_ROLE.items() if audience_role == role
    ]


def _own_student(user):
    if getattr(user, "role", None) != User.Role.STUDENT:
        return None
    return user._related_or_none("student")


def _addressed_q(user):
    """Announcements addressed to one of this user's audiences."""
    audiences = _audiences_for(user)
    addressed = Q(target__in=audiences)
    for audience in audiences:
        addressed |= Q(also_targets__contains=[audience.value])
    return addressed


def _matches_targeting(user, announcement):
    """False when a student is outside the programmes or intakes a notice is
    narrowed to. The narrowing only concerns students, not its other audiences."""
    if getattr(user, "role", None) != User.Role.STUDENT:
        return True
    if announcement.target_students and user.pk not in announcement.target_students:
        return False
    if not announcement.target_programmes and not announcement.target_intakes:
        return True
    student = _own_student(user)
    if student is None:
        return False
    return (
        not announcement.target_programmes or student.programme in announcement.target_programmes
    ) and (
        not announcement.target_intakes or student.intake_semester in announcement.target_intakes
    )


def _targeting_q(user):
    """The queryset form of ``_matches_targeting``."""
    if getattr(user, "role", None) != User.Role.STUDENT:
        return Q()
    listed = Q(target_students=[]) | Q(target_students__contains=[user.pk])
    student = _own_student(user)
    if student is None:
        return listed & Q(target_programmes=[], target_intakes=[])
    return listed & (
        Q(target_programmes=[]) | Q(target_programmes__contains=[student.programme])
    ) & (Q(target_intakes=[]) | Q(target_intakes__contains=[student.intake_semester]))


def _can_read(user, announcement):
    """Office reads everything and authors read their own; everyone else reads
    published announcements addressed to them, so a Staff-only or
    Coordinators-only notice stays with its audience. People it was delivered
    to can still open it, and its attachment, after it expires."""
    if _is_office_admin(user):
        return True
    if _is_sender(user) and announcement.created_by_id == user.pk:
        return True
    if (
        announcement.status == Announcement.Status.ACTIVE
        and any(audience in _audiences_for(user) for audience in announcement.audiences)
        and _matches_targeting(user, announcement)
    ):
        return True
    return (
        announcement.status == Announcement.Status.EXPIRED
        and Notification.objects.filter(recipient=user, announcement=announcement).exists()
    )


def _require_can_read(request, announcement):
    # 404 rather than 403, so ids of drafts and other audiences' notices stay hidden.
    if not _can_read(request.user, announcement):
        raise NotFound("Announcement not found.")


def _can_manage(user, announcement):
    return _is_sender(user) and (
        _is_office_admin(user) or announcement.created_by_id == user.pk
    )


def _present(announcement, user):
    payload = announcement.to_public_dict()
    payload["canManage"] = _can_manage(user, announcement)
    return payload


def _recipients_for(announcement):
    """Active users this announcement should reach: everyone in its audiences,
    with students narrowed to the targeted programmes and intakes when it has any.
    Graduated and withdrawn students are left out."""
    active = (
        User.objects.filter(is_active=True)
        .exclude(role=User.TECHNICAL_ADMIN)
        .exclude(student__status__in=GONE)
    )
    if Announcement.Audience.ALL in announcement.audiences:
        return active
    reached = Q(pk__in=[])
    for audience in announcement.audiences:
        role = AUDIENCE_TO_ROLE.get(audience)
        if role is None:
            continue
        group = Q(role=role)
        if audience == Announcement.Audience.STUDENTS:
            if announcement.target_students:
                group &= Q(pk__in=announcement.target_students)
            if announcement.target_programmes:
                group &= Q(student__programme__in=announcement.target_programmes)
            if announcement.target_intakes:
                group &= Q(student__intake_semester__in=announcement.target_intakes)
        reached |= group
    return active.filter(reached)


def _fan_out(announcement):
    """Deliver one notification per targeted recipient. Returns the total.

    ``event_key`` makes delivery idempotent: the unique (recipient, event_key)
    constraint means republishing after a retraction reuses the existing row
    instead of appending a duplicate. Without it, toggling Draft/Active
    multiplied every recipient's feed without limit.
    """
    event_key = f"ANN-{announcement.pk}"
    recipients = _recipients_for(announcement)
    if announcement.priority != Announcement.Priority.URGENT:
        recipients = recipients.filter(announcement_alerts=True)
    delivered = set(
        Notification.objects.filter(announcement=announcement).values_list("recipient_id", flat=True)
    )
    recipients = [recipient for recipient in recipients if recipient.pk not in delivered]
    if recipients:
        # Only people getting it for the first time are emailed, and only once
        # the delivery is committed.
        transaction.on_commit(lambda fresh=recipients: _email_announcement(announcement, fresh))
    notifications = [_notification_for(announcement, recipient) for recipient in recipients]
    Notification.objects.bulk_create(notifications, ignore_conflicts=True)
    return Notification.objects.filter(announcement=announcement).count()


def _notification_for(announcement, recipient):
    event_key = f"ANN-{announcement.pk}"
    return Notification(
        recipient=recipient,
        title=announcement.title,
        service=(announcement.created_by_name or "Postgraduate Office")[:128],
        summary=announcement.summary,
        message=announcement.content,
        priority=PRIORITY_TO_NOTIFICATION.get(
            announcement.priority, Notification.Priority.NORMAL
        ),
        is_announcement=True,
        reference=event_key,
        event_key=event_key,
        module_label="Announcement",
        announcement=announcement,
    )


def deliver_missed_announcements(user, now=None):
    """Give a person the live announcements addressed to them that they never
    received, such as a student registered after one was published, or someone
    whose programme changed. Feed only: the emails went out when it was published.
    Each one is dated when it first went out, so the feed keeps its order."""
    if not user.is_active or user.role == User.TECHNICAL_ADMIN:
        return 0
    student = _own_student(user)
    if student is not None and student.status in GONE:
        return 0
    now = now or timezone.now()
    missed = (
        Announcement.objects.filter(_addressed_q(user), status=Announcement.Status.ACTIVE)
        .filter(_targeting_q(user))
        .filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))
        .exclude(notifications__recipient=user)
    )
    if not user.announcement_alerts:
        missed = missed.filter(priority=Announcement.Priority.URGENT)
    missed = list(missed)
    if not missed:
        return 0
    first_sent = dict(
        Notification.objects.filter(announcement__in=missed)
        .values("announcement")
        .annotate(first=Min("created_at"))
        .values_list("announcement", "first")
    )
    Notification.objects.bulk_create(
        [_notification_for(announcement, user) for announcement in missed],
        ignore_conflicts=True,
    )
    for announcement in missed:
        sent = first_sent.get(announcement.pk) or announcement.publish_at or announcement.created_at
        Notification.objects.filter(recipient=user, announcement=announcement).update(created_at=sent)
    return len(missed)


def _email_announcement(announcement, users):
    attachment = (
        f"It has an attachment, {announcement.attachment_name}, which you can download in the portal.\n\n"
        if announcement.attachment
        else ""
    )
    urgent = announcement.priority == Announcement.Priority.URGENT
    email_users(
        users,
        ANNOUNCEMENT,
        f"{'Urgent: ' if urgent else ''}{announcement.title}",
        f"{announcement.content}\n\n{attachment}"
        f"Read it in the portal: {portal_link('/notifications')}\n\n"
        "You get this email because email alerts are on in your Settings.\n\n"
        f"{SIGN_OFF}",
        wait=False,
    )


def _retract(announcement):
    """Withdraw an announcement from every recipient's feed.

    Notifications carry a copy of the body, so leaving them in place would keep
    a retracted announcement readable even though the announcement endpoints
    correctly deny access to it.
    """
    Notification.objects.filter(announcement=announcement).delete()


def _sync_delivery(announcement):
    """Make delivered copies match a published announcement. Returns the total.

    Rows of recipients who are no longer in the audience are removed (a
    retarget or an Expired round trip must not leave the text with them), the
    remaining copies get the current wording, and anyone missing is delivered
    to (an upgrade to Urgent reaches people who turned alerts off). Untouched
    rows keep their read state.
    """
    Notification.objects.filter(announcement=announcement).exclude(
        recipient__in=_recipients_for(announcement)
    ).delete()
    _resync_notifications(announcement)
    return _fan_out(announcement)


def _resync_notifications(announcement):
    """Push an edit of a still-published announcement into delivered rows."""
    Notification.objects.filter(announcement=announcement).update(
        title=announcement.title,
        summary=announcement.summary,
        message=announcement.content,
        priority=PRIORITY_TO_NOTIFICATION.get(
            announcement.priority, Notification.Priority.NORMAL
        ),
    )


LIVE_STATUSES = (Announcement.Status.ACTIVE, Announcement.Status.SCHEDULED)


def _publishable(announcement):
    """Error dict when an announcement may not go live, otherwise None."""
    if (
        announcement.status in LIVE_STATUSES
        and not (announcement.content or "").strip()
    ):
        return {"content": "Announcement content is required to publish."}
    return None


def _targeting_errors(announcement):
    if (announcement.target_programmes or announcement.target_intakes) and (
        Announcement.Audience.STUDENTS not in announcement.audiences
    ):
        return {"target": "Programme and intake targeting needs students in the audience."}
    return None


def _prepare(announcement, now):
    """Check the schedule and targeting, then settle a publish request as Active
    or Scheduled by its publish time. Returns an error dict, or None to save."""
    errors = _targeting_errors(announcement) or {}
    publish_at, expires_at = announcement.publish_at, announcement.expires_at
    if publish_at and expires_at and publish_at >= expires_at:
        errors["expiresAt"] = "The expiry time must be after the publish time."
    if announcement.status in LIVE_STATUSES:
        if announcement.status == Announcement.Status.SCHEDULED and not publish_at:
            errors["publishAt"] = "Choose when to publish this announcement."
        elif expires_at and expires_at <= now and "expiresAt" not in errors:
            errors["expiresAt"] = "The expiry time has already passed."
    if errors:
        return errors
    if announcement.status in LIVE_STATUSES:
        announcement.status = (
            Announcement.Status.SCHEDULED
            if publish_at and publish_at > now
            else Announcement.Status.ACTIVE
        )
    return _publishable(announcement)


def release_due_announcements(now=None):
    """Publish scheduled announcements that are due, and expire finished ones.

    Safe to run often and from several requests at once: due rows are claimed
    with SKIP LOCKED, and delivery is idempotent through ``event_key``. A notice
    whose whole window passed before it was released expires undelivered.
    Expiry keeps delivered notifications. Returns ``(released, expired)``.
    """
    now = now or timezone.now()
    pending = Announcement.objects.filter(
        Q(status=Announcement.Status.SCHEDULED, publish_at__lte=now)
        | Q(status__in=LIVE_STATUSES, expires_at__lte=now)
    )
    if not pending.exists():
        return 0, 0
    with transaction.atomic():
        due = list(
            Announcement.objects.select_for_update(skip_locked=True)
            .filter(status=Announcement.Status.SCHEDULED, publish_at__lte=now)
            .filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))
        )
        for announcement in due:
            announcement.status = Announcement.Status.ACTIVE
            announcement.save(update_fields=["status", "updated_at"])
            _fan_out(announcement)
        expired = Announcement.objects.filter(
            status__in=LIVE_STATUSES, expires_at__lte=now
        ).update(status=Announcement.Status.EXPIRED, updated_at=now)
    return len(due), expired


# Announcements


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def announcements_list(request):
    """GET: list announcements. POST: publish or save a draft (senders only)."""
    if request.method == "GET":
        release_due_announcements()
        queryset = Announcement.objects.all()
        if not _is_office_admin(request.user):
            # Published notices addressed to the caller, plus a sender's own work.
            visible = (
                Q(status=Announcement.Status.ACTIVE)
                & _addressed_q(request.user)
                & _targeting_q(request.user)
            )
            if _is_sender(request.user):
                visible |= Q(created_by=request.user)
            queryset = queryset.filter(visible)
        status_param = request.query_params.get("status")
        if status_param and _is_sender(request.user):
            queryset = queryset.filter(status__iexact=status_param)
        return Response([_present(a, request.user) for a in queryset])

    _require_sender(request)
    serializer = AnnouncementSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    announcement = Announcement(
        created_by=request.user,
        created_by_name=getattr(request.user, "full_name", "") or request.user.email,
        **serializer.to_model_kwargs(),
    )
    invalid = _apply_sender_scope(announcement, request.user) or _prepare(announcement, timezone.now())
    if invalid:
        return Response(invalid, status=status.HTTP_400_BAD_REQUEST)

    attachment = request.FILES.get("attachment")
    errors = validate_attachment(attachment)
    if errors:
        return Response({"errors": errors}, status=status.HTTP_400_BAD_REQUEST)

    if attachment is not None:
        announcement.attachment = attachment
    with transaction.atomic():
        announcement.save()
        delivered = (
            _fan_out(announcement) if announcement.status == Announcement.Status.ACTIVE else 0
        )
    payload = _present(announcement, request.user)
    payload["deliveredTo"] = delivered
    return Response(payload, status=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def announcement_detail(request, pk):
    """Retrieve, edit, or delete one announcement."""
    announcement = get_object_or_404(Announcement, pk=pk)

    if request.method == "GET":
        _require_can_read(request, announcement)
        return Response(_present(announcement, request.user))

    if not _can_read(request.user, announcement):
        raise NotFound("Announcement not found.")
    _require_can_manage(request, announcement)

    if request.method == "DELETE":
        stored_file = announcement.attachment.name if announcement.attachment else ""
        with transaction.atomic():
            announcement.delete()
            _delete_file_after_commit(announcement.attachment, stored_file)
        return Response(status=status.HTTP_204_NO_CONTENT)

    attachment = request.FILES.get("attachment")
    errors = validate_attachment(attachment)
    if errors:
        return Response({"errors": errors}, status=status.HTTP_400_BAD_REQUEST)
    try:
        remove_attachment = serializers.BooleanField().to_internal_value(
            request.data.get("removeAttachment", False)
        )
    except serializers.ValidationError:
        return Response(
            {"removeAttachment": ["Must be true or false."]},
            status=status.HTTP_400_BAD_REQUEST,
        )

    was_active = announcement.status == Announcement.Status.ACTIVE
    was_live = announcement.status in LIVE_STATUSES
    previous_file = announcement.attachment.name if announcement.attachment else ""
    partial = request.method == "PATCH"
    serializer = AnnouncementSerializer(data=request.data, partial=partial)
    serializer.is_valid(raise_exception=True)
    for field, value in serializer.to_model_kwargs().items():
        setattr(announcement, field, value)
    if attachment is not None:
        announcement.attachment = attachment
    elif remove_attachment:
        announcement.attachment = None

    reach_changed = not partial or any(
        key in serializer.validated_data for key in ("target", "audiences", "targetProgrammes", "targetIntakes")
    )
    invalid = None
    if reach_changed or (announcement.status in LIVE_STATUSES and not was_live):
        invalid = _apply_sender_scope(announcement, announcement.created_by)
    invalid = invalid or _prepare(announcement, timezone.now())
    if invalid:
        return Response(invalid, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        announcement.save()
        if previous_file and previous_file != (announcement.attachment.name if announcement.attachment else ""):
            _delete_file_after_commit(announcement.attachment, previous_file)
        payload = _present(announcement, request.user)
        if announcement.status == Announcement.Status.ACTIVE:
            payload["deliveredTo"] = _sync_delivery(announcement)
        elif was_active and announcement.status != Announcement.Status.EXPIRED:
            # Back to Draft or Scheduled withdraws delivered copies. Expiring is
            # the natural end of a notice, so recipients keep it in their history.
            _retract(announcement)
    return Response(payload)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def audience_options(request):
    """Who the caller may send to: the office anyone, a coordinator the students
    of their programmes, a lecturer the students they supervise."""
    _require_sender(request)
    scope = _sender_scope(request.user)
    if scope is not None and "students" in scope:
        return Response({"scope": "supervisees", "programmes": [], "intakes": [], "students": len(scope["students"])})
    students = Student.objects.filter(user__is_active=True).exclude(status__in=GONE)
    programmes = APPROVED_PROGRAMMES
    if scope is not None:
        programmes = scope["programmes"]
        students = students.filter(programme__in=programmes)
    intakes = (
        students.exclude(intake_semester="")
        .values_list("intake_semester", flat=True)
        .distinct()
        .order_by("intake_semester")
    )
    return Response({
        "scope": "office" if scope is None else "programme",
        "programmes": programmes,
        "intakes": list(intakes),
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def recipient_count(request):
    """How many people an announcement with these settings would reach now.

    Query: ``target`` or repeated ``audiences``, ``priority``, and repeated
    ``programmes`` / ``intakes``.
    Like delivery, a non-Urgent notice skips people who turned alerts off.
    """
    _require_sender(request)
    params = request.query_params
    fields = {
        "target": params.get("target") or Announcement.Audience.ALL,
        "priority": params.get("priority") or Announcement.Priority.INFO,
        "targetProgrammes": params.getlist("programmes"),
        "targetIntakes": params.getlist("intakes"),
    }
    if params.getlist("audiences"):
        fields["audiences"] = params.getlist("audiences")
    serializer = AnnouncementSerializer(data=fields, partial=True)
    serializer.is_valid(raise_exception=True)
    draft = Announcement(**serializer.to_model_kwargs())
    invalid = _apply_sender_scope(draft, request.user) or _targeting_errors(draft)
    if invalid:
        return Response(invalid, status=status.HTTP_400_BAD_REQUEST)
    recipients = _recipients_for(draft)
    if draft.priority != Announcement.Priority.URGENT:
        recipients = recipients.filter(announcement_alerts=True)
    return Response({"recipients": recipients.count()})


def _delete_file_after_commit(field_file, name):
    """Remove a replaced or deleted attachment from storage once the change is
    committed, so a rolled-back edit never loses the file it still points at."""
    if not name:
        return
    storage = field_file.storage
    transaction.on_commit(lambda: storage.delete(name))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def announcement_attachment(request, pk):
    """Stream the announcement's attachment to an authorised recipient."""
    announcement = get_object_or_404(Announcement, pk=pk)
    _require_can_read(request, announcement)
    if not announcement.attachment:
        return Response(
            {"error": "This announcement has no attachment."},
            status=status.HTTP_404_NOT_FOUND,
        )

    return FileResponse(
        announcement.attachment.open("rb"),
        as_attachment=True,
        filename=announcement.attachment_name,
    )


# Notifications


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def notifications_list(request):
    """The caller's own notification feed (optionally ``?unread=true``)."""
    release_due_announcements()
    deliver_missed_announcements(request.user)
    from .models import visible_notifications
    queryset = visible_notifications(request.user).select_related(
        "recipient", "announcement"
    )
    if request.query_params.get("unread", "").lower() in ("1", "true", "yes"):
        queryset = queryset.filter(is_read=False)
    return Response([n.to_public_dict() for n in queryset[:NOTIFICATION_FEED_LIMIT]])


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def notification_mark_read(request, pk):
    """Mark one of the caller's notifications read (or unread via ``isRead``)."""
    from .models import visible_notifications
    queryset = visible_notifications(request.user)
    notification = get_object_or_404(queryset, pk=pk)
    try:
        is_read = serializers.BooleanField().to_internal_value(request.data.get("isRead", True))
    except serializers.ValidationError:
        return Response({"isRead": ["Must be true or false."]}, status=status.HTTP_400_BAD_REQUEST)
    notification.is_read = is_read
    notification.save(update_fields=["is_read"])
    return Response(notification.to_public_dict())


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def notifications_mark_all_read(request):
    """Mark every unread notification of the caller read."""
    from .models import visible_notifications
    updated = visible_notifications(request.user).filter(is_read=False).update(is_read=True)
    return Response({"updated": updated})
